"""Create job_executions table

Revision ID: 004_job_executions
Revises: 003_user_data
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = '004_job_executions'
down_revision = '003_user_data'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'job_executions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('job_id', sa.String(255), unique=True, index=True, nullable=False),
        sa.Column('job_name', sa.String(100), index=True, nullable=False),
        sa.Column('status', sa.String(20), index=True, nullable=False, server_default='pending'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('result_summary', JSONB, nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
    )
    # Index for finding recent jobs by name
    op.create_index(
        'idx_job_executions_name_started',
        'job_executions',
        ['job_name', 'started_at'],
    )


def downgrade() -> None:
    op.drop_index('idx_job_executions_name_started', table_name='job_executions')
    op.drop_table('job_executions')
