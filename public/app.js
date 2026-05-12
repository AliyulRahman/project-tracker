/* ── State ───────────────────────────────────────────────────────────────────*/
let jiraItems    = [];
let developers   = [];
let currentEditId = null;
let rowCounter   = 0;

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

/* ── Date helpers ────────────────────────────────────────────────────────────*/
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function updateDateDisplay() {
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('current-date').textContent =
    new Date().toLocaleDateString('en-US', opts);

  document.getElementById('today-label').textContent =
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

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

/* ── Config / Developers ─────────────────────────────────────────────────────*/
async function loadConfig() {
  const cfg = await fetch('/api/config').then(r => r.json());
  developers = cfg.developers || [];
  populateDevDropdowns();
}

function populateDevDropdowns() {
  const opts = developers.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
  document.getElementById('filter-developer').innerHTML =
    `<option value="">All Developers</option>${opts}`;
}

function renderSettings() {
  document.getElementById('dev-inputs').innerHTML = developers.map((d, i) => `
    <div class="dev-input-row">
      <label>Developer ${i + 1}</label>
      <input type="text" data-index="${i}" value="${esc(d)}" placeholder="Developer name" required>
    </div>`).join('');
}

async function saveSettings(e) {
  e.preventDefault();
  const inputs = document.querySelectorAll('#dev-inputs input');
  const updated = [...inputs].map(i => i.value.trim()).filter(Boolean);
  await fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ developers: updated }),
  });
  developers = updated;
  populateDevDropdowns();
  toast('Settings saved');
}

/* ── Jira Items ──────────────────────────────────────────────────────────────*/
function isActive(j) {
  return j.active !== false; // items without the field default to active
}

async function loadJiraItems() {
  jiraItems = await fetch('/api/jira-items').then(r => r.json());
  document.getElementById('filter-jira').innerHTML =
    `<option value="">All Items</option>` +
    jiraItems.map(j => `<option value="${j.id}">${esc(j.jiraId)}</option>`).join('');
}

async function loadJiraItemsList() {
  await loadJiraItems();
  const tbody = document.getElementById('jira-tbody');
  if (!jiraItems.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No Jira items added yet.</td></tr>';
    return;
  }
  tbody.innerHTML = jiraItems.map(j => `
    <tr class="${isActive(j) ? '' : 'jira-inactive-row'}">
      <td><span class="jira-id">${esc(j.jiraId)}</span></td>
      <td>${esc(j.title)}</td>
      <td>${j.url
        ? `<a href="${esc(j.url)}" target="_blank" rel="noopener" class="jira-link">Open ↗</a>`
        : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td style="text-align:center">
        <input type="checkbox" class="active-toggle" ${isActive(j) ? 'checked' : ''}
          onchange="toggleJiraActive('${j.id}', this.checked)" title="Toggle active">
      </td>
      <td>
        <button class="btn-icon-del" onclick="deleteJiraItem('${j.id}')">Delete</button>
      </td>
    </tr>`).join('');
}

