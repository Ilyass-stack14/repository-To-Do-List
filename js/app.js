/**
 * Focus Dashboard — app.js
 *
 * Bonus features implemented:
 *   1. Light / Dark mode        (toggle in header)
 *   2. Custom name in greeting  (modal, persisted)
 *   3. Change Pomodoro time     (custom minutes input)
 *
 * All data stored in localStorage only. No frameworks.
 */

'use strict';

/* ═══════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════ */

/** Get element by id */
const el = id => document.getElementById(id);

/** Read a value from localStorage, returning `fallback` on miss or parse error. */
function lsGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

/** Write a JSON-serialisable value to localStorage. */
function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Escape text for safe innerHTML insertion. */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Show a brief toast notification instead of alert(). */
function toast(msg, emoji = 'ℹ️') {
  // Remove any existing toast
  document.querySelectorAll('.toast').forEach(t => t.remove());

  const div = document.createElement('div');
  div.className = 'toast';
  div.innerHTML = `<span>${emoji}</span> ${esc(msg)}`;
  document.body.appendChild(div);

  setTimeout(() => {
    div.classList.add('toast-out');
    div.addEventListener('animationend', () => div.remove(), { once: true });
  }, 3000);
}

/* ═══════════════════════════════════════════════
   GREETING & DATETIME
═══════════════════════════════════════════════ */

function getGreeting(hour) {
  if (hour < 5)  return 'Good Night';
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  if (hour < 21) return 'Good Evening';
  return 'Good Night';
}

function updateClock() {
  const now    = new Date();
  const hour   = now.getHours();
  const name   = lsGet('userName', '');

  el('datetime').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }) + ' · ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const greet = getGreeting(hour);
  el('greeting').textContent = name
    ? `${greet}, ${name}! 👋`
    : `${greet}! 👋`;
}

updateClock();
setInterval(updateClock, 1000);

/* ═══════════════════════════════════════════════
   LIGHT / DARK MODE  — Bonus #1
═══════════════════════════════════════════════ */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  el('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
}

applyTheme(lsGet('theme', 'light'));

el('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  lsSet('theme', next);
});

/* ═══════════════════════════════════════════════
   CUSTOM NAME — Bonus #2
═══════════════════════════════════════════════ */

function openNameModal() {
  el('name-input').value = lsGet('userName', '');
  el('name-modal').classList.remove('hidden');
  el('name-input').focus();
}

function closeNameModal() { el('name-modal').classList.add('hidden'); }

function saveName() {
  lsSet('userName', el('name-input').value.trim());
  closeNameModal();
  updateClock();
}

el('name-btn').addEventListener('click', openNameModal);
el('name-save').addEventListener('click', saveName);
el('name-cancel').addEventListener('click', closeNameModal);
el('name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter')  saveName();
  if (e.key === 'Escape') closeNameModal();
});

/* ═══════════════════════════════════════════════
   FOCUS TIMER — Bonus #3: Change Pomodoro time
═══════════════════════════════════════════════ */

const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // ≈ 326.73

let timerTotal   = 25 * 60;   // seconds for a full session
let timerLeft    = timerTotal;
let timerTick    = null;
let timerRunning = false;

