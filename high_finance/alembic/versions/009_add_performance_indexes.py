"""Add performance indexes for common query patterns

Revision ID: 009_add_performance_indexes
Revises: 008_add_sic_code_to_companies
Create Date: 2026-02-06

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '009_add_performance_indexes'
down_revision = '008_add_sic_code_to_companies'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Peer lookup by industry (used by get_company_fundamentals comps query)
    op.create_index(
        'ix_companies_industry', 'companies', ['industry'],
        if_not_exists=True,
    )
    # Sector performance queries
    op.create_index(
        'ix_companies_sector', 'companies', ['sector'],
        if_not_exists=True,
    )
    # Institutional holdings lookups
    op.create_index(
        'ix_holdings_investor_id', 'holdings', ['investor_id'],
        if_not_exists=True,
    )
    op.create_index(
        'ix_holdings_company_id', 'holdings', ['company_id'],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index('ix_holdings_company_id', table_name='holdings')
    op.drop_index('ix_holdings_investor_id', table_name='holdings')
    op.drop_index('ix_companies_sector', table_name='companies')
    op.drop_index('ix_companies_industry', table_name='companies')
