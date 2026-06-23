import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["ADMIN_EMAIL"] = "master@teste.com"
os.environ["ADMIN_PASSWORD"] = "senha-master-123"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from app.core import database as database_module
from app.main import app, _seed

# Usa um único engine SQLite em memória compartilhado entre as conexões da app.
test_engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

database_module.engine = test_engine
database_module.SessionLocal = TestSessionLocal

from app.models import Base
Base.metadata.create_all(bind=test_engine)

import app.main as main_module
main_module.SessionLocal = TestSessionLocal
main_module.engine = test_engine

@pytest.fixture(autouse=True)
def _reset_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    _seed()
    yield

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def master_token(client):
    res = client.post("/api/auth/login", json={"email": "master@teste.com", "senha": "senha-master-123"})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]
