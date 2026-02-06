"""Create peer_groups table

Revision ID: 005_peer_groups
Revises: 004_job_executions
Create Date: 2026-02-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

# revision identifiers, used by Alembic.
revision = '005_peer_groups'
down_revision = '004_job_executions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'peer_groups',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ticker', sa.String(10), nullable=True),  # NULL = user-level group, not ticker-specific
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('peer_tickers', ARRAY(sa.String(10)), nullable=False),
        sa.Column('is_default', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),

        # Unique constraint: (user_id, ticker, name) to prevent duplicate group names per user per ticker
        sa.UniqueConstraint('user_id', 'ticker', 'name', name='uq_peer_groups_user_ticker_name'),
    )

    # Index for fast lookups by user
    op.create_index('idx_peer_groups_user_id', 'peer_groups', ['user_id'])

    # Partial index for ticker-specific groups
    op.create_index(
        'idx_peer_groups_ticker',
        'peer_groups',
        ['ticker'],
        postgresql_where=sa.text('ticker IS NOT NULL')
    )


def downgrade() -> None:
    op.drop_index('idx_peer_groups_ticker', table_name='peer_groups')
    op.drop_index('idx_peer_groups_user_id', table_name='peer_groups')
    op.drop_table('peer_groups')