async function toggleJiraActive(id, active) {
  await fetch(`/api/jira-items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  });
  await loadJiraItems(); // refresh dropdown options in grid
  toast(active ? 'Item marked active' : 'Item marked inactive');
  // Re-render the list row styles without a full reload
  document.querySelectorAll('#jira-tbody tr').forEach(row => {
    const cb = row.querySelector('.active-toggle');
    if (cb) row.classList.toggle('jira-inactive-row', !cb.checked);
  });
}

async function submitJiraItem(e) {
  e.preventDefault();
  const jiraId = document.getElementById('jira-id').value.trim();
  const title  = document.getElementById('jira-title').value.trim();
  const url    = document.getElementById('jira-url').value.trim();
  const active = document.getElementById('jira-active').checked;

  if (jiraItems.some(i => i.jiraId.toLowerCase() === jiraId.toLowerCase())) {
    toast('Jira ID already exists', 'error');
    return;
  }

  await fetch('/api/jira-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jiraId, title, url, active }),
  });

  document.getElementById('jira-form').reset();
  document.getElementById('jira-active').checked = true; // reset to default
  await loadJiraItemsList();
  toast('Jira item added');
}

async function deleteJiraItem(id) {
  if (!confirm('Delete this Jira item?')) return;
  await fetch(`/api/jira-items/${id}`, { method: 'DELETE' });
  await loadJiraItemsList();
  toast('Jira item deleted');
}

/* ── Entry Grid ──────────────────────────────────────────────────────────────*/
function jiraOptsHTML(selectedId = '') {
  return `<option value="">— Select —</option>` +
    jiraItems
      .filter(j => isActive(j) || j.id === selectedId) // always show the selected item even if deactivated mid-edit
      .map(j =>
        `<option value="${j.id}"${j.id === selectedId ? ' selected' : ''}>${esc(j.jiraId)} — ${esc(j.title)}</option>`
      ).join('');
}

function devOptsHTML(selectedDev = '') {
  return `<option value="">— Select —</option>` +
    developers.map(d =>
      `<option value="${esc(d)}"${d === selectedDev ? ' selected' : ''}>${esc(d)}</option>`
    ).join('');
}

function addEntryRow(data = {}) {
  rowCounter++;
  const id = rowCounter;
  const tr = document.createElement('tr');
  tr.id = `row-${id}`;
  tr.className = 'entry-row';
  if (data._editId) tr.dataset.editId = data._editId;

  tr.innerHTML = `
    <td class="row-num"></td>
    <td>
      <select class="row-jira cell-select">${jiraOptsHTML(data.jiraItemId || '')}</select>
    </td>
    <td>
      <select class="row-dev cell-select">${devOptsHTML(data.developer || '')}</select>
    </td>
    <td>
      <input type="text" class="row-activity cell-text"
        value="${esc(data.activityDetails || '')}"
        placeholder="One-line task summary…" maxlength="500">
    </td>
    <td>
      <div class="pct-wrap">
        <input type="number" class="row-completion pct-field" min="0" max="100" value="${data.completion ?? 0}">
        <span class="pct-sym">%</span>
      </div>
    </td>
    <td>
      <div class="pct-wrap">
        <input type="number" class="row-ai-usage pct-field" min="0" max="100" value="${data.aiUsage ?? 0}">
        <span class="pct-sym">%</span>
      </div>
    </td>
    <td>
      <input type="text" class="row-ai-desc cell-text"
        value="${esc(data.aiDescription || '')}"
        placeholder="AI tool / approach used…">
    </td>
    <td>
      <button type="button" class="row-del" onclick="removeEntryRow(${id})" title="Remove row">✕</button>
    </td>`;

  document.getElementById('entry-rows').appendChild(tr);
  reNumberRows();
}

function removeEntryRow(id) {
  document.getElementById(`row-${id}`)?.remove();
  reNumberRows();
  if (!document.querySelectorAll('.entry-row').length) addEntryRow();
}

function reNumberRows() {
  document.querySelectorAll('.entry-row').forEach((r, i) => {
    r.querySelector('.row-num').textContent = i + 1;
  });
}

async function saveAllEntries() {
  const date = document.getElementById('entry-date').value;
  if (!date) { toast('Please select an entry date', 'error'); return; }

  const rows   = document.querySelectorAll('.entry-row');
  const toSave = [];
  let hasError = false;

  rows.forEach(row => {
    const jiraItemId      = row.querySelector('.row-jira').value;
    const developer       = row.querySelector('.row-dev').value;
    const activityDetails = row.querySelector('.row-activity').value.trim();
    const completion      = Math.min(100, Math.max(0, parseInt(row.querySelector('.row-completion').value, 10) || 0));
    const aiUsage         = Math.min(100, Math.max(0, parseInt(row.querySelector('.row-ai-usage').value,    10) || 0));
    const aiDescription   = row.querySelector('.row-ai-desc').value.trim();
    const editId          = row.dataset.editId || null;

    const missing = !jiraItemId || !developer || !activityDetails;
    row.classList.toggle('row-error', missing);
    if (missing) { hasError = true; return; }

    const jira = jiraItems.find(i => i.id === jiraItemId);
    toSave.push({
      jiraItemId,
      jiraId:          jira?.jiraId  || '',
      jiraTitle:       jira?.title   || '',
      jiraItemDisplay: jira ? `${jira.jiraId} — ${jira.title}` : '',
      developer, entryDate: date, activityDetails,
      completion, aiUsage, aiDescription, _editId: editId,
    });
  });

  if (hasError) { toast('Fill in the highlighted required fields', 'error'); return; }
  if (!toSave.length) { toast('No rows to save', 'error'); return; }

  for (const { _editId, ...payload } of toSave) {
    if (_editId) {
      await fetch(`/api/entries/${_editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
  }

  const n = toSave.length;
  toast(`${n} entr${n > 1 ? 'ies' : 'y'} saved`);
  currentEditId = null;
  resetGrid();
  showSection('entries');
}

function clearAllRows() {
  rowCounter = 0;
  document.getElementById('entry-rows').innerHTML = '';
  addEntryRow();
}

function resetGrid() {
  currentEditId = null;
  rowCounter    = 0;
  document.getElementById('entry-rows').innerHTML = '';
  document.getElementById('entry-date').value     = todayISO();
  document.getElementById('entry-form-title').innerHTML =
    'Add one or more rows below, then click <strong>Save All Entries</strong>.';
  addEntryRow();
}

async function loadEntries() {
  const params = new URLSearchParams();
  const dev      = document.getElementById('filter-developer').value;
  const dateFrom = document.getElementById('filter-date-from').value;
  const dateTo   = document.getElementById('filter-date-to').value;
  const jira     = document.getElementById('filter-jira').value;

  if (dev)      params.set('developer', dev);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo)   params.set('dateTo', dateTo);
  if (jira)     params.set('jiraItem', jira);

  const entries = await fetch('/api/entries?' + params).then(r => r.json());
  renderEntriesTable(entries);
}

