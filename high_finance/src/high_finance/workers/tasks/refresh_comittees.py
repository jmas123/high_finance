import httpx
from sqlalchemy.orm import Session

from high_finance.workers.tasks.base import tracked_job

from high_finance.db.models.politician import Politician
from high_finance.db.models.committee import Committee
from high_finance.db.models.subcommittee import Subcommittee
from high_finance.db.models.committee_membership import CommitteeMembership

BASE = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main"

def refresh_committees(db: Session) -> int:
    """
    Loads committees + current membership from unitedstates/congress-legislators.
    Returns number of memberships inserted.
    """
    committees = httpx.get(f"{BASE}/committees-current.json", timeout=30).json()
    members = httpx.get(f"{BASE}/committee-membership-current.json", timeout=30).json()

    # Upsert committees + subcommittees
    code_to_committee_id: dict[str, int] = {}
    code_to_sub_id: dict[str, int] = {}

    for c in committees:
        code = c.get("thomas_id") or c.get("code") or c.get("committee_id")
        if not code:
            continue
        chamber = c.get("type")  # house/senate/joint in this dataset
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

            code_to_sub_id[sc_code] = sc_row.id

    inserted = 0

    # Insert memberships (dedupe)
    for m in members:
        bioguide = (m.get("bioguide") or "").strip()
        if not bioguide:
            continue

        pol = db.query(Politician).filter(Politician.bioguide_id == bioguide).first()
        if not pol:
            continue

        committee_code = m.get("committee")
        sub_code = m.get("subcommittee")
        role = m.get("role")

        committee_id = code_to_committee_id.get(committee_code)
        if not committee_id:
            continue

        sub_id = code_to_sub_id.get(sub_code) if sub_code else None

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
    import logging
    from high_finance.db.session import SessionLocal

    logger = logging.getLogger(__name__)

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
