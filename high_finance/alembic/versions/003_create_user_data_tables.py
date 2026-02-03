"""Create user data tables (watchlist, portfolio)

Revision ID: 003_user_data
Revises: 002_users
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003_user_data'
down_revision = '002_users'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Watchlist items
    op.create_table(
        'watchlist_items',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ticker', sa.String(10), nullable=False),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_watchlist_items_user_id', 'watchlist_items', ['user_id'])
    op.create_index('idx_watchlist_user_ticker', 'watchlist_items', ['user_id', 'ticker'], unique=True)

    # Portfolio positions
    op.create_table(
        'portfolio_positions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ticker', sa.String(10), nullable=False),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('shares', sa.Float(), nullable=False),
        sa.Column('avg_cost', sa.Float(), nullable=False),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_portfolio_positions_user_id', 'portfolio_positions', ['user_id'])
    op.create_index('idx_portfolio_user_ticker', 'portfolio_positions', ['user_id', 'ticker'], unique=True)


def downgrade() -> None:
    op.drop_index('idx_portfolio_user_ticker', table_name='portfolio_positions')
    op.drop_index('idx_portfolio_positions_user_id', table_name='portfolio_positions')
    op.drop_table('portfolio_positions')

    op.drop_index('idx_watchlist_user_ticker', table_name='watchlist_items')
    op.drop_index('idx_watchlist_items_user_id', table_name='watchlist_items')
    op.drop_table('watchlist_items')
