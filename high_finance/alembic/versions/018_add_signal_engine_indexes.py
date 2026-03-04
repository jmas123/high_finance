"""Add indexes for signal engine queries.

Indexes on events.direction, events.company_id (partial where NOT NULL),
and composite (event_type, direction, event_date) to support <500ms signal
evaluation queries.

Revision ID: 018_signal_indexes
Revises: 017_events_fwd_returns
Create Date: 2026-02-16
"""

from alembic import op

revision = "018_signal_indexes"
down_revision = "017_events_fwd_returns"
branch_labels = None
depends_on = None


def upgrade():
    # Single-column index on direction (every signal query filters on this)
    op.create_index(
        "ix_events_direction",
        "events",
        ["direction"],
    )

    # Partial index on company_id for sector/market_cap JOINs
    op.create_index(
        "ix_events_company_id_nonnull",
        "events",
        ["company_id"],
        postgresql_where="company_id IS NOT NULL",
    )

    # Composite index for signal queries that filter type + direction + date range
    op.create_index(
        "ix_events_type_direction_date",
        "events",
        ["event_type", "direction", "event_date"],
    )


def downgrade():
    op.drop_index("ix_events_type_direction_date", table_name="events")
    op.drop_index("ix_events_company_id_nonnull", table_name="events")
    op.drop_index("ix_events_direction", table_name="events")
