import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.database import get_session
from app.main import app


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    def override_get_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_auth_lifecycle(client):
    signup = client.post(
        "/api/signup",
        json={"email": "alice@example.com", "password": "secret"},
    )
    assert signup.status_code == 201
    assert signup.json()["email"] == "alice@example.com"
    assert "hashed_password" not in signup.json()

    me = client.get("/api/me")
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"

    logout = client.post("/api/logout")
    assert logout.status_code == 200
    assert client.get("/api/me").status_code == 401

    login = client.post(
        "/api/login",
        json={"email": "alice@example.com", "password": "secret"},
    )
    assert login.status_code == 200
    assert login.json()["email"] == "alice@example.com"
    assert client.get("/api/me").status_code == 200


def test_habits_are_isolated_between_users(client):
    first = client.post(
        "/api/signup",
        json={"email": "first@example.com", "password": "secret"},
    )
    assert first.status_code == 201
    habit = client.post(
        "/api/habits", json={"name": "Private", "frequency": "daily"}
    )
    assert habit.status_code == 200

    client.post("/api/logout")
    second = client.post(
        "/api/signup",
        json={"email": "second@example.com", "password": "secret"},
    )
    assert second.status_code == 201

    habit_id = habit.json()["id"]
    assert client.get("/api/habits").json() == []
    assert client.get(f"/api/habits/{habit_id}/history").status_code == 404
    assert client.post(f"/api/habits/{habit_id}/log").status_code == 404
    assert client.patch(
        f"/api/habits/{habit_id}", json={"name": "Stolen"}
    ).status_code == 404
    assert client.post(f"/api/habits/{habit_id}/archive").status_code == 404
    assert client.delete(f"/api/habits/{habit_id}").status_code == 404
    assert client.patch("/api/habits/reorder", json=[habit_id]).status_code == 404


def test_all_habit_routes_require_authentication(client):
    requests = [
        ("get", "/api/habits", None),
        ("get", "/api/habits/today", None),
        ("post", "/api/habits", {"name": "Read", "frequency": "daily"}),
        ("get", "/api/habits/1/history", None),
        ("patch", "/api/habits/reorder", [1]),
        ("patch", "/api/habits/1", {"name": "Read"}),
        ("post", "/api/habits/1/archive", None),
        ("delete", "/api/habits/1", None),
        ("post", "/api/habits/1/log", None),
    ]
    for method, path, body in requests:
        response = getattr(client, method)(path, json=body) if body is not None else getattr(client, method)(path)
        assert response.status_code == 401
