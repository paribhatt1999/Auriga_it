from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict


Frequency = Literal["daily", "weekdays"]


class HabitCreate(BaseModel):
	name: str
	frequency: Frequency


class HabitUpdate(BaseModel):
	name: str | None = None
	frequency: Frequency | None = None


class HabitRead(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: int
	name: str
	frequency: Frequency
	order: int
	is_archived: bool
	created_at: date


class HabitTodayRead(HabitRead):
	completed_today: bool
	current_streak: int
	best_streak: int


class HabitHistoryRead(BaseModel):
	date: date
	scheduled: bool
	completed: bool
