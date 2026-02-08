"""Add analysis_type column to investment_memos

Revision ID: 011_add_analysis_type_to_memos
Revises: 010_add_investment_memos
Create Date: 2026-02-07

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '011_add_analysis_type_to_memos'
down_revision = '010_add_investment_memos'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'investment_memos',
        sa.Column('analysis_type', sa.String(), server_default='memo', nullable=False),
    )
    op.create_index(
        'ix_memos_user_type_created',
        'investment_memos',
        ['user_id', 'analysis_type', 'created_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_memos_user_type_created', table_name='investment_memos')
    op.drop_column('investment_memos', 'analysis_type')
