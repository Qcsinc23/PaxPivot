"""Sources + Terminals slice: registry, processing policy, immutable observations, facts,
kill switches (ADR-004). Observations and facts are append-only via trigger."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision = "0002_sources_terminals"
down_revision = "0001_postgis"
branch_labels = None
depends_on = None


def _tz() -> sa.DateTime:
    return sa.DateTime(timezone=True)


SOURCE_STATES = (
    "fresh",
    "source_stale",
    "source_unreachable",
    "source_changed_unparsed",
    "source_missing",
    "source_conflict",
    "monitor_delayed",
    "no_departures_published",
    "no_compatible_opportunity",
    "restricted_user_open_only",
    "parser_review_required",
    "superseded",
    "withdrawn",
)


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def upgrade() -> None:
    op.create_table(
        "terminals",
        sa.Column("terminal_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("installation", sa.Text(), nullable=True),
        sa.Column("timezone", sa.Text(), nullable=False),
        sa.Column("operational_state", sa.Text(), nullable=False),
        sa.Column("base_latitude", sa.Double(), nullable=True),
        sa.Column("base_longitude", sa.Double(), nullable=True),
        sa.Column("entrance_kind", sa.Text(), nullable=True),
        sa.Column("entrance_latitude", sa.Double(), nullable=True),
        sa.Column("entrance_longitude", sa.Double(), nullable=True),
        sa.Column("entrance_instructions", sa.Text(), nullable=True),
        sa.Column("entrance_source_id", sa.Uuid(), nullable=True),
        sa.Column("entrance_source_url", sa.Text(), nullable=True),
        sa.Column("entrance_source_authority", sa.Text(), nullable=True),
        sa.Column("entrance_observed_at", _tz(), nullable=True),
        sa.Column("entrance_source_time", _tz(), nullable=True),
        sa.Column("entrance_provider_id", sa.Text(), nullable=True),
        sa.Column("entrance_policy_version_id", sa.Text(), nullable=True),
        sa.Column("evidence_source_id", sa.Uuid(), nullable=False),
        sa.Column("evidence_source_url", sa.Text(), nullable=False),
        sa.Column("evidence_source_authority", sa.Text(), nullable=False),
        sa.Column("evidence_observed_at", _tz(), nullable=False),
        sa.Column("evidence_source_time", _tz(), nullable=True),
        sa.Column("evidence_provider_id", sa.Text(), nullable=False),
        sa.Column("evidence_policy_version_id", sa.Text(), nullable=False),
        sa.Column("created_at", _tz(), nullable=False),
        sa.Column("updated_at", _tz(), nullable=False),
        sa.CheckConstraint(
            _in("operational_state", ("verified", "unknown", "conflict", "ended")),
            name="operational_state",
        ),
        sa.CheckConstraint(
            "(base_latitude IS NULL) = (base_longitude IS NULL)", name="base_coordinates_pair"
        ),
        sa.CheckConstraint(
            "entrance_kind IS NULL OR "
            + _in("entrance_kind", ("passenger_terminal", "visitor_center", "documented_gate")),
            name="entrance_kind",
        ),
        sa.CheckConstraint(
            "(entrance_kind IS NULL) = (entrance_latitude IS NULL) AND "
            "(entrance_kind IS NULL) = (entrance_longitude IS NULL) AND "
            "(entrance_kind IS NULL) = (entrance_instructions IS NULL) AND "
            "(entrance_kind IS NULL) = (entrance_source_id IS NULL) AND "
            "(entrance_kind IS NULL) = (entrance_source_url IS NULL) AND "
            "(entrance_kind IS NULL) = (entrance_source_authority IS NULL) AND "
            "(entrance_kind IS NULL) = (entrance_observed_at IS NULL) AND "
            "(entrance_kind IS NULL) = (entrance_provider_id IS NULL) AND "
            "(entrance_kind IS NULL) = (entrance_policy_version_id IS NULL)",
            name="entrance_all_or_nothing",
        ),
        sa.PrimaryKeyConstraint("terminal_id", name=op.f("pk_terminals")),
    )
    op.create_table(
        "sources",
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("authority", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("terminal_id", sa.Uuid(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("cadence_minutes", sa.Integer(), nullable=True),
        sa.Column("adapter_id", sa.Text(), nullable=True),
        sa.Column("adapter_version", sa.Text(), nullable=True),
        sa.Column("policy_version_id", sa.Text(), nullable=False),
        sa.Column("review_state", sa.Text(), nullable=False),
        sa.Column("may_retrieve", sa.Boolean(), nullable=False),
        sa.Column("may_parse", sa.Boolean(), nullable=False),
        sa.Column("may_summarize", sa.Boolean(), nullable=False),
        sa.Column("may_display", sa.Boolean(), nullable=False),
        sa.Column("may_aggregate_history", sa.Boolean(), nullable=False),
        sa.Column("raw_payload", sa.Text(), nullable=False),
        sa.Column("snapshot_retention_days", sa.Integer(), nullable=True),
        sa.Column("reviewer", sa.Text(), nullable=True),
        sa.Column("reviewed_at", _tz(), nullable=True),
        sa.Column("created_at", _tz(), nullable=False),
        sa.Column("updated_at", _tz(), nullable=False),
        sa.CheckConstraint(
            _in(
                "kind", ("terminal_page", "schedule_artifact", "directory_page", "policy_document")
            ),
            name="kind",
        ),
        sa.CheckConstraint(
            _in("review_state", ("approved", "needs_review", "paused", "restricted")),
            name="review_state",
        ),
        sa.CheckConstraint(
            _in("raw_payload", ("denied", "hash_only", "snapshot")), name="raw_payload"
        ),
        sa.CheckConstraint(
            "cadence_minutes IS NULL OR cadence_minutes > 0", name="cadence_positive"
        ),
        sa.CheckConstraint(
            "(raw_payload = 'snapshot') = (snapshot_retention_days IS NOT NULL)",
            name="snapshot_retention",
        ),
        sa.CheckConstraint(
            "review_state <> 'approved' OR (reviewer IS NOT NULL AND reviewed_at IS NOT NULL)",
            name="approval_reviewed",
        ),
        sa.ForeignKeyConstraint(
            ["terminal_id"],
            ["terminals.terminal_id"],
            name=op.f("fk_sources_terminal_id_terminals"),
        ),
        sa.PrimaryKeyConstraint("source_id", name=op.f("pk_sources")),
        sa.UniqueConstraint("url", name=op.f("uq_sources_url")),
    )
    op.create_foreign_key(
        op.f("fk_terminals_entrance_source_id_sources"),
        "terminals",
        "sources",
        ["entrance_source_id"],
        ["source_id"],
    )
    op.create_foreign_key(
        op.f("fk_terminals_evidence_source_id_sources"),
        "terminals",
        "sources",
        ["evidence_source_id"],
        ["source_id"],
    )
    op.create_table(
        "source_observations",
        sa.Column("observation_id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_authority", sa.Text(), nullable=False),
        sa.Column("observed_at", _tz(), nullable=False),
        sa.Column("source_time", _tz(), nullable=True),
        sa.Column("provider_id", sa.Text(), nullable=False),
        sa.Column("policy_version_id", sa.Text(), nullable=False),
        sa.Column("state", sa.Text(), nullable=False),
        sa.Column("retrieval", sa.Text(), nullable=False),
        sa.Column("extraction", sa.Text(), nullable=False),
        sa.Column("parser_version", sa.Text(), nullable=True),
        sa.Column("content_hash", sa.Text(), nullable=True),
        sa.Column("confidence_reasons", ARRAY(sa.Text()), nullable=False),
        sa.Column("payload_ref", sa.Text(), nullable=True),
        sa.Column("supersedes_observation_id", sa.Uuid(), nullable=True),
        sa.Column("recorded_at", _tz(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(_in("state", SOURCE_STATES), name="state"),
        sa.CheckConstraint(
            _in("retrieval", ("succeeded", "failed", "not_attempted")), name="retrieval"
        ),
        sa.CheckConstraint(
            _in("extraction", ("not_attempted", "exact_text", "human_reviewed", "failed")),
            name="extraction",
        ),
        sa.CheckConstraint(
            "state NOT IN ('fresh', 'no_departures_published', 'no_compatible_opportunity') "
            "OR retrieval = 'succeeded'",
            name="positive_requires_retrieval",
        ),
        sa.CheckConstraint(
            "payload_ref IS NULL OR retrieval = 'succeeded'", name="payload_retrieved"
        ),
        sa.CheckConstraint("cardinality(confidence_reasons) > 0", name="reasons_present"),
        sa.ForeignKeyConstraint(
            ["source_id"],
            ["sources.source_id"],
            name=op.f("fk_source_observations_source_id_sources"),
        ),
        sa.ForeignKeyConstraint(
            ["supersedes_observation_id"],
            ["source_observations.observation_id"],
            name=op.f("fk_source_observations_supersedes_observation_id_source_observations"),
        ),
        sa.PrimaryKeyConstraint("observation_id", name=op.f("pk_source_observations")),
    )
    op.create_index(
        "ix_source_observations_source_id_observed_at",
        "source_observations",
        ["source_id", "observed_at"],
    )
    op.create_table(
        "terminal_facts",
        sa.Column("fact_id", sa.Uuid(), nullable=False),
        sa.Column("terminal_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_authority", sa.Text(), nullable=False),
        sa.Column("observed_at", _tz(), nullable=False),
        sa.Column("source_time", _tz(), nullable=True),
        sa.Column("provider_id", sa.Text(), nullable=False),
        sa.Column("policy_version_id", sa.Text(), nullable=False),
        sa.Column("effective_from", _tz(), nullable=True),
        sa.Column("effective_to", _tz(), nullable=True),
        sa.Column("recorded_at", _tz(), nullable=False),
        sa.CheckConstraint(
            _in(
                "kind",
                (
                    "counter_hours",
                    "phone",
                    "email",
                    "parking",
                    "passenger_terminal_note",
                    "uso_availability",
                    "access_note",
                ),
            ),
            name="kind",
        ),
        sa.CheckConstraint(
            "effective_from IS NULL OR effective_to IS NULL OR effective_to > effective_from",
            name="validity_window",
        ),
        sa.ForeignKeyConstraint(
            ["source_id"], ["sources.source_id"], name=op.f("fk_terminal_facts_source_id_sources")
        ),
        sa.ForeignKeyConstraint(
            ["terminal_id"],
            ["terminals.terminal_id"],
            name=op.f("fk_terminal_facts_terminal_id_terminals"),
        ),
        sa.PrimaryKeyConstraint("fact_id", name=op.f("pk_terminal_facts")),
    )
    op.create_index(
        "ix_terminal_facts_terminal_id_kind_recorded_at",
        "terminal_facts",
        ["terminal_id", "kind", "recorded_at"],
    )
    op.create_table(
        "processing_switches",
        sa.Column("switch_id", sa.Uuid(), nullable=False),
        sa.Column("scope", sa.Text(), nullable=False),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("engaged_at", _tz(), nullable=False),
        sa.Column("released_at", _tz(), nullable=True),
        sa.CheckConstraint(_in("scope", ("source", "adapter", "mode")), name="scope"),
        sa.CheckConstraint(
            "released_at IS NULL OR released_at >= engaged_at", name="release_after"
        ),
        sa.PrimaryKeyConstraint("switch_id", name=op.f("pk_processing_switches")),
    )
    # Append-only history: no row in these tables can be updated or deleted, by anyone.
    op.execute(
        "CREATE FUNCTION paxpivot_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ "
        "BEGIN RAISE EXCEPTION 'append-only table %: rows cannot be updated or deleted', "
        "TG_TABLE_NAME; END $$"
    )
    for table in ("source_observations", "terminal_facts"):
        op.execute(
            f"CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION paxpivot_append_only()"
        )


def downgrade() -> None:
    op.drop_table("processing_switches")
    op.drop_index("ix_terminal_facts_terminal_id_kind_recorded_at", table_name="terminal_facts")
    op.drop_table("terminal_facts")
    op.drop_index("ix_source_observations_source_id_observed_at", table_name="source_observations")
    op.drop_table("source_observations")
    op.execute("DROP FUNCTION paxpivot_append_only()")
    op.drop_constraint(
        op.f("fk_terminals_evidence_source_id_sources"), "terminals", type_="foreignkey"
    )
    op.drop_constraint(
        op.f("fk_terminals_entrance_source_id_sources"), "terminals", type_="foreignkey"
    )
    op.drop_table("sources")
    op.drop_table("terminals")
