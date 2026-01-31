# src/find_duplicate_politicians.py
"""
Identify duplicate politician records in the database.
These are the same person entered multiple times with slightly different names.

Run: docker compose exec -T api sh -lc 'PYTHONPATH=/app/src python src/find_duplicate_politicians.py'
"""
import re
import unicodedata
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import text

from high_finance.db.session import SessionLocal
from high_finance.db.models.politician import Politician

SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
HONORIFICS = {"hon", "mr", "mrs", "ms", "dr", "rep", "sen", "honorable"}

def normalize_unicode(s: str) -> str:
    normalized = unicodedata.normalize('NFD', s)
    return ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')

def clean_name(s: str) -> str:
    s = (s or "").lower().strip()
    s = normalize_unicode(s)
    s = re.sub(r"[^a-z\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    
    toks = s.split()
    
    while toks and toks[0] in HONORIFICS:
        toks = toks[1:]
    toks = [t for t in toks if t not in HONORIFICS]
    
    if toks and toks[-1] in SUFFIXES:
        toks = toks[:-1]
    
    toks = [t for t in toks if len(t) > 1]
    
    collapsed = []
    for t in toks:
        if not collapsed or collapsed[-1] != t:
            collapsed.append(t)
    
    return " ".join(collapsed)

def get_last_name(cleaned: str) -> str:
    toks = cleaned.split()
    return toks[-1] if toks else ""

def find_duplicates():
    db: Session = SessionLocal()
    
    politicians = db.query(Politician).all()
    print(f"📊 Total politicians in database: {len(politicians)}\n")
    
    # Group by cleaned name
    by_cleaned: dict[str, list[Politician]] = defaultdict(list)
    for p in politicians:
        cleaned = clean_name(p.name)
        by_cleaned[cleaned].append(p)
    
    # Find groups with multiple entries (exact duplicates after cleaning)
    exact_dupes = {k: v for k, v in by_cleaned.items() if len(v) > 1}
    
    if exact_dupes:
        print("=" * 70)
        print("EXACT DUPLICATES (same cleaned name)")
        print("=" * 70)
        for cleaned, pols in sorted(exact_dupes.items()):
            print(f"\n'{cleaned}':")
            for p in pols:
                bio = p.bioguide_id or "(none)"
                print(f"  ID {p.id:4d}: {p.name:<45} bioguide={bio}")
    
    # Group by last name to find near-duplicates
    by_last: dict[str, list[tuple[str, Politician]]] = defaultdict(list)
    for p in politicians:
        cleaned = clean_name(p.name)
        last = get_last_name(cleaned)
        if last:
            by_last[last].append((cleaned, p))
    
    # Find politicians with same bioguide_id (definite duplicates)
    by_bioguide: dict[str, list[Politician]] = defaultdict(list)
    for p in politicians:
        if p.bioguide_id:
            by_bioguide[p.bioguide_id].append(p)
    
    bioguide_dupes = {k: v for k, v in by_bioguide.items() if len(v) > 1}
    
    if bioguide_dupes:
        print("\n" + "=" * 70)
        print("BIOGUIDE CONFLICTS (same bioguide assigned to multiple records)")
        print("=" * 70)
        for bio, pols in sorted(bioguide_dupes.items()):
            print(f"\nbioguide={bio}:")
            for p in pols:
                print(f"  ID {p.id:4d}: {p.name}")
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total politicians: {len(politicians)}")
    print(f"Unique (after cleaning): {len(by_cleaned)}")
    print(f"Exact duplicate groups: {len(exact_dupes)}")
    print(f"Bioguide conflict groups: {len(bioguide_dupes)}")
    
    # Generate SQL to merge duplicates (keep lowest ID)
    if exact_dupes:
        print("\n" + "=" * 70)
        print("SUGGESTED MERGE SQL (keeps lowest ID, updates trades, deletes others)")
        print("=" * 70)
        
        for cleaned, pols in sorted(exact_dupes.items()):
            pols_sorted = sorted(pols, key=lambda p: p.id)
            keep = pols_sorted[0]
            delete_ids = [p.id for p in pols_sorted[1:]]
            
            print(f"\n-- Merge '{cleaned}' -> keep ID {keep.id}")
            for del_id in delete_ids:
                print(f"UPDATE politician_trades SET politician_id = {keep.id} WHERE politician_id = {del_id};")
            print(f"DELETE FROM politicians WHERE id IN ({', '.join(map(str, delete_ids))});")

if __name__ == "__main__":
    find_duplicates()