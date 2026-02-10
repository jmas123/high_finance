import logging

import httpx
import yaml
from sqlalchemy.orm import Session

from high_finance.workers.tasks.base import tracked_job

from high_finance.db.models.politician import Politician
from high_finance.db.models.committee import Committee
from high_finance.db.models.subcommittee import Subcommittee
from high_finance.db.models.committee_membership import CommitteeMembership

logger = logging.getLogger(__name__)

BASE = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main"


def refresh_committees(db: Session) -> int:
    """
    Loads committees + current membership from unitedstates/congress-legislators.
    Data files are YAML format.
    Returns number of memberships inserted.
    """
    committees_resp = httpx.get(f"{BASE}/committees-current.yaml", timeout=30)
    committees_resp.raise_for_status()
    committees = yaml.safe_load(committees_resp.text)

    members_resp = httpx.get(f"{BASE}/committee-membership-current.yaml", timeout=30)
    members_resp.raise_for_status()
    members = yaml.safe_load(members_resp.text)

    # Upsert committees + subcommittees
    code_to_committee_id: dict[str, int] = {}
    code_to_sub_id: dict[str, int] = {}

    for c in committees:
        code = c.get("thomas_id") or c.get("code") or c.get("committee_id")
        if not code:
            continue
        chamber = c.get("type")  # house/senate/joint
        name = c.get("name") or code

        row = db.query(Committee).filter(Committee.code == code).first()
        if not row:
            row = Committee(code=code, name=name, chamber=chamber)
            db.add(row)
            db.flush()
        else:
            row.name = name or row.name
            row.chamber = chamber or row.chamber

        code_to_committee_id[code] = row.id

        for sc in c.get("subcommittees", []) or []:
            sc_code = sc.get("thomas_id") or sc.get("code") or sc.get("subcommittee_id")
            sc_name = sc.get("name") or sc_code
            if not sc_code:
                continue

            sc_row = (
                db.query(Subcommittee)
                .filter(Subcommittee.code == sc_code, Subcommittee.committee_id == row.id)
                .first()
            )
            if not sc_row:
                sc_row = Subcommittee(code=sc_code, name=sc_name, committee_id=row.id)
                db.add(sc_row)
                db.flush()
            else:
                sc_row.name = sc_name or sc_row.name

            # Full key = committee_code + subcommittee_code (e.g. "SSAF13")
            full_sub_key = f"{code}{sc_code}"
            code_to_sub_id[full_sub_key] = sc_row.id

    inserted = 0

    # Membership YAML is a dict: { "COMMITTEE_CODE": [list of members], ... }
    # Keys like "SSAF" = committee, "SSAF13" = subcommittee
    for committee_key, member_list in members.items():
        if not isinstance(member_list, list):
            continue

        # Determine if this is a committee or subcommittee key
        # Committee codes are like HSAG, SSAF (4 chars typically)
        # Subcommittee keys append the sub code: SSAF13, HSAG15
        committee_id = None
        sub_id = None

        # Try exact match as committee first
        if committee_key in code_to_committee_id:
            committee_id = code_to_committee_id[committee_key]
        else:
            # Try to find parent committee by prefix
            # Subcommittee keys = parent_code + sub_code
            if committee_key in code_to_sub_id:
                sub_id = code_to_sub_id[committee_key]
                # Find parent committee
                for ccode, cid in code_to_committee_id.items():
                    if committee_key.startswith(ccode):
                        committee_id = cid
                        break

        if not committee_id:
            continue

        for m in member_list:
            bioguide = (m.get("bioguide") or "").strip()
            if not bioguide:
                continue

            pol = db.query(Politician).filter(Politician.bioguide_id == bioguide).first()
            if not pol:
                continue

            role = m.get("title")  # "Chairman", "Ranking Member", etc.

            exists = (
                db.query(CommitteeMembership)
                .filter(
                    CommitteeMembership.politician_id == pol.id,
                    CommitteeMembership.committee_id == committee_id,
                    CommitteeMembership.subcommittee_id == sub_id,
                    CommitteeMembership.role == role,
                )
                .first()
            )
            if exists:
                continue

            db.add(
                CommitteeMembership(
                    politician_id=pol.id,
                    committee_id=committee_id,
                    subcommittee_id=sub_id,
                    role=role,
                )
            )
            inserted += 1

    db.commit()
    return inserted


@tracked_job("committees")
def refresh_committees_job() -> dict:
    """
    RQ job wrapper - creates its own DB session.
    """
    from high_finance.db.session import SessionLocal

    db: Session = SessionLocal()
    try:
        inserted = refresh_committees(db)
        logger.info(f"Committee sync completed: {inserted} memberships inserted")
        return {
            "status": "ok",
            "inserted": inserted,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Committee sync failed: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()
