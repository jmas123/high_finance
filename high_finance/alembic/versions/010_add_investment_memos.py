"""Add investment_memos table for AI-generated memos

Revision ID: 010_add_investment_memos
Revises: 009_add_performance_indexes
Create Date: 2026-02-07

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '010_add_investment_memos'
down_revision = '009_add_performance_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'investment_memos',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(), nullable=False, index=True),
        sa.Column('ticker', sa.String(), nullable=False, index=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('model_used', sa.String(), nullable=True),
        sa.Column('input_tokens', sa.Integer(), nullable=True),
        sa.Column('output_tokens', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('investment_memos')
