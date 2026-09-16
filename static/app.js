const pendingList = document.querySelector("#pending-list");
const doneList = document.querySelector("#done-list");
const pendingCount = document.querySelector("#pending-count");
const doneCount = document.querySelector("#done-count");
const pendingSection = document.querySelector("#pending-section");
const doneSection = document.querySelector("#done-section");
const caughtUpMessage = document.querySelector("#caught-up-message");
const dailyBanner = document.querySelector("#daily-banner");
const dailyBannerMessage = document.querySelector("#daily-banner-message");
const dismissDailyBanner = document.querySelector("#dismiss-daily-banner");
const habitList = document.querySelector("#habit-list");
const emptyState = document.querySelector("#empty-state");
const errorMessage = document.querySelector("#error-message");
const addForm = document.querySelector("#add-habit-form");
const todayHeading = document.querySelector("#today-heading");
const programDay = document.querySelector("#program-day");
const settingsButton = document.querySelector("#settings-button");
const settingsModal = document.querySelector("#settings-modal");
const settingsForm = document.querySelector("#settings-form");
const startDateInput = document.querySelector("#program-start-date");
const resetStartDateButton = document.querySelector("#reset-start-date");
const cancelSettingsButton = document.querySelector("#cancel-settings");
const searchInput = document.querySelector("#habit-search");
const searchResults = document.querySelector("#search-results");
const pausedList = document.querySelector("#paused-list");
const pausedEmpty = document.querySelector("#paused-empty");
const historyModal = document.querySelector("#history-modal");
const historyTitle = document.querySelector("#history-title");
const historyCalendar = document.querySelector("#history-calendar");
const closeHistory = document.querySelector("#close-history");

const today = new Date();
todayHeading.textContent = `Today — ${new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(today)}, ${new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" }).format(today)}`;

function showError(message) { errorMessage.textContent = message; errorMessage.hidden = false; }
function clearError() { errorMessage.hidden = true; errorMessage.textContent = ""; }

