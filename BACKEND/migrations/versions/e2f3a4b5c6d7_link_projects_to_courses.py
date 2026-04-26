"""link projects to courses

Revision ID: e2f3a4b5c6d7
Revises: d1c4ccdbd468
Create Date: 2026-04-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'e2f3a4b5c6d7'
down_revision = 'd1c4ccdbd468'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('course_id', sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            'fk_projects_course_id', 'courses', ['course_id'], ['id']
        )
        batch_op.drop_column('course_code')


def downgrade():
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('course_code', sa.String(length=50), nullable=True))
        batch_op.drop_constraint('fk_projects_course_id', type_='foreignkey')
        batch_op.drop_column('course_id')
