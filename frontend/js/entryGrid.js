function jiraOptsHTML(selectedId = '') {
  return `<option value="">— Select —</option>` +
    jiraItems
      .filter(j => isActive(j) || j.id === selectedId)
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
  const session = getSession();
  const isAdmin = session?.role === 'admin';
  const devName = data.developer || (session?.name ?? '');

  const devCellHtml = isAdmin
    ? `<select class="row-dev cell-select">${devOptsHTML(devName)}</select>`
    : `<select class="row-dev cell-select cell-select-locked" disabled>
         <option value="${esc(devName)}" selected>${esc(devName)}</option>
       </select>`;

  rowCounter++;
  const id = rowCounter;
  const tr = document.createElement('tr');
  tr.id = `row-${id}`;
  tr.className = 'entry-row';
  if (data._editId) tr.dataset.editId = data._editId;

  tr.innerHTML = `
    <td class="row-num"></td>
    <td><select class="row-jira cell-select">${jiraOptsHTML(data.jiraItemId || '')}</select></td>
    <td>${devCellHtml}</td>
    <td>
      <textarea class="row-activity cell-text cell-textarea"
        placeholder="Activity details…" maxlength="500">${esc(data.activityDetails || '')}</textarea>
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
        value="${esc(data.aiDescription || '')}" placeholder="AI tool / approach used…">
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
      jiraId:          jira?.jiraId || '',
      jiraTitle:       jira?.title  || '',
      jiraItemDisplay: jira ? `${jira.jiraId} — ${jira.title}` : '',
      developer, entryDate: date, activityDetails,
      completion, aiUsage, aiDescription, _editId: editId,
    });
  });

  if (hasError)    { toast('Fill in the highlighted required fields', 'error'); return; }
  if (!toSave.length) { toast('No rows to save', 'error'); return; }

  const edits    = toSave.filter(e =>  e._editId);
  const newEntries = toSave.filter(e => !e._editId);

  for (const { _editId, ...payload } of edits) {
    await apiPut(`/api/entries/${_editId}`, payload);
  }

  if (newEntries.length) {
    await apiPost('/api/entries/batch', newEntries);
  }

  const n = toSave.length;
  toast(`${n} entr${n > 1 ? 'ies' : 'y'} saved — summary email sent`);
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
  const today = todayISO();
  document.getElementById('entry-date').value = today;
  document.getElementById('entry-form-title').innerHTML =
    'Add one or more rows below, then click <strong>Save All Entries</strong>.';
  addEntryRow();
  loadEntriesForDate(today);
}

/* ── Date preview & clone ────────────────────────────────────────────────────*/
var datePreviewEntries = [];

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('entry-date').addEventListener('change', function () {
    loadEntriesForDate(this.value);
  });
});

async function loadEntriesForDate(date) {
  const card = document.getElementById('date-preview-card');
  if (!date) { card.classList.add('hidden'); return; }

  const session  = getSession();
  const devParam = session?.role !== 'admin' && session?.name
    ? `&developer=${encodeURIComponent(session.name)}`
    : '';
  const entries = await apiGet(`/api/entries?dateFrom=${date}&dateTo=${date}${devParam}`);
  datePreviewEntries = entries;

  if (!entries.length) { card.classList.add('hidden'); return; }

  document.getElementById('date-preview-title').textContent =
    `${entries.length} existing entr${entries.length > 1 ? 'ies' : 'y'} on ${formatDate(date)}`;

  document.getElementById('clone-btn').classList.toggle('hidden', date === todayISO());

  document.getElementById('date-preview-body').innerHTML = `
    <div class="preview-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>Jira Item</th>
            <th>Developer</th>
            <th>Activity Details</th>
            <th>Completion %</th>
            <th>AI Usage %</th>
            <th>AI Description</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${entries.map((e, i) => `
            <tr>
              <td><span class="jira-id">${esc(e.jiraId || '—')}</span></td>
              <td><span class="dev-badge">${esc(e.developer)}</span></td>
              <td>${esc(e.activityDetails)}</td>
              <td>${e.completion}%</td>
              <td>${e.aiUsage}%</td>
              <td class="ai-desc-cell">${e.aiDescription ? esc(e.aiDescription) : '—'}</td>
              <td><button type="button" class="btn-icon-edit" onclick="cloneOneEntry(${i})">Clone</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  card.classList.remove('hidden');
}

function cloneEntriesToToday() {
  if (!datePreviewEntries.length) return;

  const today = todayISO();
  document.getElementById('entry-date').value = today;
  rowCounter = 0;
  document.getElementById('entry-rows').innerHTML = '';
  datePreviewEntries.forEach(e => addEntryRow({
    jiraItemId:      e.jiraItemId,
    developer:       e.developer,
    activityDetails: e.activityDetails,
    completion:      e.completion,
    aiUsage:         e.aiUsage,
    aiDescription:   e.aiDescription,
  }));
  loadEntriesForDate(today);
  const n = datePreviewEntries.length;
  toast(`${n} row${n > 1 ? 's' : ''} cloned to today`);
}

function cloneOneEntry(index) {
  const e = datePreviewEntries[index];
  if (!e) return;

  document.getElementById('entry-date').value = todayISO();

  const rows = document.querySelectorAll('.entry-row');
  const isEmptyGrid = rows.length === 1 &&
    !rows[0].querySelector('.row-jira').value &&
    !rows[0].querySelector('.row-activity').value;
  if (isEmptyGrid) {
    rowCounter = 0;
    document.getElementById('entry-rows').innerHTML = '';
  }

  addEntryRow({
    jiraItemId:      e.jiraItemId,
    developer:       e.developer,
    activityDetails: e.activityDetails,
    completion:      e.completion,
    aiUsage:         e.aiUsage,
    aiDescription:   e.aiDescription,
  });
  loadEntriesForDate(todayISO());
  toast('Row cloned to today');
}
