const habitList = document.querySelector("#habit-list");
const emptyState = document.querySelector("#empty-state");
const errorMessage = document.querySelector("#error-message");
const addForm = document.querySelector("#add-habit-form");
const todayHeading = document.querySelector("#today-heading");

const today = new Date();
todayHeading.textContent = `Today — ${new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(today)}, ${new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" }).format(today)}`;

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearError() {
  errorMessage.hidden = true;
  errorMessage.textContent = "";
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return response.json();
}

function renderRow(habit) {
  const row = document.createElement("article");
  row.className = "habit-row";
  row.dataset.habitId = habit.id;

  const checkbox = document.createElement("input");
  checkbox.className = "habit-check";
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(habit.completed_today);
  checkbox.setAttribute("aria-label", `Mark ${habit.name} complete`);

  const name = document.createElement("div");
  name.className = "habit-name";
  name.textContent = habit.name;

  const stats = document.createElement("div");
  stats.className = "stats";
  stats.innerHTML = `<span class="stat streak-current">🔥 ${habit.current_streak}</span><span class="stat streak-best">🏆 ${habit.best_streak}</span>`;

  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;
    clearError();
    const oldCurrent = Number(row.dataset.currentStreak || habit.current_streak);
    const oldBest = Number(row.dataset.bestStreak || habit.best_streak);
    try {
      const updated = await request(`/api/habits/${habit.id}/log`, { method: "POST" });
      const current = Number(updated.current_streak);
      const best = Number(updated.best_streak);
      row.dataset.currentStreak = current;
      row.dataset.bestStreak = best;
      row.querySelector(".streak-current").textContent = `🔥 ${current}`;
      row.querySelector(".streak-best").textContent = `🏆 ${best}`;

      if (current > oldCurrent || best > oldBest) {
        row.classList.remove("streak-up");
        void row.offsetWidth;
        row.classList.add("streak-up");
        setTimeout(() => row.classList.remove("streak-up"), 700);
      }
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      showError(error.message);
    } finally {
      checkbox.disabled = false;
    }
  });

  row.dataset.currentStreak = habit.current_streak;
  row.dataset.bestStreak = habit.best_streak;
  row.append(checkbox, name, stats);
  return row;
}

async function loadHabits() {
  clearError();
  habitList.replaceChildren();
  emptyState.hidden = true;
  try {
    const habits = await request("/api/habits/today");
    habits.forEach((habit) => habitList.appendChild(renderRow(habit)));
    emptyState.hidden = habits.length !== 0;
  } catch (error) {
    showError(error.message);
  }
}

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = addForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  clearError();
  const formData = new FormData(addForm);
  try {
    await request("/api/habits", {
      method: "POST",
      body: JSON.stringify({ name: formData.get("name").trim(), frequency: formData.get("frequency") }),
    });
    addForm.reset();
    await loadHabits();
  } catch (error) {
    showError(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

loadHabits();
