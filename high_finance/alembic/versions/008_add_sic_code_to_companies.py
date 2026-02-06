"""Add sic_code column to companies table

Revision ID: 008_add_sic_code_to_companies
Revises: 007_private_companies
Create Date: 2026-02-06

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008_add_sic_code_to_companies'
down_revision = '007_private_companies'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('companies', sa.Column('sic_code', sa.String(4), nullable=True))
    op.create_index('idx_companies_sic_code', 'companies', ['sic_code'])


def downgrade() -> None:
    op.drop_index('idx_companies_sic_code', table_name='companies')
    op.drop_column('companies', 'sic_code')
