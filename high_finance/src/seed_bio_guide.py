# src/seed_bio_guide.py
import re
import unicodedata
import yaml
import requests
from difflib import SequenceMatcher
from sqlalchemy.orm import Session

from high_finance.db.session import SessionLocal
from high_finance.db.models.politician import Politician

# Use BOTH current and historical legislators
LEGISLATORS_CURRENT = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml"
LEGISLATORS_HISTORICAL = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-historical.yaml"

SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
HONORIFICS = {"hon", "mr", "mrs", "ms", "dr", "rep", "sen", "honorable"}

# Common nickname → formal name mappings
NICKNAMES = {
    "mo": "morris",
    "dan": "daniel",
    "mike": "michael",
    "bob": "robert",
    "bill": "william",
    "jim": "james",
    "joe": "joseph",
    "tom": "thomas",
    "ed": "edward",
    "ted": "edward",
    "pat": "patrick",
    "rick": "richard",
    "dick": "richard",
    "chuck": "charles",
    "charlie": "charles",
    "greg": "gregory",
    "ken": "kenneth",
    "matt": "matthew",
    "steve": "stephen",
    "tony": "anthony",
    "dave": "david",
    "chris": "christopher",
    "nick": "nicholas",
    "pete": "peter",
    "rob": "robert",
    "ron": "ronald",
    "ben": "benjamin",
    "jerry": "gerald",
    "jeff": "jeffrey",
    "larry": "lawrence",
    "mitch": "mitchell",
    "cindy": "cynthia",
    "beth": "elizabeth",
    "liz": "elizabeth",
    "kathy": "katherine",
    "cathy": "catherine",
    "kate": "katherine",
    "maggie": "margaret",
    "peggy": "margaret",
    "jackie": "jacqueline",
    "mikie": "michaela",  # Mikie Sherrill
    "cheri": "cheryl",
    "debbie": "deborah",
    "deb": "deborah",
    "marjorie": "marjorie",  # identity
    "earl": "earl",  # identity (Earl Blumenauer)
    "thad": "thaddeus",
    "dean": "dean",  # identity
    "harley": "harley",  # identity
}

def normalize_unicode(s: str) -> str:
    """Convert accented characters to ASCII equivalents."""
    # NFD decomposition splits characters like é into e + combining accent
    # Then we filter out combining characters
    normalized = unicodedata.normalize('NFD', s)
    return ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')

