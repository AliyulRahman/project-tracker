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
  if (id === 'settings')   loadDevelopers();
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

/* ── Auth ────────────────────────────────────────────────────────────────────*/
function getSession() {
  return JSON.parse(sessionStorage.getItem('devtracker_user') || 'null');
}

function logout() {
  sessionStorage.removeItem('devtracker_user');
  window.location.href = '/login.html';
}

/* ── Boot ────────────────────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', async () => {
  const session = getSession();
  if (!session) { window.location.href = '/login.html'; return; }

  // Show logged-in user in header
  const initials = session.name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('user-avatar').textContent     = initials;
  document.getElementById('current-user').textContent    = session.name;

  // Restrict nav and UI for non-admins
  const isAdmin = session.role === 'admin';
  if (!isAdmin) {
    ['dashboard', 'jira-items', 'settings'].forEach(s =>
      document.querySelector(`[data-section="${s}"]`)?.classList.add('hidden')
    );
    // Hide developer filter in All Entries (developers only see their own entries)
    document.getElementById('filter-developer')?.closest('.filter-group')?.classList.add('hidden');
  }

  updateDateDisplay();
  setupNavigation();
  document.getElementById('jira-form').addEventListener('submit', submitJiraItem);
  document.getElementById('dev-form').addEventListener('submit', submitDeveloperForm);
  await loadConfig();
  await loadJiraItems();

  if (isAdmin) {
    await loadDashboard();
  } else {
    showSection('new-entry');
  }
});
