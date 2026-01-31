# src/merge_duplicate_politicians.py
"""
Merge duplicate politician records, keeping the one with bioguide_id.
Moves all trades to the kept record and deletes the duplicates.

Run: docker compose exec -T api sh -lc 'PYTHONPATH=/app/src python src/merge_duplicate_politicians.py'
"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from high_finance.db.session import SessionLocal

# Format: (keep_id, delete_ids, name)
# keep_id = the one WITH bioguide_id
MERGES = [
    (109, [147], "Alan Lowenthal"),
    (118, [182], "Bill Flores"),
    (136, [138], "Carlos Curbelo"),
    (97, [165], "Deborah Ross"),
    (96, [101, 103], "Donald Beyer"),
    (150, [152], "James Banks"),
    (86, [88], "Laurel Lee"),
    (170, [197], "Lois Frankel"),
    (6, [18, 41], "Marjorie Taylor Greene"),
    (53, [148], "Michael Conaway"),
    (198, [239], "Michael Fitzpatrick"),
    (179, [181], "Raúl Grijalva"),
    (161, [180], "Richard Hanna"),
    (144, [192], "Rubén Hinojosa"),
    (166, [79, 87, 91], "Scott Franklin"),  # 166 has bioguide, not 79
    (141, [171], "Thomas Kean Jr."),
    (85, [36], "Thomas Suozzi"),  # 85 has bioguide, not 36
]

def merge_duplicates():
    db: Session = SessionLocal()
    
    total_trades_moved = 0
    total_deleted = 0
    
    for keep_id, delete_ids, name in MERGES:
        print(f"\n🔄 Merging '{name}'...")
        print(f"   Keep ID {keep_id}, delete IDs {delete_ids}")
        
        # Move trades from duplicates to the kept record
        for del_id in delete_ids:
            result = db.execute(
                text("UPDATE politician_trades SET politician_id = :keep WHERE politician_id = :delete"),
                {"keep": keep_id, "delete": del_id}
            )
            if result.rowcount > 0:
                print(f"   ↳ Moved {result.rowcount} trades from ID {del_id} → {keep_id}")
                total_trades_moved += result.rowcount
        
        # Delete the duplicate records
        delete_ids_str = ",".join(map(str, delete_ids))
        result = db.execute(
            text(f"DELETE FROM politicians WHERE id IN ({delete_ids_str})")
        )
        print(f"   ↳ Deleted {result.rowcount} duplicate record(s)")
        total_deleted += result.rowcount
    
    db.commit()
    
    # Final stats
    result = db.execute(text("""
        SELECT 
            COUNT(*) as total,
            COUNT(bioguide_id) as with_bioguide
        FROM politicians
    """))
    row = result.fetchone()
    total, with_bioguide = row[0], row[1]
    
    print(f"\n{'='*60}")
    print(f"✅ MERGE COMPLETE")
    print(f"{'='*60}")
    print(f"   Trades moved: {total_trades_moved}")
    print(f"   Records deleted: {total_deleted}")
    print(f"\n📊 Final Stats:")
    print(f"   Total politicians: {total}")
    print(f"   With bioguide_id: {with_bioguide} ({100*with_bioguide/total:.1f}%)")
    print(f"   Without bioguide_id: {total - with_bioguide}")

if __name__ == "__main__":
    merge_duplicates()