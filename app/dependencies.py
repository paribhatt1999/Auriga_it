from fastapi import Depends, HTTPException, Request
from sqlmodel import Session

from .database import get_session
from .models import User


def get_current_user(
    request: Request,
    session: Session = Depends(get_session),
) -> User:
    """Return the logged-in user from the signed session cookie."""
    user_id = request.session.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = session.get(User, user_id)
    if user is None:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