def _tokens(s: str) -> list[str]:
    s = (s or "").lower().strip()
    s = normalize_unicode(s)  # Handle accented characters BEFORE removing non-alpha
    s = re.sub(r"[^a-z\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s.split()

def clean_name(s: str) -> str:
    toks = _tokens(s)

    # remove leading honorifics
    while toks and toks[0] in HONORIFICS:
        toks = toks[1:]

    # remove honorifics anywhere
    toks = [t for t in toks if t not in HONORIFICS]

    # drop trailing suffix
    if toks and toks[-1] in SUFFIXES:
        toks = toks[:-1]

    # drop lone initials (e.g. "D", "R", "J")
    toks = [t for t in toks if len(t) > 1]

    # collapse immediate duplicates (Scott Scott Franklin)
    collapsed = []
    for t in toks:
        if not collapsed or collapsed[-1] != t:
            collapsed.append(t)

    return " ".join(collapsed)

def expand_nicknames(name: str) -> list[str]:
    """Generate name variants with nickname expansions."""
    toks = name.split()
    if not toks:
        return [name]
    
    variants = [name]
    
    # Try expanding first token if it's a nickname
    if toks[0] in NICKNAMES:
        expanded = [NICKNAMES[toks[0]]] + toks[1:]
        variants.append(" ".join(expanded))
    
    # Also try the reverse (formal → nickname)
    reverse_nicknames = {v: k for k, v in NICKNAMES.items()}
    if toks[0] in reverse_nicknames:
        contracted = [reverse_nicknames[toks[0]]] + toks[1:]
        variants.append(" ".join(contracted))
    
    return variants

def leg_variants(leg: dict) -> list[str]:
    n = leg.get("name", {})
    first = (n.get("first") or "").strip()
    last = (n.get("last") or "").strip()
    official = (n.get("official_full") or "").strip()
    nickname = (n.get("nickname") or "").strip()

    variants = []
    if official:
        variants.append(official)
    if first and last:
        variants.append(f"{first} {last}")
        variants.append(f"{last}, {first}")
        variants.append(f"{last} {first}")
    if nickname and last:
        variants.append(f"{nickname} {last}")
        variants.append(f"{last}, {nickname}")
    
    return variants

def last_first_key_from_clean(clean: str) -> tuple[str, str]:
    toks = clean.split()
    if not toks:
        return ("", "")
    if len(toks) == 1:
        return (toks[0], "")
    return (toks[-1], toks[0])

def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()

def bioguide_is_free(db: Session, p_id: int, bio: str, assigned_this_run: set[str]) -> bool:
    """Check if a bioguide_id is available."""
    if bio in assigned_this_run:
        return False
    other = db.query(Politician).filter(Politician.bioguide_id == bio).first()
    return (other is None) or (other.id == p_id)

def fetch_all_legislators() -> list[dict]:
    """Fetch both current and historical legislators."""
    print("📥 Fetching current legislators...")
    current = yaml.safe_load(requests.get(LEGISLATORS_CURRENT, timeout=30).text)
    print(f"   Found {len(current)} current legislators")
    
    print("📥 Fetching historical legislators...")
    historical = yaml.safe_load(requests.get(LEGISLATORS_HISTORICAL, timeout=30).text)
    print(f"   Found {len(historical)} historical legislators")
    
    # Combine, with current taking precedence (they come first, so duplicates will use current data)
    all_legislators = current + historical
    print(f"📊 Total: {len(all_legislators)} legislators")
    
    return all_legislators

def backfill_bioguide_ids():
    db: Session = SessionLocal()
    legislators = fetch_all_legislators()

    exact_index: dict[str, set[str]] = {}
    by_last_first: dict[tuple[str, str], set[str]] = {}
    by_last: dict[str, list[tuple[str, str]]] = {}

    for leg in legislators:
        bio = leg.get("id", {}).get("bioguide")
        if not bio:
            continue

        for v in leg_variants(leg):
            c = clean_name(v)
            if not c:
                continue

            # Index the cleaned name
            exact_index.setdefault(c, set()).add(bio)

            # Also index nickname-expanded variants
            for expanded in expand_nicknames(c):
                exact_index.setdefault(expanded, set()).add(bio)
                
                last, first = last_first_key_from_clean(expanded)
                if last and first:
                    by_last_first.setdefault((last, first), set()).add(bio)
                if last:
                    by_last.setdefault(last, []).append((expanded, bio))

    updated_exact = 0
    updated_fuzzy = 0
    skipped_taken = 0
    still_missing = 0

    assigned_this_run: set[str] = set()
    missing_politicians: list[tuple[int, str, str]] = []  # (id, name, cleaned)

    q = db.query(Politician).filter(Politician.bioguide_id == None)  # noqa: E711
    politicians_to_process = list(q)
    print(f"\n🔍 Processing {len(politicians_to_process)} politicians without bioguide_id...\n")

    for p in politicians_to_process:
        c = clean_name(p.name)
        
        # Also try nickname-expanded versions of the politician's name
        name_variants = [c] + expand_nicknames(c)
        
        matched = False
        for variant in name_variants:
            # 1) exact full match
            bios = exact_index.get(variant)
            if bios and len(bios) == 1:
                bio = next(iter(bios))
                if bioguide_is_free(db, p.id, bio, assigned_this_run):
                    p.bioguide_id = bio
                    assigned_this_run.add(bio)
                    updated_exact += 1
                    matched = True
                    break
                else:
                    skipped_taken += 1
                    print(f"⚠️ Conflict: {p.name} -> {bio} (already assigned)")
                    matched = True
                    break

            # 2) exact (last, first) match
            last, first = last_first_key_from_clean(variant)
            bios = by_last_first.get((last, first))
            if bios and len(bios) == 1:
                bio = next(iter(bios))
                if bioguide_is_free(db, p.id, bio, assigned_this_run):
                    p.bioguide_id = bio
                    assigned_this_run.add(bio)
                    updated_exact += 1
                    matched = True
                    break
                else:
                    skipped_taken += 1
                    print(f"⚠️ Conflict: {p.name} -> {bio} (already assigned)")
                    matched = True
                    break

        if matched:
            continue

        # 3) fuzzy within same last name (use original cleaned name)
        last, first = last_first_key_from_clean(c)
        candidates = by_last.get(last, [])
        best_bio = None
        best_score = 0.0
        best_match = ""
        for cand_name, cand_bio in candidates:
            sc = similarity(c, cand_name)
            if sc > best_score:
                best_score = sc
                best_bio = cand_bio
                best_match = cand_name

        if best_bio and best_score >= 0.85:  # Lowered threshold slightly
            if bioguide_is_free(db, p.id, best_bio, assigned_this_run):
                p.bioguide_id = best_bio
                assigned_this_run.add(best_bio)
                updated_fuzzy += 1
                print(f"🔄 Fuzzy match: '{p.name}' -> '{best_match}' ({best_score:.0%})")
            else:
                skipped_taken += 1
                print(f"⚠️ Conflict (fuzzy): {p.name} -> {best_bio} (already assigned)")
        else:
            still_missing += 1
            missing_politicians.append((p.id, p.name, c))

    db.commit()
    
    print(f"\n{'='*60}")
    print(f"✅ Backfilled bioguide IDs (exact): {updated_exact}")
    print(f"✅ Backfilled bioguide IDs (fuzzy): {updated_fuzzy}")
    print(f"⚠️ Skipped (bioguide already taken): {skipped_taken}")
    print(f"❓ Still missing: {still_missing}")
    
    if missing_politicians:
        print(f"\n{'='*60}")
        print("UNMATCHED POLITICIANS (may need manual review):")
        print("="*60)
        for pid, name, cleaned in sorted(missing_politicians, key=lambda x: x[2]):
            print(f"  ID {pid:4d}: {name:<40} -> '{cleaned}'")

if __name__ == "__main__":
    backfill_bioguide_ids()