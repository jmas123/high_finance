"""Add ROE, profit_margin, debt_to_equity, fcf_yield, beta to screener_cache

Revision ID: 012_add_screener_quality_columns
Revises: 011_add_analysis_type_to_memos
Create Date: 2026-02-07

"""
import sqlalchemy as sa
from alembic import op

revision = "012_add_screener_quality_columns"
down_revision = "011_add_analysis_type_to_memos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("screener_cache", sa.Column("roe", sa.Numeric(10, 4), nullable=True))
    op.add_column("screener_cache", sa.Column("profit_margin", sa.Numeric(10, 4), nullable=True))
    op.add_column("screener_cache", sa.Column("debt_to_equity", sa.Numeric(10, 2), nullable=True))
    op.add_column("screener_cache", sa.Column("fcf_yield", sa.Numeric(10, 4), nullable=True))
    op.add_column("screener_cache", sa.Column("beta", sa.Numeric(8, 4), nullable=True))


def downgrade() -> None:
    op.drop_column("screener_cache", "beta")
    op.drop_column("screener_cache", "fcf_yield")
    op.drop_column("screener_cache", "debt_to_equity")
    op.drop_column("screener_cache", "profit_margin")
    op.drop_column("screener_cache", "roe")
