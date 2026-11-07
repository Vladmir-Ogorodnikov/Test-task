(function () {
  "use strict";

  const STORAGE_KEY = "todo.tasks.v1";

  const form = document.getElementById("add-form");
  const input = document.getElementById("new-task");
  const list = document.getElementById("task-list");
  const empty = document.getElementById("empty");
  const emptyText = document.getElementById("empty-text");
  const counter = document.getElementById("counter");
  const clearDone = document.getElementById("clear-done");
  const progress = document.getElementById("progress");
  const progressFill = document.getElementById("progress-fill");
  const progressTrack = document.getElementById("progress-track");
  const progressValue = document.getElementById("progress-value");
  const filterButtons = Array.from(document.querySelectorAll(".filters__btn"));

  /** @type {{id: string, text: string, done: boolean}[]} */
  let tasks = loadTasks();
  let filter = "all";

  /* ------------------------------------------------------------
     Хранилище
     ------------------------------------------------------------ */

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((t) => t && typeof t.text === "string" && t.text.trim())
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

  /* ------------------------------------------------------------
     Отрисовка
     ------------------------------------------------------------ */

  function visibleTasks() {
    if (filter === "active") return tasks.filter((t) => !t.done);
    if (filter === "done") return tasks.filter((t) => t.done);
    return tasks;
  }

  function render() {
    list.textContent = "";

    const fragment = document.createDocumentFragment();
    for (const task of visibleTasks()) fragment.appendChild(renderTask(task));
    list.appendChild(fragment);

    updateMeta();
  }

  function renderTask(task) {
    const li = document.createElement("li");
    li.className = "task" + (task.done ? " is-done" : "");
    li.dataset.id = task.id;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task__check";
    check.checked = task.done;
    check.setAttribute("aria-label", checkLabel(task));
    check.addEventListener("change", () => toggleTask(task.id, check));

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
      'stroke-width="1.9" stroke-linecap="round"/></svg>';
    del.addEventListener("click", () => removeTask(task.id));

    li.append(check, text, del);
    return li;
  }

  function checkLabel(task) {
    return task.done ? "Отметить как невыполненную" : "Отметить как выполненную";
  }

  /** Счётчик, прогресс, состояние кнопок и пустого блока. */
  function updateMeta() {
    const total = tasks.length;
    const doneCount = tasks.filter((t) => t.done).length;
    const left = total - doneCount;

    // Счётчик
    counter.textContent = "";
    if (total === 0) {
      counter.textContent = "Нет задач";
    } else if (left === 0) {
      counter.textContent = "Всё готово";
    } else {
      const num = document.createElement("b");
      num.className = "counter__num";
      num.textContent = String(left);
      counter.append(num, ` ${plural(left, ["задача", "задачи", "задач"])} осталось`);
    }

    // Прогресс
    progress.hidden = total === 0;
    if (total > 0) {
      const percent = Math.round((doneCount / total) * 100);
      progressFill.style.width = percent + "%";
      progressValue.textContent = `${doneCount} / ${total}`;
      progressTrack.setAttribute("aria-valuenow", String(percent));
    }

    // Кнопка очистки
    clearDone.disabled = doneCount === 0;

    // Пустой блок
    const items = visibleTasks().length;
    empty.hidden = items > 0;
    if (total === 0) {
      emptyText.textContent = "Пока пусто — добавьте первую задачу.";
    } else if (filter === "done") {
      emptyText.textContent = "Выполненных задач пока нет.";
    } else if (filter === "active" && left === 0) {
      emptyText.textContent = "Все задачи выполнены. Отличная работа!";
    } else {
      emptyText.textContent = "Здесь пока ничего нет.";
    }
  }

  /* ------------------------------------------------------------
     Действия
     ------------------------------------------------------------ */

  function addTask(rawText) {
    const text = rawText.trim();
    if (!text) {
      input.focus();
      return;
    }

    tasks.unshift({ id: createId(), text, done: false });
    // Новая задача должна быть видна при любом фильтре.
    if (filter !== "all" && filter !== "active") setFilter("all", true);
    saveTasks();
    render();

    input.value = "";
    input.focus();
  }

  function toggleTask(id, checkbox) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    task.done = !task.done;
    saveTasks();

    if (filter === "all") {
      // Обновляем строку на месте — без перерисовки и мигания.
      const li = checkbox.closest(".task");
      if (li) li.classList.toggle("is-done", task.done);
      checkbox.setAttribute("aria-label", checkLabel(task));
      updateMeta();
    } else {
      // Строка больше не соответствует фильтру — убираем её плавно.
      const li = checkbox.closest(".task");
      animateOut(li, render);
    }
  }

  function removeTask(id) {
    const li = list.querySelector(`.task[data-id="${id}"]`);
    const commit = () => {
      tasks = tasks.filter((t) => t.id !== id);
      saveTasks();
      render();
    };
    animateOut(li, commit);
  }

  function clearCompleted() {
    tasks = tasks.filter((t) => !t.done);
    saveTasks();
    render();
  }

  /** Плавное схлопывание строки перед обновлением состояния. */
  function animateOut(li, callback) {
    if (!li) return callback();

    let called = false;
    const done = () => {
      if (called) return;
      called = true;
      callback();
    };

    // Фиксируем текущую высоту, иначе max-height: 0 не анимируется от auto.
    const height = li.offsetHeight;
    li.style.maxHeight = height + "px";
    void li.offsetHeight; // принудительный reflow

    li.classList.add("is-removing");
    li.style.maxHeight = "0px";

    li.addEventListener("transitionend", (e) => {
      if (e.propertyName === "max-height") done();
    });
    setTimeout(done, 340);
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
      if (value && value !== task.text) {
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

  function setFilter(next, silent) {
    filter = next;
    filterButtons.forEach((btn) =>
      btn.classList.toggle("is-active", btn.dataset.filter === filter)
    );
    if (!silent) render();
  }

  function plural(n, forms) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }

  /* ------------------------------------------------------------
     События
     ------------------------------------------------------------ */

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addTask(input.value);
  });

  filterButtons.forEach((btn) =>
    btn.addEventListener("click", () => setFilter(btn.dataset.filter))
  );

  clearDone.addEventListener("click", clearCompleted);

  // Синхронизация между вкладками.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    tasks = loadTasks();
    render();
  });

  /* ------------------------------------------------------------
     Старт
     ------------------------------------------------------------ */

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
