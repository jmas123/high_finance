"""Create chart_drawings table

Revision ID: 006_chart_drawings
Revises: 005_peer_groups
Create Date: 2026-02-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = '006_chart_drawings'
down_revision = '005_peer_groups'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'chart_drawings',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ticker', sa.String(10), nullable=False),
        sa.Column('drawing_type', sa.String(50), nullable=False),

        # Core data (JSONB for flexibility)
        sa.Column('points', JSONB, nullable=False),       # [{time: unix, price: number}, ...]
        sa.Column('style', JSONB, nullable=False),        # {color, lineWidth, lineStyle, ...}
        sa.Column('text_content', sa.Text(), nullable=True),  # For text annotations

        # State flags
        sa.Column('is_visible', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_locked', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('layer_order', sa.Integer(), server_default='0', nullable=False),

        # Optimistic concurrency control
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),

        # Soft delete support
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Index for fast lookups by user and ticker
    op.create_index('idx_chart_drawings_user_ticker', 'chart_drawings', ['user_id', 'ticker'])

    # Index for listing drawings by user, ordered by creation date
    op.create_index('idx_chart_drawings_created', 'chart_drawings', ['user_id', sa.text('created_at DESC')])

    # Partial index for visible, non-deleted drawings (most common query)
    op.create_index(
        'idx_chart_drawings_visible',
        'chart_drawings',
        ['user_id', 'ticker'],
        postgresql_where=sa.text('is_visible = TRUE AND is_deleted = FALSE')
    )


def downgrade() -> None:
    op.drop_index('idx_chart_drawings_visible', table_name='chart_drawings')
    op.drop_index('idx_chart_drawings_created', table_name='chart_drawings')
    op.drop_index('idx_chart_drawings_user_ticker', table_name='chart_drawings')
    op.drop_table('chart_drawings')
