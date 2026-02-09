"""Add failed_login_attempts and locked_until to users table

Revision ID: 013_add_account_lockout
Revises: 012_add_screener_quality_columns
Create Date: 2026-02-09

"""
import sqlalchemy as sa
from alembic import op

revision = "013_add_account_lockout"
down_revision = "012_add_screener_quality_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("failed_login_attempts", sa.Integer(), server_default="0", nullable=False))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")
