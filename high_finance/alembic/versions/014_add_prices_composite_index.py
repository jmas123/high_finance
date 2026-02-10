"""Add composite index on prices(company_id, date) for backtest query performance

Revision ID: 014_add_prices_composite_index
Revises: 013_add_account_lockout
Create Date: 2026-02-10

"""
from alembic import op

revision = "014_add_prices_composite_index"
down_revision = "013_add_account_lockout"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_prices_company_date",
        "prices",
        ["company_id", "date"],
    )


def downgrade() -> None:
    op.drop_index("ix_prices_company_date", table_name="prices")
