(function () {
  "use strict";

  const STORAGE_KEY = "todo.tasks.v1";

  const form = document.getElementById("add-form");
  const input = document.getElementById("new-task");
  const list = document.getElementById("task-list");
  const empty = document.getElementById("empty");
  const counter = document.getElementById("counter");
  const clearDone = document.getElementById("clear-done");
  const filterButtons = Array.from(document.querySelectorAll(".filters__btn"));

  /** @type {{id: string, text: string, done: boolean}[]} */
  let tasks = loadTasks();
  let filter = "all";

  /* ---------- Storage ---------- */

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((t) => t && typeof t.text === "string")
        .map((t) => ({
          id: String(t.id ?? createId()),
          text: t.text,
          done: Boolean(t.done),
        }));
    } catch (err) {
      console.warn("Не удалось прочитать сохранённые задачи:", err);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.warn("Не удалось сохранить задачи:", err);
    }
  }

  function createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- Rendering ---------- */

  function visibleTasks() {
    if (filter === "active") return tasks.filter((t) => !t.done);
    if (filter === "done") return tasks.filter((t) => t.done);
    return tasks;
  }

  function render() {
    const items = visibleTasks();
    list.textContent = "";

    const fragment = document.createDocumentFragment();
    for (const task of items) fragment.appendChild(renderTask(task));
    list.appendChild(fragment);

    const hasAny = tasks.length > 0;
    empty.hidden = items.length > 0;
    empty.textContent = hasAny
      ? filter === "done"
        ? "Выполненных задач пока нет."
        : "Все задачи выполнены. Отличная работа!"
      : "Пока пусто — добавьте первую задачу.";

    const left = tasks.filter((t) => !t.done).length;
    const doneCount = tasks.length - left;
    counter.textContent = hasAny
      ? `${left} ${plural(left, ["задача", "задачи", "задач"])} осталось`
      : "Нет задач";

    clearDone.disabled = doneCount === 0;
  }

  function renderTask(task) {
    const li = document.createElement("li");
    li.className = "task" + (task.done ? " is-done" : "");
    li.dataset.id = task.id;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task__check";
    check.checked = task.done;
    check.setAttribute("aria-label", task.done ? "Отметить как невыполненную" : "Отметить как выполненную");
    check.addEventListener("change", () => toggleTask(task.id));

    const text = document.createElement("span");
    text.className = "task__text";
    text.textContent = task.text;
    text.title = "Нажмите, чтобы изменить";
    text.addEventListener("click", () => startEdit(li, task));

    const del = document.createElement("button");
    del.type = "button";
    del.className = "task__delete";
    del.setAttribute("aria-label", "Удалить задачу");
    del.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
      '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round"/></svg>';
    del.addEventListener("click", () => removeTask(task.id));

    li.append(check, text, del);
    return li;
  }

  /* ---------- Actions ---------- */

  function addTask(rawText) {
    const text = rawText.trim();
    if (!text) return;
    tasks.unshift({ id: createId(), text, done: false });
    // Showing a freshly added task regardless of the current filter.
    if (filter === "done") setFilter("all");
    saveTasks();
    render();
    input.value = "";
    input.focus();
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    saveTasks();
    render();
  }

  function removeTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    render();
  }

  function startEdit(li, task) {
    if (li.querySelector(".task__edit")) return;

    const field = document.createElement("input");
    field.type = "text";
    field.className = "task__edit";
    field.value = task.text;
    field.maxLength = 200;

    const textEl = li.querySelector(".task__text");
    li.replaceChild(field, textEl);
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);

    let finished = false;

    const commit = () => {
      if (finished) return;
      finished = true;
      const value = field.value.trim();
      if (value) {
        task.text = value;
        saveTasks();
      }
      render();
    };

    const cancel = () => {
      if (finished) return;
      finished = true;
      render();
    };

    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commit();
      else if (e.key === "Escape") cancel();
    });
    field.addEventListener("blur", commit);
  }

  function setFilter(next) {
    filter = next;
    filterButtons.forEach((btn) =>
      btn.classList.toggle("is-active", btn.dataset.filter === filter)
    );
    render();
  }

  function plural(n, forms) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }

  /* ---------- Events ---------- */

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addTask(input.value);
  });

  filterButtons.forEach((btn) =>
    btn.addEventListener("click", () => setFilter(btn.dataset.filter))
  );

  clearDone.addEventListener("click", () => {
    tasks = tasks.filter((t) => !t.done);
    saveTasks();
    render();
  });

  // Sync between tabs/windows.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    tasks = loadTasks();
    render();
  });

  /* ---------- Init ---------- */

  const today = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  document.getElementById("today").textContent =
    today.charAt(0).toUpperCase() + today.slice(1);

  render();
  input.focus();
})();
