"""Trip requests (TASK-034): what the traveler asked for; no eligibility, route or probability."""

import sqlalchemy as sa
from alembic import op

revision = "0004_trip_requests"
down_revision = "0003_supersession_integrity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trip_requests",
        sa.Column("trip_id", sa.Uuid(), nullable=False),
        sa.Column("origin_terminal_id", sa.Uuid(), nullable=False),
        sa.Column("destination_text", sa.Text(), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("party_size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("window_end > window_start", name=op.f("ck_trip_requests_window_order")),
        sa.CheckConstraint(
            "window_end - window_start <= interval '30 days'",
            name=op.f("ck_trip_requests_window_span"),
        ),
        sa.CheckConstraint("party_size BETWEEN 1 AND 9", name=op.f("ck_trip_requests_party_size")),
        sa.CheckConstraint(
            "length(btrim(destination_text)) > 0", name=op.f("ck_trip_requests_destination_present")
        ),
        sa.ForeignKeyConstraint(
            ["origin_terminal_id"],
            ["terminals.terminal_id"],
            name=op.f("fk_trip_requests_origin_terminal_id_terminals"),
        ),
        sa.PrimaryKeyConstraint("trip_id", name=op.f("pk_trip_requests")),
    )
    op.create_index("ix_trip_requests_created_at", "trip_requests", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_trip_requests_created_at", table_name="trip_requests")
    op.drop_table("trip_requests")
