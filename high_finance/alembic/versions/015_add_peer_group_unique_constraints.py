"""Add unique constraints on peer_groups for concurrency safety

Revision ID: 015_add_peer_group_unique_constraints
Revises: 014_add_prices_composite_index
Create Date: 2026-02-11

"""
from alembic import op

revision = "015_add_peer_group_unique_constraints"
down_revision = "014_add_prices_composite_index"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Prevent duplicate group names per user+ticker
    op.create_unique_constraint(
        "uq_peer_group_user_ticker_name",
        "peer_groups",
        ["user_id", "ticker", "name"],
    )

    # Prevent multiple default groups per user+ticker
    # (partial unique index: only rows where is_default = true)
    op.execute(
        """
        CREATE UNIQUE INDEX uq_peer_group_default_per_ticker
        ON peer_groups (user_id, ticker)
        WHERE is_default = true
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_peer_group_default_per_ticker")
    op.drop_constraint("uq_peer_group_user_ticker_name", "peer_groups", type_="unique")