function renderEntriesTable(entries) {
  const tbody = document.getElementById('entries-tbody');
  if (!entries.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">No entries found.</td></tr>';
    return;
  }
  tbody.innerHTML = entries.map(e => `
    <tr>
      <td style="white-space:nowrap">${formatDate(e.entryDate)}</td>
      <td><span class="jira-id">${esc(e.jiraId || '—')}</span></td>
      <td><span class="dev-badge">${esc(e.developer)}</span></td>
      <td style="max-width:260px">${esc(e.activityDetails)}</td>
      <td>
        <div class="progress-bar"><div class="progress-fill completion" style="width:${e.completion}%"></div></div>
        <div class="progress-label">${e.completion}%</div>
      </td>
      <td>
        <div class="progress-bar"><div class="progress-fill ai" style="width:${e.aiUsage}%"></div></div>
        <div class="progress-label">${e.aiUsage}%</div>
      </td>
      <td style="max-width:180px;font-size:12px;color:var(--text-muted)">
        ${e.aiDescription ? esc(e.aiDescription) : '<em style="opacity:.5">—</em>'}
      </td>
      <td style="white-space:nowrap">
        <button class="btn-icon-edit" onclick="editEntry('${e.id}')">Edit</button>
        <button class="btn-icon-del"  onclick="deleteEntry('${e.id}')">Del</button>
      </td>
    </tr>`).join('');
}

async function editEntry(id) {
  const entry   = await fetch(`/api/entries/${id}`).then(r => r.json());
  currentEditId = id;

  rowCounter = 0;
  document.getElementById('entry-rows').innerHTML = '';
  document.getElementById('entry-date').value     = entry.entryDate;
  document.getElementById('entry-form-title').innerHTML = 'Editing entry — update the row and click <strong>Save All Entries</strong>.';
  addEntryRow({ ...entry, _editId: id });

  showSection('new-entry');
}

async function deleteEntry(id) {
  if (!confirm('Delete this entry? This cannot be undone.')) return;
  await fetch(`/api/entries/${id}`, { method: 'DELETE' });
  await loadEntries();
  toast('Entry deleted');
}


function applyFilters() { loadEntries(); }

function clearFilters() {
  ['filter-developer', 'filter-jira'].forEach(id => document.getElementById(id).value = '');
  ['filter-date-from', 'filter-date-to'].forEach(id => document.getElementById(id).value = '');
  loadEntries();
}

