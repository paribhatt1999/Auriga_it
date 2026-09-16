from datetime import date, timedelta


def is_scheduled(habit, day: date) -> bool:
    """Return whether a habit is scheduled for the given calendar day.

    Daily habits are scheduled every day. Weekdays habits are scheduled only
    Monday through Friday.
    """
    if habit.frequency == "daily":
        return True
    if habit.frequency == "weekdays":
        return day.weekday() < 5
    return False


def compute_streaks(habit, completed_dates: list[date]) -> tuple[int, int]:
    """Return the current and best scheduled-day completion streaks.

    The current streak is calculated by walking backward from today and
    counting completed scheduled days. Unscheduled days, such as weekends for
    a weekdays habit, are skipped. The current streak stops at the first
    scheduled day that is missing from ``completed_dates``.

    The best streak is the longest uninterrupted run of completed scheduled
    days found anywhere from the earliest completion through today. Days on
    which the habit is not scheduled do not break a streak.
    """
    completed = set(completed_dates)
    today = date.today()

    current_streak = 0
    day = today
    while True:
        if is_scheduled(habit, day):
            if day not in completed:
                break
            current_streak += 1
        day -= timedelta(days=1)

    if not completed:
        return current_streak, 0

    earliest = min(completed)
    best_streak = 0
    run = 0
    day = earliest

    while day <= today:
        if is_scheduled(habit, day):
            if day in completed:
                run += 1
                best_streak = max(best_streak, run)
            else:
                run = 0
        day += timedelta(days=1)

    return current_streak, best_streak
