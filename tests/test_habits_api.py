from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.database import get_session
from app.main import app


@pytest.fixture()
def client():
    """Provide an authenticated TestClient backed by fresh in-memory SQLite."""
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
        signup = test_client.post(
            "/api/signup",
            json={"email": "test@example.com", "password": "test-password"},
        )
        assert signup.status_code == 201
        yield test_client
    app.dependency_overrides.clear()


def test_today_returns_scheduled_habits_with_streaks(client):
    habit = client.post(
        "/api/habits", json={"name": "Read", "frequency": "daily"}
    ).json()

    response = client.post(f"/api/habits/{habit['id']}/log")
    assert response.status_code == 200

    response = client.get("/api/habits/today")
    assert response.status_code == 200
    habits = response.json()
    assert len(habits) == 1
    assert habits[0]["id"] == habit["id"]
    assert habits[0]["completed_today"] is True
    assert habits[0]["current_streak"] == 1
    assert habits[0]["best_streak"] == 1


def test_today_excludes_archived_habits(client):
    active = client.post(
        "/api/habits", json={"name": "Daily", "frequency": "daily"}
    ).json()
    archived = client.post(
        "/api/habits", json={"name": "Paused", "frequency": "daily"}
    ).json()
    client.post(f"/api/habits/{archived['id']}/archive")

    response = client.get("/api/habits/today")
    assert response.status_code == 200
    ids = {habit["id"] for habit in response.json()}
    assert active["id"] in ids
    assert archived["id"] not in ids


def test_today_respects_weekdays_schedule(client):
    habit = client.post(
        "/api/habits", json={"name": "Weekday habit", "frequency": "weekdays"}
    ).json()

    response = client.get("/api/habits/today")
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()}

    if date.today().weekday() < 5:
        assert habit["id"] in ids
    else:
        assert habit["id"] not in ids


def test_log_creates_then_deletes_today_log_and_refreshes_streaks(client):
    habit = client.post(
        "/api/habits", json={"name": "Walk", "frequency": "daily"}
    ).json()
    habit_id = habit["id"]

    first = client.post(f"/api/habits/{habit_id}/log")
    assert first.status_code == 200
    assert first.json()["completed_today"] is True
    assert first.json()["current_streak"] == 1
    assert first.json()["best_streak"] == 1

    second = client.post(f"/api/habits/{habit_id}/log")
    assert second.status_code == 200
    assert second.json()["completed_today"] is False
    assert second.json()["current_streak"] == 0
    assert second.json()["best_streak"] == 0


def test_log_returns_fresh_streaks_after_existing_history(client):
    habit = client.post(
        "/api/habits", json={"name": "Practice", "frequency": "daily"}
    ).json()

    first = client.post(f"/api/habits/{habit['id']}/log")
    assert first.json()["current_streak"] == 1
    assert first.json()["best_streak"] == 1

    second = client.post(f"/api/habits/{habit['id']}/log")
    assert second.json()["completed_today"] is False
    assert second.json()["current_streak"] == 0
    assert second.json()["best_streak"] == 0
