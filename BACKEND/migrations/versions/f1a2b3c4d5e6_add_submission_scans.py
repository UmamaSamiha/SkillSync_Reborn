"""add submission_scans table

Revision ID: f1a2b3c4d5e6
Revises: e2f3a4b5c6d7
Create Date: 2026-04-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f1a2b3c4d5e6'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('submission_scans',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('submission_id', sa.String(length=36), nullable=False),
    sa.Column('ai_score', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('similarity_score', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=True),
    sa.Column('scanned_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('submission_scans', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_submission_scans_submission_id'), ['submission_id'], unique=False)


def downgrade():
    with op.batch_alter_table('submission_scans', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_submission_scans_submission_id'))
    op.drop_table('submission_scans')
