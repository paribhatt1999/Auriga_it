const habitList = document.querySelector("#habit-list");
const emptyState = document.querySelector("#empty-state");
const errorMessage = document.querySelector("#error-message");
const addForm = document.querySelector("#add-habit-form");
const todayHeading = document.querySelector("#today-heading");
const searchInput = document.querySelector("#habit-search");
const searchResults = document.querySelector("#search-results");
const pausedList = document.querySelector("#paused-list");
const pausedEmpty = document.querySelector("#paused-empty");

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
function createActionButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button"; button.className = className; button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}
function renderRow(habit) {
  const row = document.createElement("article");
  row.className = "habit-row"; row.dataset.habitId = habit.id;
  row.dataset.currentStreak = habit.current_streak; row.dataset.bestStreak = habit.best_streak;
  const checkbox = document.createElement("input");
  checkbox.className = "habit-check"; checkbox.type = "checkbox"; checkbox.checked = Boolean(habit.completed_today);
  checkbox.setAttribute("aria-label", `Mark ${habit.name} complete`);
  const name = document.createElement("div"); name.className = "habit-name"; name.textContent = habit.name;
  const actions = document.createElement("div"); actions.className = "habit-actions";
  const stats = document.createElement("div"); stats.className = "stats";
  stats.innerHTML = `<span class="stat streak-current">🔥 ${habit.current_streak}</span><span class="stat streak-best">🏆 ${habit.best_streak}</span>`;
  const pauseButton = createActionButton("Pause", "pause-button", async () => {
    pauseButton.disabled = true; clearError();
    try { await request(`/api/habits/${habit.id}/archive`, { method: "POST" }); await loadHabits(); }
    catch (error) { showError(error.message); pauseButton.disabled = false; }
  });
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
        row.classList.remove("streak-up"); void row.offsetWidth; row.classList.add("streak-up");
        setTimeout(() => row.classList.remove("streak-up"), 700);
      }
    } catch (error) { checkbox.checked = !checkbox.checked; showError(error.message); }
    finally { checkbox.disabled = false; }
  });
  actions.append(stats, pauseButton); row.append(checkbox, name, actions); return row;
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
  clearError(); habitList.replaceChildren(); pausedList.replaceChildren(); emptyState.hidden = true; pausedEmpty.hidden = true;
  try {
    const [todayHabits, allHabits] = await Promise.all([
      request("/api/habits/today"), request("/api/habits?include_archived=true")
    ]);
    todayHabits.forEach((habit) => habitList.appendChild(renderRow(habit)));
    emptyState.hidden = todayHabits.length !== 0;
    const pausedHabits = allHabits.filter((habit) => habit.is_archived);
    pausedHabits.forEach((habit) => pausedList.appendChild(renderPausedHabit(habit)));
    pausedEmpty.hidden = pausedHabits.length !== 0;
  } catch (error) { showError(error.message); }
}

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

addForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const submitButton = addForm.querySelector("button[type=submit]"); submitButton.disabled = true; clearError();
  const formData = new FormData(addForm);
  try {
    await request("/api/habits", { method: "POST", body: JSON.stringify({ name: formData.get("name").trim(), frequency: formData.get("frequency") }) });
    addForm.reset(); await loadHabits();
  } catch (error) { showError(error.message); } finally { submitButton.disabled = false; }
});
loadHabits();
