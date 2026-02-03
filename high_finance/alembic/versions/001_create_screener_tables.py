"""Create screener tables

Revision ID: 001_screener
Revises:
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_screener'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create screener_universe table
    op.create_table(
        'screener_universe',
        sa.Column('ticker', sa.String(10), primary_key=True),
        sa.Column('company_name', sa.String(255)),
        sa.Column('sector', sa.String(100)),
        sa.Column('industry', sa.String(100)),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('added_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('idx_screener_universe_sector', 'screener_universe', ['sector'])

    # Create screener_cache table
    op.create_table(
        'screener_cache',
        sa.Column('ticker', sa.String(10), sa.ForeignKey('screener_universe.ticker', ondelete='CASCADE'), primary_key=True),
        sa.Column('market_cap', sa.BigInteger()),
        sa.Column('current_price', sa.Numeric(12, 4)),
        sa.Column('price_change_1d', sa.Numeric(8, 4)),
        sa.Column('pe_ratio', sa.Numeric(10, 2)),
        sa.Column('forward_pe', sa.Numeric(10, 2)),
        sa.Column('pb_ratio', sa.Numeric(10, 2)),
        sa.Column('ev_to_ebitda', sa.Numeric(10, 2)),
        sa.Column('revenue_growth', sa.Numeric(8, 4)),
        sa.Column('dividend_yield', sa.Numeric(8, 4)),
        sa.Column('price_vs_200ma', sa.Numeric(8, 4)),
        sa.Column('price_vs_52w_high', sa.Numeric(8, 4)),
        sa.Column('insider_net_shares_90d', sa.Integer(), server_default='0'),
        sa.Column('insider_buys_90d', sa.Integer(), server_default='0'),
        sa.Column('insider_sells_90d', sa.Integer(), server_default='0'),
        sa.Column('congress_net_value_90d', sa.Integer(), server_default='0'),
        sa.Column('congress_buys_90d', sa.Integer(), server_default='0'),
        sa.Column('congress_sells_90d', sa.Integer(), server_default='0'),
        sa.Column('cached_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Create indexes on screener_cache
    op.create_index('idx_screener_cache_market_cap', 'screener_cache', ['market_cap'])
    op.execute("""
        CREATE INDEX idx_screener_cache_pe
        ON screener_cache(pe_ratio)
        WHERE pe_ratio IS NOT NULL
    """)
    op.execute("""
        CREATE INDEX idx_screener_cache_insider
        ON screener_cache(insider_net_shares_90d)
        WHERE insider_net_shares_90d != 0
    """)
    op.execute("""
        CREATE INDEX idx_screener_cache_congress
        ON screener_cache(congress_net_value_90d)
        WHERE congress_net_value_90d != 0
    """)
    op.create_index('idx_screener_cache_value_screen', 'screener_cache',
                    ['pe_ratio', 'revenue_growth', 'market_cap'])

    # Create saved_screens table
    op.create_table(
        'saved_screens',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('owner_id', sa.String(100), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('filters', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('last_run_at', sa.DateTime(), nullable=True),
        sa.Column('last_result_count', sa.Integer(), nullable=True),
    )
    op.create_index('idx_saved_screens_owner', 'saved_screens', ['owner_id'])


def downgrade() -> None:
    op.drop_table('saved_screens')
    op.drop_index('idx_screener_cache_value_screen', table_name='screener_cache')
    op.drop_index('idx_screener_cache_congress', table_name='screener_cache')
    op.drop_index('idx_screener_cache_insider', table_name='screener_cache')
    op.drop_index('idx_screener_cache_pe', table_name='screener_cache')
    op.drop_index('idx_screener_cache_market_cap', table_name='screener_cache')
    op.drop_table('screener_cache')
    op.drop_index('idx_screener_universe_sector', table_name='screener_universe')
    op.drop_table('screener_universe')
