# Engineering Reasoning

This document explains the reasoning behind the main design decisions in Streak Keeper. I deliberately favored simple, reversible designs over heavier infrastructure where the product did not need it.

## Tech Stack Choice

I chose FastAPI, SQLite, and vanilla HTML/CSS/JS because the brief called for simplicity, and the core problem is straightforward: logging habits and calculating streaks. A frontend framework or heavier database would add structure and operational overhead without solving a problem this app actually has.

## Streak Calculation

I deliberately do **not** store `current_streak` or `best_streak` as mutable counters on the `Habit` table; instead, I compute both from the raw `HabitLog` history whenever they are needed. A cached counter can drift from reality as soon as the app supports undoing a log, editing past logs, or archiving and un-archiving a habit, whereas recomputation stays correct because the log history is the source of truth; with only 75 days of data per habit, the extra work is negligible.

A separate `is_scheduled()` function decides whether a particular day actually counts for a habit's frequency. This means a weekdays-only habit skips weekends rather than being penalized for them, while the same scheduling rule also prevents weekends from creating an unfair advantage in streak calculations.

## Archive Instead of Delete

The brief describes habits that users have "quietly given up on" and want out of the way "but not gone forever." I treated that as a paused state rather than deletion: archiving flips a boolean and removes the habit from the Today view, while preserving its logs and streak history if the user decides to bring it back later.

## Search Across All Habits

The brief says the user "keeps hunting for a particular one to update," so searching only the Today list would miss exactly the habits that may be archived or not scheduled for the current day. I therefore made search span the full habit set, including archived habits, so the search feature can actually locate a habit regardless of its current state.

## Morning Banner Instead of Push Notifications

I chose an in-app morning banner for unlogged habits instead of implementing browser push notifications. A real push notification that works while the browser is closed would require a service worker, Web Push, and VAPID keys—substantial infrastructure for a reminder the user only needs when they open the app—so the banner checks `localStorage` and is shown once per calendar day to address the actual use case with much less complexity.

## Up/Down Reordering Instead of Drag-and-Drop

I used up/down arrow buttons that swap a habit with its neighbor rather than drag-and-drop. Drag-and-drop would look more polished, but implementing it reliably introduces extra concerns such as touch support, accessibility, and correct drop-target calculation; the buttons achieve the same reordering outcome with a fraction of the implementation risk for this project.

## Frontend-Only Milestones

The 7-, 14-, 30-, and 75-day celebrations are presentation on top of the backend's existing `current_streak`, so I kept them out of the database. I track which streak values have already been celebrated in `localStorage`, keyed by habit and streak value, because there is no meaningful server-side ownership or business state to persist for a UI-only celebration.

## Session Cookies Instead of JWT

I chose signed session cookies through Starlette's `SessionMiddleware` because this is a single FastAPI backend serving its own frontend and has no need for stateless authentication across multiple services. This keeps authentication simpler and avoids having to design token storage, expiry, and refresh flows; in particular, it avoids the common pattern of storing JWTs in `localStorage`, where an XSS issue could expose them.
