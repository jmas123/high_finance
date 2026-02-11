"""Change prices.volume from INTEGER to BIGINT for high-volume stocks (e.g. NVDA)

Revision ID: 015_prices_volume_bigint
Revises: 014_add_prices_composite_index
Create Date: 2026-02-10

NOTE: ALTER COLUMN ... TYPE bigint requires an ACCESS EXCLUSIVE lock and a full
table rewrite.  If the API is still serving traffic during the pre-deploy step,
the lock request will queue behind running queries — and block all new queries
behind it — causing an indefinite hang.

We mitigate this with SET lock_timeout so the migration fails fast instead of
hanging forever.  Railway will retry the deploy automatically.
"""
import sqlalchemy as sa
from alembic import op

revision = "015_prices_volume_bigint"
down_revision = "014_add_prices_composite_index"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Fail fast if we can't acquire the exclusive lock within 5 seconds.
    # Without this, the migration hangs indefinitely when the running API
    # holds competing locks on the prices table.
    op.execute(sa.text("SET lock_timeout = '5s'"))
    op.alter_column(
        "prices",
        "volume",
        type_=sa.BigInteger(),
        existing_type=sa.Integer(),
    )


def downgrade() -> None:
    op.execute(sa.text("SET lock_timeout = '5s'"))
    op.alter_column(
        "prices",
        "volume",
        type_=sa.Integer(),
        existing_type=sa.BigInteger(),
    )