async function request(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try { const body = await response.json(); detail = body.detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return response.status === 204 ? null : response.json();
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function programDayNumber(startDate) {
  if (!startDate) return 1;
  const start = new Date(`${startDate}T00:00:00`);
  const current = new Date(`${localDateString()}T00:00:00`);
  const days = Math.floor((current - start) / 86400000) + 1;
  return Math.max(1, Math.min(75, days));
}

function renderProgramDay(startDate) {
  programDay.textContent = `Day ${programDayNumber(startDate)} of 75`;
}

function showDailyReminder(pendingCountValue) {
  const todayString = localDateString();
  if (localStorage.getItem("lastOpenedDate") === todayString) return;

  dailyBannerMessage.textContent = pendingCountValue
    ? `Good morning - you have ${pendingCountValue} habits waiting`
    : "Nothing pending, nice!";
  dailyBanner.hidden = false;
  localStorage.setItem("lastOpenedDate", todayString);
}

async function loadSettings() {
  const settings = await request("/api/settings");
  renderProgramDay(settings.program_start_date);
  return settings;
}

function createActionButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button"; button.className = className; button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createIconButton(label, icon, className, onClick) {
  const button = createActionButton(icon, `icon-button ${className}`, onClick);
  button.setAttribute("aria-label", label);
  button.title = label;
  return button;
}

async function openHistory(habit) {
  clearError();
  historyTitle.textContent = `${habit.name} history`;
  historyCalendar.textContent = "Loading history...";
  historyModal.showModal();
  try {
    const history = await request(`/api/habits/${habit.id}/history?days=90`);
    renderHistoryCalendar(history);
  } catch (error) {
    historyModal.close();
    showError(error.message);
  }
}

function renderHistoryCalendar(history) {
  historyCalendar.replaceChildren();
  const months = new Map();
  history.forEach((entry) => {
    const monthKey = entry.date.slice(0, 7);
    if (!months.has(monthKey)) months.set(monthKey, []);
    months.get(monthKey).push(entry);
  });

  months.forEach((entries) => {
    const month = document.createElement("section");
    month.className = "history-month";
    const monthDate = new Date(`${entries[0].date}T00:00:00`);
    const heading = document.createElement("h3");
    heading.textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(monthDate);

    const weekdayLabels = document.createElement("div");
    weekdayLabels.className = "calendar-weekdays";
    ["S", "M", "T", "W", "T", "F", "S"].forEach((label) => {
      const dayLabel = document.createElement("span");
      dayLabel.textContent = label;
      weekdayLabels.appendChild(dayLabel);
    });

    const days = document.createElement("div");
    days.className = "calendar-days";
    const firstDay = new Date(`${entries[0].date}T00:00:00`).getDay();
    for (let index = 0; index < firstDay; index += 1) {
      days.appendChild(document.createElement("span"));
    }
    entries.forEach((entry) => {
      const day = document.createElement("span");
      const todayString = localDateString();
      day.className = "calendar-day";
      day.textContent = Number(entry.date.slice(-2));
      if (!entry.scheduled) day.classList.add("calendar-unscheduled");
      else if (entry.completed) day.classList.add("calendar-completed");
      else if (entry.date < todayString) day.classList.add("calendar-missed");
      else day.classList.add("calendar-future");
      if (entry.date === todayString) day.classList.add("calendar-today");
      day.title = entry.scheduled ? (entry.completed ? "Completed" : "Missed") : "Not scheduled";
      days.appendChild(day);
    });
    month.append(heading, weekdayLabels, days);
    historyCalendar.appendChild(month);
  });
}

function renderHistoryGrid(history) {
  const grid = document.createElement("div");
  grid.className = "habit-history";
  grid.setAttribute("aria-label", "Seven-day history");

  const labels = document.createElement("div");
  labels.className = "history-labels";
  const cells = document.createElement("div");
  cells.className = "history-cells";

  history.forEach((entry) => {
    const entryDate = new Date(`${entry.date}T00:00:00`);
    const label = document.createElement("span");
    label.className = "history-day-label";
    label.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short" })
      .format(entryDate)
      .slice(0, 1);
    labels.appendChild(label);

    const cell = document.createElement("span");
    const todayString = localDateString();
    const isPast = entry.date < todayString;
    cell.className = "history-cell";
    if (!entry.scheduled) {
      cell.classList.add("history-unscheduled");
      cell.title = `${entry.date}: not scheduled`;
    } else if (entry.completed) {
      cell.classList.add("history-completed");
      cell.title = `${entry.date}: completed`;
    } else if (isPast) {
      cell.classList.add("history-missed");
      cell.title = `${entry.date}: missed`;
    } else {
      cell.classList.add("history-future");
      cell.title = `${entry.date}: upcoming`;
    }
    cell.setAttribute("aria-label", cell.title);
    cells.appendChild(cell);
  });

  grid.append(labels, cells);
  return grid;
}

function renderRow(habit, history, ordering) {
  const row = document.createElement("article");
  row.className = `habit-row ${habit.completed_today ? "is-done" : "is-pending"}`;
  row.dataset.habitId = habit.id;
  row.dataset.currentStreak = habit.current_streak; row.dataset.bestStreak = habit.best_streak;

  const checkboxId = `habit-${habit.id}`;
  const checkbox = document.createElement("input");
  checkbox.id = checkboxId; checkbox.className = "habit-check"; checkbox.type = "checkbox";
  checkbox.checked = Boolean(habit.completed_today);
  const checkboxLabel = document.createElement("label");
  checkboxLabel.className = "visually-hidden"; checkboxLabel.htmlFor = checkboxId;
  checkboxLabel.textContent = `Mark ${habit.name} complete`;

  const title = document.createElement("div"); title.className = "habit-title";
  const name = document.createElement("button");
  name.type = "button";
  name.className = "habit-name";
  name.textContent = habit.name;
  name.title = "View habit history";
  name.addEventListener("click", () => openHistory(habit));
  const frequency = document.createElement("span");
  frequency.className = "frequency-badge";
  frequency.textContent = habit.frequency === "weekdays" ? "Weekdays" : "Daily";
  title.append(name, frequency);
  const actions = document.createElement("div"); actions.className = "habit-actions";
  const stats = document.createElement("div"); stats.className = "stats";
  stats.innerHTML = `<span class="streak-chip"><span class="streak-current">🔥 ${habit.current_streak}</span><span class="streak-best">🏆 ${habit.best_streak}</span></span>`;
  const pauseButton = createIconButton("Archive habit", "▣", "pause-button", async () => {
    pauseButton.disabled = true; clearError();
    try { await request(`/api/habits/${habit.id}/archive`, { method: "POST" }); await loadHabits(); }
    catch (error) { showError(error.message); pauseButton.disabled = false; }
  });
  const editButton = createIconButton("Edit habit", "✎", "edit-button", () => {
    editForm.hidden = !editForm.hidden;
  });
  const deleteButton = createIconButton("Delete habit", "×", "delete-button", async () => {
    if (!window.confirm(`Delete "${habit.name}"? This also deletes its history.`)) return;
    deleteButton.disabled = true; clearError();
    try { await request(`/api/habits/${habit.id}`, { method: "DELETE" }); await loadHabits(); }
    catch (error) { showError(error.message); deleteButton.disabled = false; }
  });
  const position = ordering.indexOf(habit.id);
  const moveButton = async (direction) => {
    const nextPosition = position + direction;
    if (nextPosition < 0 || nextPosition >= ordering.length) return;
    const newOrdering = [...ordering];
    [newOrdering[position], newOrdering[nextPosition]] = [newOrdering[nextPosition], newOrdering[position]];
    try { await request("/api/habits/reorder", { method: "PATCH", body: JSON.stringify(newOrdering) }); await loadHabits(); }
    catch (error) { showError(error.message); }
  };
  const upButton = createIconButton("Move habit up", "↑", "move-button", () => moveButton(-1));
  const downButton = createIconButton("Move habit down", "↓", "move-button", () => moveButton(1));
  upButton.disabled = position <= 0;
  downButton.disabled = position === ordering.length - 1;

  const editForm = document.createElement("form");
  editForm.className = "edit-form";
  editForm.hidden = true;
  editForm.innerHTML = `
    <label>Name <input name="name" type="text" maxlength="200" required></label>
    <label>Frequency <select name="frequency"><option value="daily">Daily</option><option value="weekdays">Weekdays</option></select></label>
    <button type="submit">Save</button>
    <button type="button" class="secondary-button edit-cancel">Cancel</button>`;
  editForm.elements.name.value = habit.name;
  editForm.elements.frequency.value = habit.frequency;
  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saveButton = editForm.querySelector("button[type=submit]");
    saveButton.disabled = true; clearError();
    try {
      await request(`/api/habits/${habit.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.elements.name.value.trim(),
          frequency: editForm.elements.frequency.value,
        }),
      });
      await loadHabits();
    } catch (error) { showError(error.message); saveButton.disabled = false; }
  });
  editForm.querySelector(".edit-cancel").addEventListener("click", () => { editForm.hidden = true; });

  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true; clearError();
    const oldCurrent = Number(row.dataset.currentStreak), oldBest = Number(row.dataset.bestStreak);
    try {
      const updated = await request(`/api/habits/${habit.id}/log`, { method: "POST" });
      const current = Number(updated.current_streak), best = Number(updated.best_streak);
      row.dataset.currentStreak = current; row.dataset.bestStreak = best;
      row.querySelector(".streak-current").textContent = `🔥 ${current}`;
      row.querySelector(".streak-best").textContent = `🏆 ${best}`;
      if (current > oldCurrent || best > oldBest) {
        const streakChip = row.querySelector(".streak-chip");
        streakChip.classList.remove("streak-up"); void streakChip.offsetWidth; streakChip.classList.add("streak-up");
        setTimeout(() => streakChip.classList.remove("streak-up"), 700);
      }
      await loadHabits();
    } catch (error) { checkbox.checked = !checkbox.checked; showError(error.message); }
    finally { checkbox.disabled = false; }
  });
  actions.append(stats, upButton, downButton, editButton, deleteButton, pauseButton);
  row.append(checkbox, checkboxLabel, title, renderHistoryGrid(history), actions, editForm);
  return row;
}

function renderPausedHabit(habit) {
  const row = document.createElement("article"); row.className = "paused-row";
  const name = document.createElement("div"); name.className = "paused-name"; name.textContent = habit.name;
  const button = createActionButton("Bring back", "bring-back-button", async () => {
    button.disabled = true; clearError();
    try { await request(`/api/habits/${habit.id}/archive`, { method: "POST" }); await loadHabits(); }
    catch (error) { showError(error.message); button.disabled = false; }
  });
  row.append(name, button); return row;
}

async function loadHabits() {
  clearError(); pendingList.replaceChildren(); doneList.replaceChildren(); pausedList.replaceChildren();
  emptyState.hidden = true; pendingSection.hidden = false; caughtUpMessage.hidden = true; doneSection.hidden = false; pausedEmpty.hidden = true;
  try {
    const [todayHabits, allHabits] = await Promise.all([
      request("/api/habits/today"), request("/api/habits?include_archived=true")
    ]);
    const habitsWithHistory = await Promise.all(todayHabits.map(async (habit) => ({
      habit,
      history: await request(`/api/habits/${habit.id}/history?days=7`),
    })));
    const pendingHabits = habitsWithHistory.filter(({ habit }) => habit.completed_today === false);
    const doneHabits = habitsWithHistory.filter(({ habit }) => habit.completed_today === true);
    const ordering = allHabits.filter((habit) => !habit.is_archived).map((habit) => habit.id);
    pendingCount.textContent = `(${pendingHabits.length})`;
    doneCount.textContent = `(${doneHabits.length})`;
    pendingHabits.forEach(({ habit, history }) => pendingList.appendChild(renderRow(habit, history, ordering)));
    doneHabits.forEach(({ habit, history }) => doneList.appendChild(renderRow(habit, history, ordering)));
    pendingSection.hidden = pendingHabits.length === 0;
    caughtUpMessage.hidden = pendingHabits.length !== 0;
    doneSection.hidden = doneHabits.length === 0;
    emptyState.hidden = todayHabits.length !== 0;
    showDailyReminder(pendingHabits.length);
    const pausedHabits = allHabits.filter((habit) => habit.is_archived);
    pausedHabits.forEach((habit) => pausedList.appendChild(renderPausedHabit(habit)));
    pausedEmpty.hidden = pausedHabits.length !== 0;
  } catch (error) { showError(error.message); }
}

dismissDailyBanner.addEventListener("click", () => { dailyBanner.hidden = true; });
closeHistory.addEventListener("click", () => historyModal.close());

let searchTimer;
async function searchHabits() {
  const query = searchInput.value.trim();
  if (!query) { searchResults.replaceChildren(); searchResults.hidden = true; return; }
  try {
    const habits = await request(`/api/habits?include_archived=true&q=${encodeURIComponent(query)}`);
    searchResults.replaceChildren();
    if (!habits.length) {
      const empty = document.createElement("div"); empty.className = "search-result-status"; empty.textContent = "No habits found"; empty.style.padding = "12px"; searchResults.appendChild(empty);
    } else habits.forEach((habit) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "search-result"; button.setAttribute("role", "option");
      const name = document.createElement("span"); name.className = "search-result-name"; name.textContent = habit.name;
      const status = document.createElement("span"); status.className = "search-result-status"; status.textContent = habit.is_archived ? "Paused" : "Active";
      button.append(name, status);
      button.addEventListener("click", () => { searchInput.value = habit.name; searchResults.hidden = true; searchResults.replaceChildren(); if (habit.is_archived) document.querySelector(".paused-section").open = true; });
      searchResults.appendChild(button);
    });
    searchResults.hidden = false;
  } catch (error) { showError(error.message); }
}
searchInput.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(searchHabits, 180); });
document.addEventListener("click", (event) => { if (!event.target.closest(".search-section")) searchResults.hidden = true; });

settingsButton.addEventListener("click", async () => {
  clearError();
  try { const settings = await loadSettings(); startDateInput.value = settings.program_start_date || ""; settingsModal.showModal(); }
  catch (error) { showError(error.message); }
});
cancelSettingsButton.addEventListener("click", () => settingsModal.close());
resetStartDateButton.addEventListener("click", async () => {
  resetStartDateButton.disabled = true; clearError();
  try { const settings = await request("/api/settings", { method: "PATCH" }); startDateInput.value = ""; renderProgramDay(settings.program_start_date); settingsModal.close(); }
  catch (error) { showError(error.message); }
  finally { resetStartDateButton.disabled = false; }
});
settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const saveButton = settingsForm.querySelector("button[type=submit]"); saveButton.disabled = true; clearError();
  try {
    const date = startDateInput.value || null;
    const url = date ? `/api/settings?program_start_date=${encodeURIComponent(date)}` : "/api/settings";
    const settings = await request(url, { method: "PATCH" }); renderProgramDay(settings.program_start_date); settingsModal.close();
  } catch (error) { showError(error.message); }
  finally { saveButton.disabled = false; }
});

addForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const submitButton = addForm.querySelector("button[type=submit]"); submitButton.disabled = true; clearError();
  const formData = new FormData(addForm);
  try {
    await request("/api/habits", { method: "POST", body: JSON.stringify({ name: formData.get("name").trim(), frequency: formData.get("frequency") }) });
    addForm.reset(); await loadHabits();
  } catch (error) { showError(error.message); } finally { submitButton.disabled = false; }
});

Promise.all([loadSettings(), loadHabits()]).catch((error) => showError(error.message));
