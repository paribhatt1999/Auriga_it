from datetime import date, timedelta

from app.models import Habit
from app.services.streaks import compute_streaks


def test_unbroken_daily_streak():
    today = date.today()
    habit = Habit(name="Read", frequency="daily", created_at=today - timedelta(days=4))
    completed = [today - timedelta(days=i) for i in range(4)]

    assert compute_streaks(habit, completed) == (4, 4)


def test_broken_daily_streak():
    today = date.today()
    habit = Habit(name="Exercise", frequency="daily", created_at=today - timedelta(days=5))
    completed = [today, today - timedelta(days=1), today - timedelta(days=3), today - timedelta(days=4)]

    assert compute_streaks(habit, completed) == (2, 2)


def test_weekdays_skip_weekends():
    # 2026-09-16 is Wednesday. The preceding Saturday/Sunday are unscheduled.
    today = date.today()
    assert today == date(2026, 9, 16)
    habit = Habit(name="Study", frequency="weekdays", created_at=date(2026, 9, 11))
    completed = [
        date(2026, 9, 11),  # Friday
        date(2026, 9, 14),  # Monday
        date(2026, 9, 15),  # Tuesday
        date(2026, 9, 16),  # Wednesday
    ]

    assert compute_streaks(habit, completed) == (4, 4)


def test_today_completed_vs_not_completed():
    today = date.today()
    habit = Habit(name="Meditate", frequency="daily", created_at=today - timedelta(days=2))

    completed_today = [today, today - timedelta(days=1)]
    not_completed_today = [today - timedelta(days=1)]

    assert compute_streaks(habit, completed_today) == (2, 2)
    assert compute_streaks(habit, not_completed_today) == (0, 1)
