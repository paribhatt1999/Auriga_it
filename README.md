# Streak Keeper

## 1. What this is

Streak Keeper is a habit tracker for keeping daily or weekday habits on a schedule, recording completions, calculating current and best streaks, and managing habits without losing their history. The current interface also includes pending/done Today sections, a weekly progress grid, a longer calendar history view, archived habits, habit reordering and editing, a 75-day program start date, and milestone/progress-oriented UI.

## 2. Tech stack

- **Backend:** FastAPI
- **Database layer:** SQLModel
- **Database:** SQLite
- **Frontend:** vanilla HTML, CSS, and JavaScript
- **Testing:** pytest with FastAPI `TestClient` and in-memory SQLite fixtures

There are no frontend frameworks or frontend build tools. The static files are served directly by FastAPI.

## 3. Project structure

```text
.
├── app/
│   ├── __init__.py              # Python package marker.
│   ├── database.py              # SQLite engine, table creation, and database sessions.
│   ├── main.py                  # FastAPI application, routers, static files, and `/` frontend route.
│   ├── models.py                # SQLModel database tables: Habit, HabitLog, and Settings.
│   ├── schemas.py               # Pydantic request/response schemas and allowed frequency values.
│   ├── routers/
│   │   ├── __init__.py          # Router package marker.
│   │   ├── habits.py             # Habit CRUD, Today, history, reorder, archive, and logging endpoints.
│   │   └── settings.py           # Program start-date settings endpoints.
│   └── services/
│       ├── __init__.py           # Services package marker.
│       └── streaks.py             # Scheduling and current/best streak calculations.
├── static/
│   ├── index.html                # Main Streak Keeper page and dialogs.
│   ├── app.js                    # Frontend state, API calls, rendering, history, and interactions.
│   └── style.css                 # Layout, responsive styling, controls, cards, grids, and dialogs.
├── tests/
│   ├── test_habits_api.py        # API tests using TestClient and an in-memory SQLite database.
│   └── test_streaks.py            # Unit tests for streak calculation behavior.
├── requirements.txt               # Python runtime and test dependencies.
└── README.md                      # Project setup, API, and debugging documentation.
```

## 4. Setup (from a fresh Codespace)

Create and activate a virtual environment:

```bash
python3 -m venv venv && source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Once the virtual environment is activated, `uvicorn` is available directly as a command. You do not need `python -m uvicorn` unless there is a PATH issue.

## 5. Running locally

Start the development server:

```bash
uvicorn app.main:app --reload --port 8000
```

In a Codespace, open the forwarded port 8000.

- `/` — Streak Keeper frontend
- `/docs` — FastAPI interactive API documentation

The application uses SQLite (`streaks.db`) for its local database and creates the tables when the FastAPI application starts.

## 6. Running tests

With the virtual environment activated:

```bash
pytest
```

## 7. API overview

The habit router is mounted under `/api`, so the routes in `app/routers/habits.py` are exposed as follows:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/habits` | Create a new habit. |
| `GET` | `/api/habits` | List habits, optionally including archived habits and filtering by name with `q`. |
| `GET` | `/api/habits/today` | Return non-archived habits scheduled for today with completion and streak data. |
| `GET` | `/api/habits/{habit_id}/history` | Return scheduled/completed status for the last requested number of calendar days (30 by default). |
| `PATCH` | `/api/habits/reorder` | Set habit ordering from a supplied list of habit IDs. |
| `PATCH` | `/api/habits/{habit_id}` | Update a habit's name and/or frequency. |
| `POST` | `/api/habits/{habit_id}/archive` | Toggle a habit between active and archived states. |
| `DELETE` | `/api/habits/{habit_id}` | Delete a habit and all of its log entries. |
| `POST` | `/api/habits/{habit_id}/log` | Toggle today's completion log and return updated streak data. |

The application also has a separate settings router mounted under `/api/settings` for reading and updating the program start date.

## 8. Common issues / debugging

### `uvicorn: command not found`

This is usually a PATH issue when the virtual environment is not activated. Activate the environment first:

```bash
source venv/bin/activate
```

Or run Uvicorn through Python directly:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

### `TypeError: issubclass() arg 1 must be a class` with a `Literal` field

SQLModel table models cannot use `Literal[...]` directly for this field pattern. Keep the database table field as `str` and restrict accepted values with Pydantic `Literal` types in `app/schemas.py` instead.

In this project, `Habit.frequency` is therefore a database `str`, while the API schemas restrict it to `"daily"` or `"weekdays"`.

### `git push` rejected / rebase conflicts in `static/app.js` or `static/index.html`

This commonly happens when the same files are edited in parallel, for example once through an AI plugin and once locally. Pull the latest `main` and rebase your work:

```bash
git pull origin main --rebase
```

If there are conflict markers, resolve them manually or with the assistant. Then continue:

```bash
git add <resolved-files>
git rebase --continue
```

If you need to safely abandon the rebase:

```bash
git rebase --abort
```

### Streak numbers look wrong

Check `is_scheduled()` in `app/services/streaks.py` first. Daily habits are scheduled every day, while weekday-only habits are scheduled Monday through Friday. Weekends should therefore be skipped rather than counted as missing days when weekday habits are used.

## 9. Deployment (optional)

For a simple Render or Railway deployment, install the dependencies with:

**Build command**

```bash
pip install -r requirements.txt
```

**Start command**

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

For production deployment, configure persistent storage if the SQLite database needs to survive application/container replacement.
