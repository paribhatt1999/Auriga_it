from datetime import date

from fastapi import APIRouter, Depends
from sqlmodel import Session

from ..database import get_session
from ..models import Settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
def get_settings(session: Session = Depends(get_session)):
    """Return the singleton program settings."""
    settings = session.get(Settings, 1)
    if settings is None:
        settings = Settings(id=1)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


@router.patch("")
def update_settings(
    program_start_date: date | None = None,
    session: Session = Depends(get_session),
):
    """Set or reset the program start date."""
    settings = session.get(Settings, 1)
    if settings is None:
        settings = Settings(id=1)
    settings.program_start_date = program_start_date
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings
