"""Private traveler/party profile (TASK-050, PRV-001, ADR-009): the pilot's one party.

`profile` is a database-enforced singleton (a unique constraint on a column CHECKed to always be
`true`, so a second row of any `profile_id` collides). `profile_travelers` stores exactly what
eligibility needs per traveler: role, category attestation, age band and a dependent's sponsor
reference. No name, credential number, medical/disability data, document, full birth date or
free-text column exists here or may be added without a task/ADR.
"""

import sqlalchemy as sa
from alembic import op

revision = "0006_traveler_profile"
down_revision = "0005_restricted_allows_nothing"
branch_labels = None
depends_on = None

ROLES = ("sponsor", "dependent")
CATEGORY_ATTESTATIONS = ("I", "II", "III", "IV", "V", "VI", "unknown")
AGE_BANDS = ("under_14", "minor_14_or_older", "adult", "unknown")
MAX_PARTY_SIZE = 9


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def _tz() -> sa.DateTime:
    return sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "profile",
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("singleton", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", _tz(), nullable=False),
        sa.Column("updated_at", _tz(), nullable=False),
        sa.CheckConstraint("singleton", name=op.f("ck_profile_singleton")),
        sa.PrimaryKeyConstraint("profile_id", name=op.f("pk_profile")),
        sa.UniqueConstraint("singleton", name=op.f("uq_profile_singleton")),
    )
    op.create_table(
        "profile_travelers",
        sa.Column("traveler_id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("category_attestation", sa.Text(), nullable=False),
        sa.Column("age_band", sa.Text(), nullable=False),
        sa.Column("sponsor_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint(_in("role", ROLES), name=op.f("ck_profile_travelers_role")),
        sa.CheckConstraint(
            _in("category_attestation", CATEGORY_ATTESTATIONS),
            name=op.f("ck_profile_travelers_category_attestation"),
        ),
        sa.CheckConstraint(_in("age_band", AGE_BANDS), name=op.f("ck_profile_travelers_age_band")),
        sa.CheckConstraint(
            "(role = 'sponsor') = (sponsor_id IS NULL)",
            name=op.f("ck_profile_travelers_sponsor_null_pairing"),
        ),
        sa.CheckConstraint(
            "sponsor_id IS NULL OR sponsor_id <> traveler_id",
            name=op.f("ck_profile_travelers_no_self_sponsor"),
        ),
        sa.ForeignKeyConstraint(
            ["profile_id"],
            ["profile.profile_id"],
            name=op.f("fk_profile_travelers_profile_id_profile"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sponsor_id"],
            ["profile_travelers.traveler_id"],
            name=op.f("fk_profile_travelers_sponsor_id_profile_travelers"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("traveler_id", name=op.f("pk_profile_travelers")),
    )
    op.create_index("ix_profile_travelers_profile_id", "profile_travelers", ["profile_id"])
    # A row-count cap cannot be a CHECK constraint (no CHECK can see other rows); this trigger
    # is the practical DB-level backstop for the same cap `NewParty` enforces at the boundary
    # (matching the trip request's party_size bound). It fires once per statement regardless of
    # how many rows that statement touched, so a bulk replace is checked once, at its final state.
    op.execute(
        "CREATE FUNCTION paxpivot_profile_party_cap() RETURNS trigger LANGUAGE plpgsql AS $$ "
        "BEGIN "
        "IF (SELECT count(*) FROM profile_travelers) > "
        f"{MAX_PARTY_SIZE} THEN RAISE EXCEPTION "
        f"'party exceeds the maximum of {MAX_PARTY_SIZE} travelers' "
        "USING ERRCODE = '23514', CONSTRAINT = 'ck_profile_travelers_party_size'; "
        "END IF; RETURN NULL; END $$"
    )
    op.execute(
        "CREATE TRIGGER profile_travelers_party_cap AFTER INSERT ON profile_travelers "
        "FOR EACH STATEMENT EXECUTE FUNCTION paxpivot_profile_party_cap()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER profile_travelers_party_cap ON profile_travelers")
    op.execute("DROP FUNCTION paxpivot_profile_party_cap()")
    op.drop_index("ix_profile_travelers_profile_id", table_name="profile_travelers")
    op.drop_table("profile_travelers")
    op.drop_table("profile")
