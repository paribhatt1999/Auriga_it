from datetime import date
from typing import Literal, Optional

from sqlmodel import Field, SQLModel, UniqueConstraint


class Habit(SQLModel, table=True):
    __tablename__ = "habit"
    __table_args__ = (UniqueConstraint("name", name="uq_habit_name"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    frequency: Literal["daily", "weekdays"]
    is_archived: bool = False
    created_at: date = Field(default_factory=date.today)


class HabitLog(SQLModel, table=True):
    __tablename__ = "habit_log"
    __table_args__ = (
        UniqueConstraint("habit_id", "date", name="uq_habit_log_habit_date"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    habit_id: int = Field(foreign_key="habit.id")
    date: date
    completed: bool = True
