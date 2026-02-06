"""Static mapping from SEC SIC code ranges to domain tags.

Each entry is (lo, hi, tags) — inclusive on both ends.
A company with SIC code `c` matches if lo <= int(c) <= hi.

These capture both direct AND supply-chain relationships.
Example: SIC 3312 (Steel Works) → {"defense", "energy"} because
specialty alloys feed into jet engines, missiles, and pipelines.
"""

SIC_RANGES: list[tuple[int, int, set[str]]] = [
    # ── Agriculture ────────────────────────────────────────────────────────
    (100, 999, {"agriculture"}),          # Crops, livestock, forestry, fishing
    (2000, 2099, {"agriculture"}),        # Food & kindred products

    # ── Mining / Energy ────────────────────────────────────────────────────
    (1000, 1499, {"energy"}),             # Metal mining, coal mining
    (1300, 1399, {"energy"}),             # Oil & gas extraction
    (2900, 2999, {"energy"}),             # Petroleum refining
    (4900, 4949, {"energy"}),             # Electric, gas, sanitary services (utilities)
    (4950, 4959, {"energy"}),             # Sanitary services
    (4960, 4969, {"energy"}),             # Steam & air-conditioning supply
    (4970, 4979, {"energy"}),             # Irrigation systems

    # ── Construction ───────────────────────────────────────────────────────
    (1500, 1799, {"energy"}),             # Construction — tied to energy/infra

    # ── Primary Metals (defense + energy supply chain) ─────────────────────
    (3310, 3399, {"defense", "energy"}),  # Steel works, blast furnaces, alloys, titanium

    # ── Defense / Aerospace ────────────────────────────────────────────────
    (3720, 3729, {"defense"}),            # Aircraft & parts
    (3760, 3769, {"defense"}),            # Guided missiles & space vehicles
    (3795, 3795, {"defense"}),            # Tanks & tank components
    (3480, 3489, {"defense"}),            # Ordnance & accessories
    (3810, 3829, {"defense", "tech"}),    # Search, detection, navigation, guidance instruments

    # ── Industrial Machinery ───────────────────────────────────────────────
    (3500, 3599, {"defense", "energy"}),  # Industrial machinery — dual-use
    (3600, 3699, {"tech"}),               # Electronic & electrical equipment

    # ── Tech / Computers / Electronics ─────────────────────────────────────
    (3570, 3579, {"tech"}),               # Computer & office equipment
    (3670, 3679, {"tech"}),               # Electronic components & accessories
    (3674, 3674, {"tech"}),               # Semiconductors
    (3812, 3812, {"defense", "tech"}),    # Defense electronics
    (7370, 7379, {"tech"}),               # Computer programming, data processing
    (7371, 7371, {"tech"}),               # Computer services
    (7372, 7372, {"tech"}),               # Prepackaged software

    # ── Telecom ────────────────────────────────────────────────────────────
    (4800, 4899, {"telecom", "tech"}),    # Communications (telephone, telegraph, cable, radio)

    # ── Transportation ─────────────────────────────────────────────────────
    (4000, 4099, {"transportation"}),     # Railroads
    (4100, 4199, {"transportation"}),     # Local & suburban transit
    (4200, 4299, {"transportation"}),     # Trucking & warehousing
    (4400, 4499, {"transportation"}),     # Water transportation
    (4500, 4599, {"transportation"}),     # Air transportation
    (4600, 4699, {"transportation"}),     # Pipelines (also energy)
    (4700, 4799, {"transportation"}),     # Transportation services

    # ── Finance / Banking / Insurance ──────────────────────────────────────
    (6000, 6099, {"finance"}),            # Depository institutions (banks)
    (6100, 6199, {"finance"}),            # Non-depository credit institutions
    (6200, 6299, {"finance"}),            # Security & commodity brokers
    (6300, 6399, {"finance", "health"}),  # Insurance carriers (health overlap)
    (6400, 6499, {"finance"}),            # Insurance agents
    (6500, 6599, {"finance"}),            # Real estate
    (6700, 6799, {"finance"}),            # Holding & investment offices

    # ── Healthcare / Pharma ────────────────────────────────────────────────
    (2830, 2836, {"health"}),             # Drugs
    (2833, 2833, {"health"}),             # Pharmaceutical preparations
    (3841, 3851, {"health"}),             # Surgical & medical instruments, ophthalmic
    (5912, 5912, {"health"}),             # Drug stores
    (8000, 8099, {"health"}),             # Health services
    (8060, 8069, {"health"}),             # Hospitals
    (8070, 8079, {"health"}),             # Medical & dental laboratories
    (8080, 8089, {"health"}),             # Home health care
    (8090, 8099, {"health"}),             # Health services (misc)

    # ── Chemicals (dual-use: agriculture + defense) ────────────────────────
    (2800, 2829, {"agriculture", "energy"}),  # Chemicals & allied products
    (2860, 2869, {"energy"}),                 # Industrial chemicals
    (2870, 2879, {"agriculture"}),            # Agricultural chemicals

    # ── Retail / Consumer ──────────────────────────────────────────────────
    (5200, 5599, set()),                  # Retail — too broad, no specific tags
    (5800, 5899, set()),                  # Eating & drinking places
]


def sic_to_domains(sic_code: str | None) -> set[str]:
    """Convert a 4-digit SIC code string into a set of domain tags.

    Returns empty set if sic_code is None, non-numeric, or unmatched.
    Multiple ranges can match — results are unioned.
    """
    if not sic_code:
        return set()
    try:
        code = int(sic_code)
    except (ValueError, TypeError):
        return set()

    tags: set[str] = set()
    for lo, hi, range_tags in SIC_RANGES:
        if lo <= code <= hi:
            tags |= range_tags
    return tags
