from sqlalchemy import create_engine, event, MetaData
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings
import os

DATABASE_SCHEMA = os.getenv("DATABASE_SCHEMA", "sede_sorocaba")

connect_args = {}
if DATABASE_SCHEMA and not settings.DATABASE_URL.startswith("sqlite"):
    connect_args["options"] = f"-c search_path={DATABASE_SCHEMA},public"

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args=connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
metadata = MetaData(schema=DATABASE_SCHEMA)
Base = declarative_base(metadata=metadata)

@event.listens_for(Base.metadata, "column_reflect")
def _reflect_schema(inspector, table, column_info):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