function renderTimerDisplay() {
  const m = String(Math.floor(timerLeft / 60)).padStart(2, '0');
  const s = String(timerLeft % 60).padStart(2, '0');
  el('timer-display').textContent = `${m}:${s}`;

  // Ring progress
  const pct    = timerTotal > 0 ? timerLeft / timerTotal : 1;
  const offset = RING_CIRCUMFERENCE * (1 - pct);
  const ring   = el('ring-progress');
  ring.style.strokeDashoffset = offset;

  // Colour shifts: warn when ≤ 5 min, done when 0
  ring.classList.toggle('ring-warn', timerLeft <= 300 && timerLeft > 0);
  ring.classList.toggle('ring-done', timerLeft === 0);
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  timerTick = setInterval(() => {
    timerLeft--;
    renderTimerDisplay();
    if (timerLeft <= 0) {
      clearInterval(timerTick);
      timerRunning = false;
      toast('Time is up! Great focus session!', '🎉');
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerTick);
  timerRunning = false;
}

function resetTimer() {
  stopTimer();
  timerLeft = timerTotal;
  renderTimerDisplay();
}

function setCustomTime() {
  const val = parseInt(el('custom-minutes').value, 10);
  if (!val || val < 1 || val > 120) {
    toast('Please enter a number between 1 and 120.', '⚠️');
    return;
  }
  stopTimer();
  timerTotal = val * 60;
  timerLeft  = timerTotal;
  renderTimerDisplay();
}

el('timer-start').addEventListener('click', startTimer);
el('timer-stop').addEventListener('click', stopTimer);
el('timer-reset').addEventListener('click', resetTimer);
el('timer-set').addEventListener('click', setCustomTime);
el('custom-minutes').addEventListener('keydown', e => { if (e.key === 'Enter') setCustomTime(); });

renderTimerDisplay();

/* ═══════════════════════════════════════════════
   TO-DO LIST
═══════════════════════════════════════════════ */

/** @type {Array<{id: number, text: string, done: boolean}>} */
let tasks = lsGet('tasks', []);
let editingTaskId = null;

function saveTasks() { lsSet('tasks', tasks); }

function sortedTasks() {
  const mode = el('sort-select').value;
  const copy = [...tasks];
  switch (mode) {
    case 'az':      return copy.sort((a, b) => a.text.localeCompare(b.text));
    case 'za':      return copy.sort((a, b) => b.text.localeCompare(a.text));
    case 'pending': return copy.sort((a, b) => Number(a.done) - Number(b.done));
    case 'done':    return copy.sort((a, b) => Number(b.done) - Number(a.done));
    default:        return copy;
  }
}

function renderTasks() {
  const list    = el('todo-list');
  const sorted  = sortedTasks();
  const total   = tasks.length;
  const done    = tasks.filter(t => t.done).length;

  // Counter badge
  el('task-counter').textContent = total ? `${done}/${total}` : '';

  // Progress bar
  el('progress-bar').style.width = total ? `${(done / total) * 100}%` : '0%';

  if (total === 0) {
    list.innerHTML = `
      <li class="empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        No tasks yet. Add one above!
      </li>`;
    return;
  }

  list.innerHTML = '';
  sorted.forEach(task => {
    const li = document.createElement('li');
    li.className  = 'todo-item' + (task.done ? ' done' : '');
    li.dataset.id = task.id;
    li.innerHTML  = `
      <input class="todo-check" type="checkbox" ${task.done ? 'checked' : ''} aria-label="Mark done" />
      <span class="task-text">${esc(task.text)}</span>
      <div class="task-actions">
        <button class="btn-edit-ghost task-edit" title="Edit">✏️</button>
        <button class="btn-danger-ghost task-del"  title="Delete">🗑</button>
      </div>`;

    li.querySelector('.todo-check').addEventListener('change',  () => toggleTask(task.id));
    li.querySelector('.task-edit').addEventListener('click',    () => openEditModal(task.id));
    li.querySelector('.task-del').addEventListener('click',     () => deleteTask(task.id));
    list.appendChild(li);
  });
}

function addTask() {
  const text = el('todo-input').value.trim();
  if (!text) return;

  // Prevent duplicates
  if (tasks.some(t => t.text.toLowerCase() === text.toLowerCase())) {
    toast(`"${text}" is already on your list.`, '⚠️');
    return;
  }

  tasks.push({ id: Date.now(), text, done: false });
  saveTasks();
  el('todo-input').value = '';
  renderTasks();
}

function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (t) { t.done = !t.done; saveTasks(); renderTasks(); }
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
}

/* Edit modal */
function openEditModal(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  editingTaskId = id;
  el('edit-input').value = t.text;
  el('edit-modal').classList.remove('hidden');
  el('edit-input').focus();
}

function closeEditModal() { el('edit-modal').classList.add('hidden'); }

function saveEdit() {
  const text = el('edit-input').value.trim();
  if (!text) return;

  if (tasks.some(t => t.id !== editingTaskId && t.text.toLowerCase() === text.toLowerCase())) {
    toast(`"${text}" is already on your list.`, '⚠️');
    return;
  }

  const t = tasks.find(t => t.id === editingTaskId);
  if (t) { t.text = text; saveTasks(); }
  closeEditModal();
  renderTasks();
}

el('todo-add').addEventListener('click', addTask);
el('todo-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
el('sort-select').addEventListener('change', renderTasks);
el('edit-save').addEventListener('click', saveEdit);
el('edit-cancel').addEventListener('click', closeEditModal);
el('edit-input').addEventListener('keydown', e => {
  if (e.key === 'Enter')  saveEdit();
  if (e.key === 'Escape') closeEditModal();
});

renderTasks();

/* ═══════════════════════════════════════════════
   QUICK LINKS
═══════════════════════════════════════════════ */

/** @type {Array<{id: number, label: string, url: string}>} */
let links = lsGet('quickLinks', []);

function saveLinks() { lsSet('quickLinks', links); }

/** Returns a favicon URL via Google's public favicon service. */
function faviconUrl(url) {
  try {
    const origin = new URL(url).origin;
    return `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(origin)}`;
  } catch { return ''; }
}

function renderLinks() {
  const container = el('links-container');

  if (links.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        No links yet. Add one above!
      </div>`;
    return;
  }

  container.innerHTML = '';
  links.forEach(link => {
    const row = document.createElement('div');
    row.className = 'link-row';

    const fav = document.createElement('img');
    fav.className = 'link-favicon';
    fav.src       = faviconUrl(link.url);
    fav.alt       = '';
    fav.onerror   = () => { fav.style.display = 'none'; };

    const a = document.createElement('a');
    a.className = 'link-anchor';
    a.href      = link.url;
    a.target    = '_blank';
    a.rel       = 'noopener noreferrer';
    a.title     = link.url;
    a.textContent = link.label;

    const btn = document.createElement('button');
    btn.className   = 'link-del';
    btn.textContent = '×';
    btn.title       = 'Remove';
    btn.addEventListener('click', () => {
      links = links.filter(l => l.id !== link.id);
      saveLinks();
      renderLinks();
    });

    row.appendChild(fav);
    row.appendChild(a);
    row.appendChild(btn);
    container.appendChild(row);
  });
}

function addLink() {
  const label = el('link-label').value.trim();
  const url   = el('link-url').value.trim();

  if (!label || !url) {
    toast('Please fill in both a label and a URL.', '⚠️');
    return;
  }

  try { new URL(url); }
  catch { toast('Please enter a valid URL starting with https://', '⚠️'); return; }

  links.push({ id: Date.now(), label, url });
  saveLinks();
  el('link-label').value = '';
  el('link-url').value   = '';
  renderLinks();
}

el('link-add').addEventListener('click', addLink);
el('link-url').addEventListener('keydown', e => { if (e.key === 'Enter') addLink(); });

renderLinks();

/* ═══════════════════════════════════════════════
   CLOSE MODALS ON BACKDROP CLICK
═══════════════════════════════════════════════ */
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});
