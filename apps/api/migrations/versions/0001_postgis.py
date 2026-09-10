"""Baseline: spatial capability only; no speculative product tables."""

from alembic import op

revision = "0001_postgis"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")


def downgrade() -> None:
    # Extension may predate PaxPivot (including the Compose image). Never drop it.
    pass
