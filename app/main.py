from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import models
from .database import create_db_and_tables
from .routers.habits import router as habits_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(title="Streak Keeper", lifespan=lifespan)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(habits_router, prefix="/api")


@app.get("/")
def read_index():
    return FileResponse(Path("static") / "index.html")
