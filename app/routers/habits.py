from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..database import get_session
from ..models import Habit, HabitLog
from ..schemas import (
    HabitCreate,
    HabitHistoryRead,
    HabitRead,
    HabitTodayRead,
    HabitUpdate,
)
from ..services.streaks import compute_streaks, is_scheduled

router = APIRouter(prefix="/habits", tags=["habits"])


def _habit_response(habit: Habit, session: Session) -> dict:
    """Build a habit response with fresh streak information."""
    logs = session.exec(
        select(HabitLog).where(HabitLog.habit_id == habit.id)
    ).all()
    completed_dates = [log.date for log in logs if log.completed]
    current_streak, best_streak = compute_streaks(habit, completed_dates)
    return {
        "id": habit.id,
        "name": habit.name,
        "frequency": habit.frequency,
        "order": habit.order,
        "is_archived": habit.is_archived,
        "created_at": habit.created_at,
        "completed_today": date.today() in completed_dates,
        "current_streak": current_streak,
        "best_streak": best_streak,
    }


@router.post("", response_model=HabitRead)
def create_habit(habit: HabitCreate, session: Session = Depends(get_session)):
    """Create and persist a new habit."""
    db_habit = Habit(name=habit.name, frequency=habit.frequency)
    session.add(db_habit)
    session.commit()
    session.refresh(db_habit)
    return db_habit


@router.get("", response_model=list[HabitRead])
def list_habits(
    include_archived: bool = False,
    q: str = Query(default=""),
    session: Session = Depends(get_session),
):
    """List habits with optional archived filtering and case-insensitive name search."""
    statement = select(Habit)
    if not include_archived:
        statement = statement.where(Habit.is_archived == False)  # noqa: E712
    if q:
        statement = statement.where(Habit.name.ilike(f"%{q}%"))
    return session.exec(statement.order_by(Habit.order.asc())).all()


@router.get("/today", response_model=list[HabitTodayRead])
def today_habits(session: Session = Depends(get_session)):
    """Return non-archived habits scheduled for today with streak data."""
    today = date.today()
    habits = session.exec(
        select(Habit)
        .where(Habit.is_archived == False)  # noqa: E712
        .order_by(Habit.order.asc())
    ).all()
    return [
        _habit_response(habit, session)
        for habit in habits
        if is_scheduled(habit, today)
    ]


@router.get("/{habit_id}/history", response_model=list[HabitHistoryRead])
def habit_history(
    habit_id: int,
    days: int = Query(default=30, ge=1),
    session: Session = Depends(get_session),
):
    """Return scheduled and completed status for the last N calendar days."""
    habit = session.get(Habit, habit_id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")

    today = date.today()
    start_date = today - timedelta(days=days - 1)
    completed_dates = {
        log.date
        for log in session.exec(
            select(HabitLog).where(
                HabitLog.habit_id == habit_id,
                HabitLog.date >= start_date,
                HabitLog.date <= today,
                HabitLog.completed == True,  # noqa: E712
            )
        ).all()
    }
    return [
        {
            "date": start_date + timedelta(days=offset),
            "scheduled": is_scheduled(habit, start_date + timedelta(days=offset)),
            "completed": (
                is_scheduled(habit, start_date + timedelta(days=offset))
                and start_date + timedelta(days=offset) in completed_dates
            ),
        }
        for offset in range(days)
    ]


@router.patch("/reorder")
def reorder_habits(habit_ids: list[int], session: Session = Depends(get_session)):
    """Update habit order values to match the supplied ID sequence."""
    if len(habit_ids) != len(set(habit_ids)):
        raise HTTPException(status_code=400, detail="Habit IDs must be unique")

    habits = [session.get(Habit, habit_id) for habit_id in habit_ids]
    if any(habit is None for habit in habits):
        raise HTTPException(status_code=404, detail="Habit not found")

    for index, habit in enumerate(habits):
        habit.order = index
        session.add(habit)
    session.commit()
    return {"detail": "Habits reordered"}


@router.patch("/{habit_id}", response_model=HabitRead)
def update_habit(
    habit_id: int,
    habit: HabitUpdate,
    session: Session = Depends(get_session),
):
    """Update the supplied name and/or frequency fields of a habit."""
    db_habit = session.get(Habit, habit_id)
    if db_habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")

    if habit.name is not None:
        db_habit.name = habit.name
    if habit.frequency is not None:
        db_habit.frequency = habit.frequency

    session.add(db_habit)
    session.commit()
    session.refresh(db_habit)
    return db_habit


@router.post("/{habit_id}/archive", response_model=HabitRead)
def toggle_archive(habit_id: int, session: Session = Depends(get_session)):
    """Toggle a habit's archived state."""
    habit = session.get(Habit, habit_id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")

    habit.is_archived = not habit.is_archived
    session.add(habit)
    session.commit()
    session.refresh(habit)
    return habit


@router.delete("/{habit_id}")
def delete_habit(habit_id: int, session: Session = Depends(get_session)):
    """Delete a habit and all of its log entries."""
    habit = session.get(Habit, habit_id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")

    logs = session.exec(
        select(HabitLog).where(HabitLog.habit_id == habit_id)
    ).all()
    for log in logs:
        session.delete(log)
    session.delete(habit)
    session.commit()
    return {"detail": "Habit deleted"}


@router.post("/{habit_id}/log", response_model=HabitTodayRead)
def toggle_today_log(habit_id: int, session: Session = Depends(get_session)):
    """Toggle today's log row and return the habit with fresh streaks."""
    habit = session.get(Habit, habit_id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")

    today = date.today()
    log = session.exec(
        select(HabitLog).where(
            HabitLog.habit_id == habit_id,
            HabitLog.date == today,
        )
    ).first()

    if log is None:
        session.add(HabitLog(habit_id=habit_id, date=today, completed=True))
    else:
        session.delete(log)

    session.commit()
    session.refresh(habit)
    return _habit_response(habit, session)
