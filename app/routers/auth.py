from fastapi import APIRouter, Depends, HTTPException, Request, status
from passlib.context import CryptContext
from sqlmodel import Session, select

from ..database import get_session
from ..dependencies import get_current_user
from ..models import User
from ..schemas import AuthCredentials, UserRead

router = APIRouter(tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _find_user(email: str, session: Session) -> User | None:
    return session.exec(select(User).where(User.email == email.lower())).first()


@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def signup(
    credentials: AuthCredentials,
    request: Request,
    session: Session = Depends(get_session),
):
    """Create a user, start a session, and return the public user data."""
    email = credentials.email.lower()
    if _find_user(email, session) is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=email,
        hashed_password=pwd_context.hash(credentials.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    request.session["user_id"] = user.id
    return user


@router.post("/login", response_model=UserRead)
def login(
    credentials: AuthCredentials,
    request: Request,
    session: Session = Depends(get_session),
):
    """Verify credentials and start a session."""
    user = _find_user(credentials.email.lower(), session)
    if user is None or not pwd_context.verify(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    request.session["user_id"] = user.id
    return user


@router.post("/logout")
def logout(request: Request):
    """Clear the current session."""
    request.session.clear()
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    """Return the current logged-in user."""
    return current_user
