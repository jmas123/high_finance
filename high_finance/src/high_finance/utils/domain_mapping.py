def company_domains(sector: str | None, industry: str | None) -> set[str]:
    s = (sector or "").lower()
    i = (industry or "").lower()
    tags: set[str] = set()

    # Healthcare
    if any(k in i for k in ["insurance", "managed care", "medicare", "medicaid"]):
        tags.update({"health", "health_insurance", "medicare"})
    elif "health" in s or "health" in i:
        tags.add("health")

    # Defense
    if any(k in i for k in ["defense", "aerospace", "military"]):
        tags.add("defense")

    # Finance
    if any(k in i for k in ["bank", "capital markets", "asset management"]) or "financial" in s:
        tags.add("finance")

    # Energy
    if "energy" in s or any(k in i for k in ["oil", "gas", "utilities"]):
        tags.add("energy")

    # Tech
    if "technology" in s or any(k in i for k in ["software", "semiconductor"]):
        tags.add("tech")

    return tags


def committee_domains(committee_name: str, subcommittee_name: str | None = None) -> set[str]:
    text = f"{committee_name} {(subcommittee_name or '')}".lower()
    tags: set[str] = set()

    if any(k in text for k in ["medicare", "medicaid"]):
        tags.update({"health", "health_insurance", "medicare"})
    elif any(k in text for k in ["health", "public health"]):
        tags.add("health")

    if any(k in text for k in ["armed services", "defense", "intelligence"]):
        tags.add("defense")

    if any(k in text for k in ["financial", "bank", "tax", "ways and means"]):
        tags.add("finance")

    if any(k in text for k in ["energy", "environment", "natural resources"]):
        tags.add("energy")

    if any(k in text for k in ["technology", "cyber", "communications"]):
        tags.add("tech")

    return tags
