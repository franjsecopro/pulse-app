"""notifications.class_id ON DELETE CASCADE

Deleting a class failed with a ForeignKeyViolationError when the class had an
associated notification (reminder), because notifications.class_id had no cascade.
A notification cannot exist without its class, so the FK is recreated with
ON DELETE CASCADE — fixing both the single-class delete and the bulk
delete_future_contract_classes paths.

Revision ID: 0018
Revises: 0017
Create Date: 2026-06-03
"""
from alembic import op

revision = '0018'
down_revision = '0017'
branch_labels = None
depends_on = None

_FK = 'notifications_class_id_fkey'


def upgrade() -> None:
    op.drop_constraint(_FK, 'notifications', type_='foreignkey')
    op.create_foreign_key(
        _FK, 'notifications', 'classes',
        ['class_id'], ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint(_FK, 'notifications', type_='foreignkey')
    op.create_foreign_key(
        _FK, 'notifications', 'classes',
        ['class_id'], ['id'],
    )
