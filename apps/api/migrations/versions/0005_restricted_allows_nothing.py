"""TASK-037: a restricted source allows no processing and retains nothing (register = gate)."""

from alembic import op

revision = "0005_restricted_allows_nothing"
down_revision = "0004_trip_requests"
branch_labels = None
depends_on = None

CONDITION = (
    "review_state <> 'restricted' OR (NOT may_retrieve AND NOT may_parse AND NOT may_summarize "
    "AND NOT may_display AND NOT may_aggregate_history AND raw_payload = 'denied')"
)


def upgrade() -> None:
    op.create_check_constraint(op.f("ck_sources_restricted_allows_nothing"), "sources", CONDITION)


def downgrade() -> None:
    op.drop_constraint(op.f("ck_sources_restricted_allows_nothing"), "sources", type_="check")
