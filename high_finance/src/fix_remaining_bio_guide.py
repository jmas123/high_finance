# src/fix_remaining_bioguides.py
"""
Manual fixes for politicians that couldn't be auto-matched.
Run after seed_bio_guide.py

docker compose exec -T api sh -lc 'PYTHONPATH=/app/src python src/fix_remaining_bioguides.py'
"""
from sqlalchemy.orm import Session
from high_finance.db.session import SessionLocal
from high_finance.db.models.politician import Politician

# These politicians couldn't be auto-matched due to name variations
MANUAL_MAPPINGS = [
    # (politician_id, bioguide_id, reason)
    (37, 'H001091', "Ashley Hinson Arenholz -> Ashley Hinson (married name)"),
    (35, 'H001072', "James French Hill -> J. French Hill (middle name first)"),
    (246, 'F000468', "Elizabeth Fletcher -> Lizzie Fletcher (nickname)"),
    (135, 'T000479', "Nicholas Van Taylor -> Van Taylor (first name unused)"),
    (154, 'B001294', "Rodney Leland Blum -> Rod Blum (no middle name in records)"),
]

def fix_remaining_bioguides():
    db: Session = SessionLocal()
    
    updated = 0
    skipped = 0
    
    for pid, bioguide, reason in MANUAL_MAPPINGS:
        politician = db.query(Politician).filter(Politician.id == pid).first()
        
        if not politician:
            print(f"❌ ID {pid} not found")
            skipped += 1
            continue
            
        if politician.bioguide_id:
            print(f"⏭️ {politician.name} already has bioguide_id={politician.bioguide_id}")
            skipped += 1
            continue
        
        # Check if bioguide is already used
        existing = db.query(Politician).filter(Politician.bioguide_id == bioguide).first()
        if existing:
            print(f"⚠️ {bioguide} already assigned to {existing.name} (ID {existing.id})")
            print(f"   Cannot assign to {politician.name} (ID {pid})")
            print(f"   These may be duplicate records - consider merging them")
            skipped += 1
            continue
        
        politician.bioguide_id = bioguide
        print(f"✅ {reason}")
        updated += 1
    
    db.commit()
    
    print(f"\n{'='*50}")
    print(f"Updated: {updated}")
    print(f"Skipped: {skipped}")
    
    # Show final stats
    total = db.query(Politician).count()
    with_bioguide = db.query(Politician).filter(Politician.bioguide_id != None).count()  # noqa
    without_bioguide = db.query(Politician).filter(Politician.bioguide_id == None).count()  # noqa
    
    print(f"\n📊 Final Stats:")
    print(f"   Total politicians: {total}")
    print(f"   With bioguide_id: {with_bioguide} ({100*with_bioguide/total:.1f}%)")
    print(f"   Without bioguide_id: {without_bioguide}")

if __name__ == "__main__":
    fix_remaining_bioguides()