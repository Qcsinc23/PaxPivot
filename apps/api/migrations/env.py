import os

from alembic import context
from paxpivot.infrastructure.database import metadata
from sqlalchemy import create_engine, pool, text


def include_object(
    obj: object, name: str | None, type_: str, reflected: bool, compare_to: object
) -> bool:
    # PostGIS-owned relation, not application schema. Do not ignore other tables.
    return not (type_ == "table" and name == "spatial_ref_sys")


with create_engine(os.environ["DATABASE_URL"], poolclass=pool.NullPool).connect() as connection:
    connection.execute(text("SET search_path TO public"))
    connection.commit()
    context.configure(
        connection=connection, target_metadata=metadata, include_object=include_object
    )
    with context.begin_transaction():
        context.run_migrations()
