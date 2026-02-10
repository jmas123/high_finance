"""Change prices.volume from INTEGER to BIGINT for high-volume stocks (e.g. NVDA)

Revision ID: 015_prices_volume_bigint
Revises: 014_add_prices_composite_index
Create Date: 2026-02-10

"""
import sqlalchemy as sa
from alembic import op

revision = "015_prices_volume_bigint"
down_revision = "014_add_prices_composite_index"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "prices",
        "volume",
        type_=sa.BigInteger(),
        existing_type=sa.Integer(),
    )


def downgrade() -> None:
    op.alter_column(
        "prices",
        "volume",
        type_=sa.Integer(),
        existing_type=sa.BigInteger(),
    )
