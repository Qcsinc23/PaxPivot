"""Explicit supersession integrity (TASK-026, ADR-004): a superseding observation must name an
existing observation of the SAME source and never itself. Rows are append-only, so a superseder
can only reference a row that already exists, which makes a cycle impossible without any graph
machinery."""

from alembic import op

revision = "0003_supersession_integrity"
down_revision = "0002_sources_terminals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        op.f("fk_source_observations_supersedes_observation_id_source_observations"),
        "source_observations",
        type_="foreignkey",
    )
    op.create_unique_constraint(
        op.f("uq_source_observations_observation_source"),
        "source_observations",
        ["observation_id", "source_id"],
    )
    op.create_foreign_key(
        "fk_source_observations_supersedes_same_source",
        "source_observations",
        "source_observations",
        ["supersedes_observation_id", "source_id"],
        ["observation_id", "source_id"],
    )
    op.create_check_constraint(
        op.f("ck_source_observations_supersedes_not_self"),
        "source_observations",
        "supersedes_observation_id IS NULL OR supersedes_observation_id <> observation_id",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("ck_source_observations_supersedes_not_self"), "source_observations", type_="check"
    )
    op.drop_constraint(
        "fk_source_observations_supersedes_same_source", "source_observations", type_="foreignkey"
    )
    op.drop_constraint(
        op.f("uq_source_observations_observation_source"), "source_observations", type_="unique"
    )
    op.create_foreign_key(
        op.f("fk_source_observations_supersedes_observation_id_source_observations"),
        "source_observations",
        "source_observations",
        ["supersedes_observation_id"],
        ["observation_id"],
    )
