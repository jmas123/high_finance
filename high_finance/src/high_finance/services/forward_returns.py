"""
Forward Returns Engine
======================
Syncs events from source tables (politician_trades, etc.) into a unified
`events` table, then computes forward returns at multiple horizons.

Reuses PriceCache from politician_backtest.py for efficient bulk price lookups.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from high_finance.db.models.company import Company
from high_finance.db.models.event import Event
from high_finance.db.models.forward_return import ForwardReturn
from high_finance.db.models.politician import Politician
from high_finance.db.models.politician_trade import PoliticianTrade
from high_finance.services.politician_backtest import PriceCache
from high_finance.utils.safe_math import safe_return

logger = logging.getLogger(__name__)

WINDOWS = [7, 30, 60, 90, 180]
MAX_GAP_DAYS = 14  # Holiday cluster tolerance (Christmas + New Year)

# Mapping from PoliticianTrade.transaction_type to normalized direction
_DIRECTION_MAP = {
    "purchase": "buy",
    "sale": "sell",
    "sale (partial)": "sell",
    "sale (full)": "sell",
    "exchange": "buy",
}


def _normalize_direction(transaction_type: Optional[str]) -> str:
    """Normalize transaction_type to 'buy' or 'sell'."""
    if not transaction_type:
        return "buy"
    return _DIRECTION_MAP.get(transaction_type.lower().strip(), "buy")


class ForwardReturnsEngine:
    """Syncs events and computes forward returns."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Step 1: Sync politician trades into events table ────────────────

    def sync_politician_trades(self, event_date_type: str = "disclosure_date") -> dict:
        """
        Upsert PoliticianTrade rows into the events table.

        Uses PostgreSQL ON CONFLICT DO UPDATE on the unique constraint
        (source_system, source_id, event_date_type).
        """
        # Query all trades with politician name and company ticker
        trades = (
            self.db.query(
                PoliticianTrade.id,
                PoliticianTrade.politician_id,
                PoliticianTrade.company_id,
                PoliticianTrade.ticker_raw,
                PoliticianTrade.transaction_date,
                PoliticianTrade.disclosure_date,
                PoliticianTrade.transaction_type,
                PoliticianTrade.amount_min,
                PoliticianTrade.amount_max,
                PoliticianTrade.source_url,
                Politician.name.label("politician_name"),
                Company.ticker.label("company_ticker"),
            )
            .join(Politician, PoliticianTrade.politician_id == Politician.id)
            .outerjoin(Company, PoliticianTrade.company_id == Company.id)
            .all()
        )

        if not trades:
            logger.info("No politician trades found to sync")
            return {"synced": 0, "skipped": 0}

        synced = 0
        skipped = 0

        # Build values for bulk upsert
        rows = []
        for t in trades:
            # Pick the event date based on type
            if event_date_type == "transaction_date":
                evt_date = t.transaction_date
            else:
                evt_date = t.disclosure_date

            if evt_date is None:
                skipped += 1
                continue

            # Use Company.ticker if available, fall back to ticker_raw
            ticker = t.company_ticker or t.ticker_raw
            if not ticker:
                skipped += 1
                continue

            ticker = ticker.upper().strip()
            direction = _normalize_direction(t.transaction_type)

            rows.append({
                "event_type": "politician_trade",
                "source_system": "politician_trades",
                "source_id": t.id,
                "ticker": ticker,
                "company_id": t.company_id,
                "event_date": evt_date,
                "event_date_type": event_date_type,
                "actor_type": "politician",
                "actor_id": t.politician_id,
                "actor_name": t.politician_name or "Unknown",
                "direction": direction,
                "amount_min": t.amount_min,
                "amount_max": t.amount_max,
                "meta": {
                    "transaction_type": t.transaction_type,
                    "source_url": t.source_url,
                } if t.transaction_type or t.source_url else None,
            })

        # Batch upsert using raw SQL for performance
        if rows:
            synced = self._bulk_upsert_events(rows)

        logger.info(f"Synced {synced} politician trades, skipped {skipped}")
        return {"synced": synced, "skipped": skipped}

    def _bulk_upsert_events(self, rows: list[dict]) -> int:
        """Bulk upsert events via raw SQL INSERT ... ON CONFLICT DO UPDATE."""
        BATCH_SIZE = 1000
        total = 0

        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i:i + BATCH_SIZE]
            # Build parameterized values
            value_clauses = []
            params = {}
            for j, row in enumerate(batch):
                prefix = f"r{i + j}"
                value_clauses.append(
                    f"(:{prefix}_event_type, :{prefix}_source_system, :{prefix}_source_id, "
                    f":{prefix}_ticker, :{prefix}_company_id, :{prefix}_event_date, "
                    f":{prefix}_event_date_type, :{prefix}_actor_type, :{prefix}_actor_id, "
                    f":{prefix}_actor_name, :{prefix}_direction, :{prefix}_amount_min, "
                    f":{prefix}_amount_max, CAST(:{prefix}_meta AS jsonb))"
                )
                params[f"{prefix}_event_type"] = row["event_type"]
                params[f"{prefix}_source_system"] = row["source_system"]
                params[f"{prefix}_source_id"] = row["source_id"]
                params[f"{prefix}_ticker"] = row["ticker"]
                params[f"{prefix}_company_id"] = row["company_id"]
                params[f"{prefix}_event_date"] = row["event_date"]
                params[f"{prefix}_event_date_type"] = row["event_date_type"]
                params[f"{prefix}_actor_type"] = row["actor_type"]
                params[f"{prefix}_actor_id"] = row["actor_id"]
                params[f"{prefix}_actor_name"] = row["actor_name"]
                params[f"{prefix}_direction"] = row["direction"]
                params[f"{prefix}_amount_min"] = row["amount_min"]
                params[f"{prefix}_amount_max"] = row["amount_max"]
                # JSONB needs to be cast from text
                import json
                params[f"{prefix}_meta"] = json.dumps(row["meta"]) if row["meta"] else None

            values_sql = ",\n".join(value_clauses)
            sql = f"""
                INSERT INTO events (
                    event_type, source_system, source_id, ticker, company_id,
                    event_date, event_date_type, actor_type, actor_id, actor_name,
                    direction, amount_min, amount_max, meta
                )
                VALUES {values_sql}
                ON CONFLICT ON CONSTRAINT uq_event_source_system
                DO UPDATE SET
                    ticker = EXCLUDED.ticker,
                    company_id = EXCLUDED.company_id,
                    actor_name = EXCLUDED.actor_name,
                    direction = EXCLUDED.direction,
                    amount_min = EXCLUDED.amount_min,
                    amount_max = EXCLUDED.amount_max,
                    meta = EXCLUDED.meta
            """
            self.db.execute(text(sql), params)
            total += len(batch)

        self.db.commit()
        return total

    # ── Step 2: Compute forward returns ─────────────────────────────────

    def compute_forward_returns(self) -> dict:
        """
        Compute forward returns for events that are missing or incomplete.

        For each event:
        1. Look up anchor price (close on or after event_date)
        2. For each window (7, 30, 60, 90, 180 days), look up exit price
        3. Compute return = safe_return(anchor, exit, as_percentage=False)
        4. Do the same for SPY benchmark
        5. Upsert into forward_returns
        """
        today = date.today()

        # Find events needing computation:
        # - No forward_return row yet, OR
        # - Existing row with is_complete=0 (partial data, might have new windows)
        events_needing_work = (
            self.db.query(Event)
            .outerjoin(ForwardReturn, Event.id == ForwardReturn.event_id)
            .filter(
                (ForwardReturn.id.is_(None)) |
                (ForwardReturn.is_complete == 0)
            )
            .all()
        )

        if not events_needing_work:
            logger.info("No events need forward return computation")
            return {
                "events_scanned": 0,
                "events_skipped_no_company": 0,
                "events_skipped_no_prices": 0,
                "events_processed": 0,
                "returns_upserted": 0,
            }

        counters = {
            "events_scanned": len(events_needing_work),
            "events_skipped_no_company": 0,
            "events_skipped_no_prices": 0,
            "events_processed": 0,
            "returns_upserted": 0,
        }

        # Separate events by computability
        computable_events = []
        skip_events = []

        for evt in events_needing_work:
            if evt.company_id is None:
                skip_events.append((evt, "no_company_id"))
                counters["events_skipped_no_company"] += 1
            else:
                computable_events.append(evt)

        # Upsert skip_reason for uncomputable events
        for evt, reason in skip_events:
            self._upsert_skip(evt.id, reason)

        if not computable_events:
            self.db.commit()
            return counters

        # Collect all company_ids we need prices for
        company_ids = {evt.company_id for evt in computable_events}

        # Get SPY company_id
        spy_row = self.db.query(Company.id).filter(Company.ticker == "SPY").first()
        spy_id = spy_row[0] if spy_row else None
        if spy_id:
            company_ids.add(spy_id)

        # Find earliest event date for price loading range
        min_event_date = min(evt.event_date for evt in computable_events)
        # Load prices starting a bit before (for anchor snapping)
        load_from = min_event_date - timedelta(days=7)

        # Bulk load prices — one SQL query
        price_cache = PriceCache()
        price_cache.bulk_load(self.db, company_ids, min_date=load_from)

        now_utc = datetime.now(timezone.utc)

        for evt in computable_events:
            # Check if price data exists for this company
            if not price_cache.has_any_prices(evt.company_id):
                self._upsert_skip(evt.id, "no_price_data")
                counters["events_skipped_no_prices"] += 1
                continue

            # Get anchor price
            anchor_price = price_cache.get_close_on_or_after(
                evt.company_id, evt.event_date, max_gap_days=MAX_GAP_DAYS
            )
            if anchor_price is None or anchor_price <= 0:
                self._upsert_skip(evt.id, "anchor_price_invalid")
                counters["events_skipped_no_prices"] += 1
                continue

            # Get SPY anchor price
            spy_anchor = None
            if spy_id:
                spy_anchor = price_cache.get_close_on_or_after(
                    spy_id, evt.event_date, max_gap_days=MAX_GAP_DAYS
                )

            # Compute returns for each window
            returns = {}
            spy_returns = {}
            all_filled = True

            for w in WINDOWS:
                target_date = evt.event_date + timedelta(days=w)

                if target_date > today:
                    # Not enough time has passed
                    all_filled = False
                    continue

                exit_price = price_cache.get_close_on_or_after(
                    evt.company_id, target_date, max_gap_days=MAX_GAP_DAYS
                )
                ret = safe_return(anchor_price, exit_price, as_percentage=False)
                returns[f"ret_{w}d"] = ret

                # SPY benchmark
                if spy_id and spy_anchor and spy_anchor > 0:
                    spy_exit = price_cache.get_close_on_or_after(
                        spy_id, target_date, max_gap_days=MAX_GAP_DAYS
                    )
                    spy_returns[f"spy_ret_{w}d"] = safe_return(spy_anchor, spy_exit, as_percentage=False)

            # Upsert forward_return row
            self._upsert_forward_return(
                event_id=evt.id,
                anchor_date=evt.event_date,
                anchor_price=anchor_price,
                spy_anchor_price=spy_anchor,
                returns=returns,
                spy_returns=spy_returns,
                is_complete=1 if all_filled else 0,
                computed_at=now_utc,
            )
            counters["events_processed"] += 1
            counters["returns_upserted"] += 1

        self.db.commit()
        logger.info(
            f"Forward returns: scanned={counters['events_scanned']}, "
            f"processed={counters['events_processed']}, "
            f"skipped_no_company={counters['events_skipped_no_company']}, "
            f"skipped_no_prices={counters['events_skipped_no_prices']}"
        )
        return counters

    def _upsert_skip(self, event_id: int, reason: str) -> None:
        """Insert or update a forward_return row with skip_reason."""
        existing = (
            self.db.query(ForwardReturn)
            .filter(ForwardReturn.event_id == event_id)
            .first()
        )
        if existing:
            existing.skip_reason = reason
            existing.computed_at = datetime.now(timezone.utc)
        else:
            self.db.add(ForwardReturn(
                event_id=event_id,
                skip_reason=reason,
                computed_at=datetime.now(timezone.utc),
            ))

    def _upsert_forward_return(
        self,
        event_id: int,
        anchor_date: date,
        anchor_price: Optional[float],
        spy_anchor_price: Optional[float],
        returns: dict,
        spy_returns: dict,
        is_complete: int,
        computed_at: datetime,
    ) -> None:
        """Insert or update a forward_return row with computed returns."""
        existing = (
            self.db.query(ForwardReturn)
            .filter(ForwardReturn.event_id == event_id)
            .first()
        )

        if existing:
            existing.anchor_date = anchor_date
            existing.anchor_price = anchor_price
            existing.spy_anchor_price = spy_anchor_price
            existing.is_complete = is_complete
            existing.computed_at = computed_at
            existing.skip_reason = None  # Clear any previous skip reason
            for col, val in {**returns, **spy_returns}.items():
                setattr(existing, col, val)
        else:
            fr = ForwardReturn(
                event_id=event_id,
                anchor_date=anchor_date,
                anchor_price=anchor_price,
                spy_anchor_price=spy_anchor_price,
                is_complete=is_complete,
                computed_at=computed_at,
                skip_reason=None,
                **returns,
                **spy_returns,
            )
            self.db.add(fr)

    # ── Orchestrator ────────────────────────────────────────────────────

    def run(self, event_date_type: str = "disclosure_date") -> dict:
        """Full pipeline: sync events, then compute forward returns."""
        sync_result = self.sync_politician_trades(event_date_type=event_date_type)
        compute_result = self.compute_forward_returns()
        return {
            "sync": sync_result,
            "compute": compute_result,
        }
