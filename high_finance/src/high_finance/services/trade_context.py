from sqlalchemy.orm import Session
from high_finance.db.models.committee_membership import CommitteeMembership
from high_finance.db.models.politician_trade import PoliticianTrade
from high_finance.utils.domain_mapping import company_domains, committee_domains

ROLE_WEIGHT = {
    "chair": 1.0,
    "ranking member": 0.9,
    "vice chair": 0.7,
    "member": 0.5,
}

def _norm_role(role: str | None) -> str:
    return (role or "member").strip().lower()

def build_trade_context(db: Session, trade: PoliticianTrade) -> dict:
    """
    Returns an explainable context payload for the UI.
    No accusations: this is "policy relevance / oversight relevance".
    """
    reasons = []
    score = 0.0


    # 1) Size
    mx = trade.amount_max or 0
    if mx >= 250_000:
        reasons.append({"type": "size", "title": "Large disclosed size", "detail": f"Range up to ${mx:,.0f}."})
        score += 0.2
    elif mx >= 50_000:
        reasons.append({"type": "size", "title": "Notable disclosed size", "detail": f"Range up to ${mx:,.0f}."})
        score += 0.1

    # 2) Committee match
    company = trade.company
    

    c_tags = company_domains(getattr(company, "sector", None), getattr(company, "industry", None)) if company else set()

    memberships = (
        db.query(CommitteeMembership)
        .filter(CommitteeMembership.politician_id == trade.politician_id)
        .all()
    )

    best_match = None
    best_overlap = set()
    best_role = "member"

    for m in memberships:
        com = m.committee.name if m.committee else ""
        sub = m.subcommittee.name if m.subcommittee else None
        p_tags = committee_domains(com, sub)
        overlap = p_tags & c_tags
        if len(overlap) > len(best_overlap):
            best_overlap = overlap
            best_match = (com, sub)
            best_role = _norm_role(m.role)

    if best_match and best_overlap:
        com, sub = best_match
        role_w = ROLE_WEIGHT.get(best_role, 0.5)
        overlap_weight = 1.0
        if "medicare" in best_overlap:
            overlap_weight = 1.2
        elif "health_insurance" in best_overlap:
            overlap_weight = 1.1

        score += 0.6 * role_w * overlap_weight
        reasons.append({
            "type": "committee_match",
            "title": "Committee oversight matches company domain",
            "detail": f"Politician serves on {com}{' → ' + sub if sub else ''} (role: {best_role}); company relates to {', '.join(sorted(best_overlap))}.",
        })
        if trade.transaction_date and trade.disclosure_date:
            lag = (trade.disclosure_date - trade.transaction_date).days
            if lag <= 7:
                score += 0.07
                reasons.append({"type":"timing","title":"Short reporting lag","detail":f"Disclosed {lag} days after the transaction."})
            elif lag <= 21:
                score += 0.03

    elif memberships:
        # still show they have committees, even if no overlap found
        reasons.append({
            "type": "committee_info",
            "title": "Committee context available",
            "detail": "This politician has committee assignments on record, but no strong domain match was detected for this company.",
        })

    # clamp
    score = max(0.0, min(1.0, score))

    label = "High" if score >= 0.55 else "Medium" if score >= 0.30 else "Low"
    PRIORITY = {
        "committee_match": 0,
        "committee_info": 1,
        "timing": 2,
        "size": 3,
    }
    reasons.sort(key=lambda r: PRIORITY.get(r.get("type", ""), 99))


    return {"relevance_score": score, "relevance_label": label, "reasons": reasons}
