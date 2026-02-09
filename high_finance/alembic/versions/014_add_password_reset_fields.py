"""Add password_reset_token and password_reset_expires to users table

Revision ID: 014_add_password_reset_fields
Revises: 013_add_account_lockout
Create Date: 2026-02-09

"""
import sqlalchemy as sa
from alembic import op

revision = "014_add_password_reset_fields"
down_revision = "013_add_account_lockout"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_reset_token", sa.String(), nullable=True))
    op.add_column("users", sa.Column("password_reset_expires", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_reset_expires")
    op.drop_column("users", "password_reset_token")
