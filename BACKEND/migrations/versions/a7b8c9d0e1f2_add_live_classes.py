"""add live_classes and live_class_attendance tables

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-08-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a7b8c9d0e1f2'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('live_classes',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('course_id', sa.String(length=36), nullable=False),
    sa.Column('host_id', sa.String(length=36), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('room_slug', sa.String(length=64), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ),
    sa.ForeignKeyConstraint(['host_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('room_slug')
    )
    with op.batch_alter_table('live_classes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_live_classes_course_id'), ['course_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_live_classes_status'), ['status'], unique=False)

    op.create_table('live_class_attendance',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('live_class_id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('joined_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('left_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['live_class_id'], ['live_classes.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('live_class_attendance', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_live_class_attendance_live_class_id'), ['live_class_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_live_class_attendance_user_id'), ['user_id'], unique=False)


def downgrade():
    with op.batch_alter_table('live_class_attendance', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_live_class_attendance_user_id'))
        batch_op.drop_index(batch_op.f('ix_live_class_attendance_live_class_id'))
    op.drop_table('live_class_attendance')

    with op.batch_alter_table('live_classes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_live_classes_status'))
        batch_op.drop_index(batch_op.f('ix_live_classes_course_id'))
    op.drop_table('live_classes')
