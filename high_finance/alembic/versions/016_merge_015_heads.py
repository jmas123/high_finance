"""Merge two competing 015 migration heads.

Revision ID: 016_merge_015_heads
Revises: 015_add_peer_group_unique_constraints, 015_prices_volume_bigint
Create Date: 2026-02-11
"""

revision = "016_merge_015_heads"
down_revision = ("015_add_peer_group_unique_constraints", "015_prices_volume_bigint")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