/* ── Dashboard ───────────────────────────────────────────────────────────────*/
async function loadDashboard() {
  const all    = await fetch('/api/entries').then(r => r.json());
  const today  = todayISO();
  const todayE = all.filter(e => e.entryDate === today);

  document.getElementById('stat-today').textContent = todayE.length;
  document.getElementById('stat-total').textContent = all.length;

  if (todayE.length) {
    const avgC = Math.round(todayE.reduce((s, e) => s + e.completion, 0) / todayE.length);
    const avgA = Math.round(todayE.reduce((s, e) => s + e.aiUsage,    0) / todayE.length);
    document.getElementById('stat-completion').textContent = avgC + '%';
    document.getElementById('stat-ai').textContent         = avgA + '%';
  } else {
    document.getElementById('stat-completion').textContent = '—';
    document.getElementById('stat-ai').textContent         = '—';
  }

  /* Today's entries list */
  const todayDiv = document.getElementById('today-entries');
  if (!todayE.length) {
    todayDiv.innerHTML = '<div class="empty-state">No entries for today yet.</div>';
  } else {
    todayDiv.innerHTML = todayE.map(e => `
      <div class="today-entry">
        <span class="dev-badge">${esc(e.developer)}</span>
        <div class="today-entry-detail">
          <div class="today-entry-jira">${esc(e.jiraId)}</div>
          <div class="today-entry-activity">${esc(e.activityDetails)}</div>
        </div>
        <div class="today-entry-pct">
          <div class="progress-bar" style="margin-left:auto">
            <div class="progress-fill completion" style="width:${e.completion}%"></div>
          </div>
          <div class="progress-label">${e.completion}% done</div>
        </div>
        ${e.aiUsage > 0 ? `<span class="ai-tag">AI ${e.aiUsage}%</span>` : ''}
      </div>`).join('');
  }

  /* Per-developer progress */
  const devDiv = document.getElementById('dev-progress');
  const activeDevs = developers.filter(d => todayE.some(e => e.developer === d));
  if (!activeDevs.length) {
    devDiv.innerHTML = '<div class="empty-state">No data available.</div>';
  } else {
    devDiv.innerHTML = activeDevs.map(dev => {
      const de   = todayE.filter(e => e.developer === dev);
      const avgC = Math.round(de.reduce((s, e) => s + e.completion, 0) / de.length);
      const avgA = Math.round(de.reduce((s, e) => s + e.aiUsage,    0) / de.length);
      return `
        <div class="dev-progress-item">
          <div class="dev-progress-header">
            <span class="dev-name">${esc(dev)}</span>
            <span class="dev-stats">${de.length} task${de.length > 1 ? 's' : ''} · AI ${avgA}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill completion" style="width:${avgC}%"></div>
          </div>
          <div class="progress-label">${avgC}% avg completion</div>
        </div>`;
    }).join('');
  }

  /* Recent 5 entries */
  const recentDiv = document.getElementById('recent-entries');
  const recent = all.slice(0, 5);
  if (!recent.length) {
    recentDiv.innerHTML = '<div class="empty-state">No entries found.</div>';
    return;
  }
  recentDiv.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th><th>Jira Item</th><th>Developer</th>
          <th>Activity</th><th>Completion</th><th>AI Usage</th>
        </tr>
      </thead>
      <tbody>
        ${recent.map(e => `
          <tr>
            <td style="white-space:nowrap">${formatDate(e.entryDate)}</td>
            <td><span class="jira-id">${esc(e.jiraId || '—')}</span></td>
            <td><span class="dev-badge">${esc(e.developer)}</span></td>
            <td style="max-width:260px">${esc(e.activityDetails)}</td>
            <td>
              <div class="progress-bar"><div class="progress-fill completion" style="width:${e.completion}%"></div></div>
              <div class="progress-label">${e.completion}%</div>
            </td>
            <td><span class="ai-tag">AI ${e.aiUsage}%</span></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

/* ── CSV Export ──────────────────────────────────────────────────────────────*/
async function exportCSV() {
  const entries = await fetch('/api/entries').then(r => r.json());
  if (!entries.length) { toast('No entries to export', 'error'); return; }

  const headers = ['Date','Jira ID','Jira Title','Developer','Activity Details','Completion %','AI Usage %','AI Description'];
  const rows = entries.map(e => [
    e.entryDate,
    csvCell(e.jiraId),
    csvCell(e.jiraTitle),
    csvCell(e.developer),
    csvCell(e.activityDetails),
    e.completion,
    e.aiUsage,
    csvCell(e.aiDescription),
  ]);

  const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: `devtracker-${todayISO()}.csv`
  });
  a.click();
  URL.revokeObjectURL(url);
  toast('Exported to CSV');
}

function csvCell(v) {
  return `"${String(v || '').replace(/"/g, '""')}"`;
}

/* ── Toast ───────────────────────────────────────────────────────────────────*/
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast show${type === 'error' ? ' error' : ''}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 3000);
}

/* ── XSS helper ──────────────────────────────────────────────────────────────*/
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
