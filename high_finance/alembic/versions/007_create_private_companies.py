"""Create private_companies and private_company_investors tables

Revision ID: 007_private_companies
Revises: 006_chart_drawings
Create Date: 2026-02-06

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '007_private_companies'
down_revision = '006_chart_drawings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Private Companies ─────────────────────────────────────────────────
    op.create_table(
        'private_companies',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('slug', sa.String(100), nullable=False, unique=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sector', sa.String(100), nullable=True),
        sa.Column('founded_year', sa.Integer(), nullable=True),
        sa.Column('hq_location', sa.String(200), nullable=True),
        sa.Column('website', sa.String(500), nullable=True),
        sa.Column('latest_valuation', sa.Float(), nullable=True),
        sa.Column('valuation_date', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), server_default='private', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_index('idx_private_companies_slug', 'private_companies', ['slug'], unique=True)
    op.create_index('idx_private_companies_status', 'private_companies', ['status'])

    # ── Private Company Investors ─────────────────────────────────────────
    op.create_table(
        'private_company_investors',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('private_company_id', sa.Integer(),
                  sa.ForeignKey('private_companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('investor_name', sa.String(200), nullable=False),
        sa.Column('investor_type', sa.String(50), nullable=False),
        sa.Column('public_ticker', sa.String(10), nullable=True),
        sa.Column('round_or_context', sa.String(200), nullable=True),
        sa.Column('investment_amount', sa.Float(), nullable=True),
        sa.Column('investment_date', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),

        sa.UniqueConstraint('private_company_id', 'investor_name',
                            name='uq_private_company_investor'),
    )

    op.create_index('idx_pci_company', 'private_company_investors', ['private_company_id'])
    op.create_index('idx_pci_public_ticker', 'private_company_investors', ['public_ticker'])


def downgrade() -> None:
    op.drop_index('idx_pci_public_ticker', table_name='private_company_investors')
    op.drop_index('idx_pci_company', table_name='private_company_investors')
    op.drop_table('private_company_investors')

    op.drop_index('idx_private_companies_status', table_name='private_companies')
    op.drop_index('idx_private_companies_slug', table_name='private_companies')
    op.drop_table('private_companies')
