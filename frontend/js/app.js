/* ── Shared state ────────────────────────────────────────────────────────────*/
var jiraItems     = [];
var developers    = [];
var currentEditId = null;
var rowCounter    = 0;

/* ── Navigation ──────────────────────────────────────────────────────────────*/
const SECTION_TITLES = {
  'dashboard':  'Dashboard',
  'new-entry':  'New Daily Entry',
  'entries':    'All Entries',
  'jira-items': 'Jira Items',
  'settings':   'Settings',
};

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => showSection(item.dataset.section));
  });
}

function showSection(id) {
  document.querySelectorAll('.nav-item').forEach(i =>
    i.classList.toggle('active', i.dataset.section === id));
  document.querySelectorAll('.section').forEach(s =>
    s.classList.toggle('active', s.id === `section-${id}`));
  document.getElementById('page-title').textContent = SECTION_TITLES[id] || '';

  if (id === 'dashboard')  loadDashboard();
  if (id === 'entries')    loadEntries();
  if (id === 'jira-items') loadJiraItemsList();
  if (id === 'settings')   renderSettings();
  if (id === 'new-entry' && !currentEditId) resetGrid();
}

/* ── Config ──────────────────────────────────────────────────────────────────*/
async function loadConfig() {
  const cfg = await apiGet('/api/config');
  developers = cfg.developers || [];
  populateDevDropdowns();
}

function populateDevDropdowns() {
  const opts = developers.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
  document.getElementById('filter-developer').innerHTML =
    `<option value="">All Developers</option>${opts}`;
}

/* ── Boot ────────────────────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', async () => {
  updateDateDisplay();
  setupNavigation();
  document.getElementById('jira-form').addEventListener('submit', submitJiraItem);
  document.getElementById('settings-form').addEventListener('submit', saveSettings);
  await loadConfig();
  await loadJiraItems();
  resetGrid();
  await loadDashboard();
});
