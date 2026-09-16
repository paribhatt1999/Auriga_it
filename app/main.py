import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from . import models
from .database import create_db_and_tables
from .routers.auth import router as auth_router
from .routers.habits import router as habits_router
from .routers.settings import router as settings_router

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-this-secret")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(title="Streak Keeper", lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(auth_router, prefix="/api")
app.include_router(habits_router, prefix="/api")
app.include_router(settings_router, prefix="/api")


@app.get("/")
def read_index():
    return FileResponse(Path("static") / "index.html")
