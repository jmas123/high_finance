# scripts/sync_committees.py
import os
from typing import Any, Dict, Optional

import httpx
import yaml
from sqlalchemy.orm import Session

from high_finance.db.session import SessionLocal
from high_finance.db.models.politician import Politician
from high_finance.db.models.committee import Committee
from high_finance.db.models.subcommittee import Subcommittee
from high_finance.db.models.committee_membership import CommitteeMembership

BASE_URL = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main"


def fetch_yaml(path: str) -> Any:
    url = f"{BASE_URL}/{path}"
    r = httpx.get(url, timeout=30)
    r.raise_for_status()
    return yaml.safe_load(r.text)


def upsert_committee(db: Session, code: str, name: str, chamber: Optional[str]) -> Committee:
    c = db.query(Committee).filter(Committee.code == code).first()
    if not c:
        c = Committee(code=code, name=name, chamber=chamber)
        db.add(c)
        db.flush()
    else:
        c.name = name
        c.chamber = chamber
    return c


def upsert_subcommittee(db: Session, committee_id: int, code: str, name: str) -> Subcommittee:
    s = db.query(Subcommittee).filter(Subcommittee.code == code).first()
    if not s:
        s = Subcommittee(committee_id=committee_id, code=code, name=name)
        db.add(s)
        db.flush()
    else:
        s.name = name
        s.committee_id = committee_id
    return s


def role_from_member(member: Dict[str, Any]) -> str:
    # unitedstates uses keys like "title" sometimes; sometimes only "rank"
    title = (member.get("title") or member.get("role") or "").strip().lower()
    if not title:
        return "member"
    # normalize
    if "chair" in title and "vice" in title:
        return "vice chair"
    if "chair" in title:
        return "chair"
    if "ranking" in title:
        return "ranking member"
    return "member"


def main():
    committees = fetch_yaml("committees-current.yaml")
    memberships = fetch_yaml("committee-membership-current.yaml")

    db = SessionLocal()
    try:
        # 1) Committees + subcommittees
        committee_by_code: Dict[str, Committee] = {}
        subcommittee_by_code: Dict[str, Subcommittee] = {}

        for c in committees:
            # Prefer committee "thomas_id" or "id" depending on file version
            code = c.get("thomas_id") or c.get("id")
            name = c.get("name")
            chamber = c.get("type")  # house/senate/joint in this dataset
            if not code or not name:
                continue

            com = upsert_committee(db, code=code, name=name, chamber=chamber)
            committee_by_code[code] = com

            for sub in c.get("subcommittees", []) or []:
                sub_code = sub.get("thomas_id") or sub.get("id")
                sub_name = sub.get("name")
                if not sub_code or not sub_name:
                    continue

                # Use a stable subcommittee code.
                # Some versions need parent+child concatenation:
                # If it's short like "03", make it "HSAG03"
                if len(str(sub_code)) <= 3 and str(sub_code).isdigit():
                    full_code = f"{code}{sub_code}"
                else:
                    full_code = str(sub_code)

                sub_obj = upsert_subcommittee(db, committee_id=com.id, code=full_code, name=sub_name)
                subcommittee_by_code[full_code] = sub_obj

        db.commit()

        # 2) Memberships
        inserted = 0
        skipped_no_pol = 0

        # memberships file format can differ; we handle common patterns:
        # Pattern A: { "HSAG": [members...], "HSAG03": [members...] }
        if isinstance(memberships, dict):
            for group_code, members in memberships.items():
                if not isinstance(members, list):
                    continue

                committee_obj = committee_by_code.get(group_code)
                sub_obj = subcommittee_by_code.get(group_code)

                # if it's a subcommittee code like HSIF14, committee code is usually the prefix
                if not committee_obj and sub_obj:
                    committee_obj = committee_by_code.get(next((k for k, v in committee_by_code.items() if v.id == sub_obj.committee_id), ""), None)

                # If still no committee, try prefix match
                if not committee_obj:
                    for ccode in committee_by_code.keys():
                        if group_code.startswith(ccode):
                            committee_obj = committee_by_code[ccode]
                            break

                if not committee_obj:
                    continue

                for m in members:
                    bioguide = m.get("bioguide")
                    if not bioguide:
                        continue

                    pol = db.query(Politician).filter(Politician.bioguide_id == bioguide).first()
                    if not pol:
                        skipped_no_pol += 1
                        continue

                    role = role_from_member(m)

                    exists = (
                        db.query(CommitteeMembership)
                        .filter(
                            CommitteeMembership.politician_id == pol.id,
                            CommitteeMembership.committee_id == committee_obj.id,
                            CommitteeMembership.subcommittee_id == (sub_obj.id if sub_obj else None),
                        )
                        .first()
                    )
                    if exists:
                        exists.role = exists.role or role
                        continue

                    db.add(
                        CommitteeMembership(
                            politician_id=pol.id,
                            committee_id=committee_obj.id,
                            subcommittee_id=sub_obj.id if sub_obj else None,
                            role=role,
                        )
                    )
                    inserted += 1

        db.commit()
        print(f"✅ Synced committees/subcommittees. Inserted memberships: {inserted}. Skipped (no politician bioguide match): {skipped_no_pol}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
