"""Create events and forward_returns tables.

Revision ID: 017_events_fwd_returns
Revises: 016_merge_015_heads
Create Date: 2026-02-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "017_events_fwd_returns"
down_revision = "016_merge_015_heads"
branch_labels = None
depends_on = None


def upgrade():
    # ── events table ────────────────────────────────────────────────────
    op.create_table(
        "events",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("event_type", sa.String(50), nullable=False, index=True),
        sa.Column("source_system", sa.String(50), nullable=False),
        sa.Column("source_id", sa.Integer, nullable=False),
        sa.Column("ticker", sa.String(50), nullable=False, index=True),
        sa.Column(
            "company_id",
            sa.Integer,
            sa.ForeignKey("companies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("event_date", sa.Date, nullable=False, index=True),
        sa.Column("event_date_type", sa.String(30), nullable=False),
        sa.Column("actor_type", sa.String(30), nullable=False),
        sa.Column("actor_id", sa.Integer, nullable=False, index=True),
        sa.Column("actor_name", sa.String(200), nullable=False),
        sa.Column("direction", sa.String(10), nullable=False),
        sa.Column("amount_min", sa.Float, nullable=True),
        sa.Column("amount_max", sa.Float, nullable=True),
        sa.Column("meta", JSONB, nullable=True),
        # Unique constraint: prevents duplicates across any source table
        sa.UniqueConstraint(
            "source_system", "source_id", "event_date_type",
            name="uq_event_source_system",
        ),
    )

    # Composite indexes for common query patterns
    op.create_index(
        "ix_events_type_ticker_date",
        "events",
        ["event_type", "ticker", "event_date"],
    )
    op.create_index(
        "ix_events_actor",
        "events",
        ["actor_type", "actor_id"],
    )

    # ── forward_returns table ───────────────────────────────────────────
    op.create_table(
        "forward_returns",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "event_id",
            sa.Integer,
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("anchor_date", sa.Date, nullable=True),
        sa.Column("anchor_price", sa.Float, nullable=True),
        sa.Column("spy_anchor_price", sa.Float, nullable=True),
        # Stock forward returns (decimal, e.g. 0.05 = +5%)
        sa.Column("ret_7d", sa.Float, nullable=True),
        sa.Column("ret_30d", sa.Float, nullable=True),
        sa.Column("ret_60d", sa.Float, nullable=True),
        sa.Column("ret_90d", sa.Float, nullable=True),
        sa.Column("ret_180d", sa.Float, nullable=True),
        # SPY benchmark returns (same windows)
        sa.Column("spy_ret_7d", sa.Float, nullable=True),
        sa.Column("spy_ret_30d", sa.Float, nullable=True),
        sa.Column("spy_ret_60d", sa.Float, nullable=True),
        sa.Column("spy_ret_90d", sa.Float, nullable=True),
        sa.Column("spy_ret_180d", sa.Float, nullable=True),
        # Metadata
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("is_complete", sa.Integer, nullable=False, server_default="0"),
        sa.Column("skip_reason", sa.String(100), nullable=True),
    )


def downgrade():
    op.drop_table("forward_returns")
    op.drop_index("ix_events_actor", table_name="events")
    op.drop_index("ix_events_type_ticker_date", table_name="events")
    op.drop_table("events")
