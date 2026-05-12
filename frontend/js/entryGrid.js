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
  rowCounter++;
  const id = rowCounter;
  const tr = document.createElement('tr');
  tr.id = `row-${id}`;
  tr.className = 'entry-row';
  if (data._editId) tr.dataset.editId = data._editId;

  tr.innerHTML = `
    <td class="row-num"></td>
    <td><select class="row-jira cell-select">${jiraOptsHTML(data.jiraItemId || '')}</select></td>
    <td><select class="row-dev cell-select">${devOptsHTML(data.developer || '')}</select></td>
    <td>
      <input type="text" class="row-activity cell-text"
        value="${esc(data.activityDetails || '')}" placeholder="One-line task summary…" maxlength="500">
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

  for (const { _editId, ...payload } of toSave) {
    if (_editId) {
      await apiPut(`/api/entries/${_editId}`, payload);
    } else {
      await apiPost('/api/entries', payload);
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
