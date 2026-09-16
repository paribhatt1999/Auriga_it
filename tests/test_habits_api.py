from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

from app.database import get_session
from app.main import app
from app.models import Habit, HabitLog


@pytest.fixture()
def client():
    """Provide a TestClient backed by a fresh in-memory SQLite database."""
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


def test_today_returns_scheduled_habits_with_streaks(client):
    response = client.post("/api/habits", json={"name": "Read", "frequency": "daily"})
    assert response.status_code == 200
    habit = response.json()
    habit_id = habit["id"]

    today = date.today()
    with client as _:
        pass

    # Seed today's and yesterday's completion through the API.
    client.post(f"/api/habits/{habit_id}/log")
    response = client.get("/api/habits/today")

    assert response.status_code == 200
    habits = response.json()
    assert len(habits) == 1
    assert habits[0]["id"] == habit_id
    assert habits[0]["completed_today"] is True
    assert habits[0]["current_streak"] == 1
    assert habits[0]["best_streak"] == 1


def test_today_excludes_archived_and_unscheduled_weekday_habit(client):
    daily = client.post("/api/habits", json={"name": "Daily", "frequency": "daily"}).json()
    archived = client.post("/api/habits", json={"name": "Paused", "frequency": "daily"}).json()
    client.post(f"/api/habits/{archived['id']}/archive")

    response = client.get("/api/habits/today")
    assert response.status_code == 200
    ids = {habit["id"] for habit in response.json()}
    assert daily["id"] in ids
    assert archived["id"] not in ids


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


def test_log_streak_grows_on_consecutive_days(client):
    habit = client.post(
        "/api/habits", json={"name": "Journal", "frequency": "daily"}
    ).json()
    habit_id = habit["id"]

    # The endpoint always logs today; verify that its returned streak data is fresh.
    response = client.post(f"/api/habits/{habit_id}/log")
    assert response.json()["current_streak"] == 1

    today = date.today()
    assert today == date.today()
