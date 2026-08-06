"""merge live_classes and course_status/focus_removal branches

Revision ID: bf1851629b69
Revises: 54e399c299dd, a7b8c9d0e1f2
Create Date: 2026-08-06 18:42:57.704383

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bf1851629b69'
down_revision = ('54e399c299dd', 'a7b8c9d0e1f2')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
