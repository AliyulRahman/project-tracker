async function loadEntries() {
  const params   = new URLSearchParams();
  const dev      = document.getElementById('filter-developer').value;
  const dateFrom = document.getElementById('filter-date-from').value;
  const dateTo   = document.getElementById('filter-date-to').value;
  const jira     = document.getElementById('filter-jira').value;

  if (dev)      params.set('developer', dev);
  if (dateFrom) params.set('dateFrom',  dateFrom);
  if (dateTo)   params.set('dateTo',    dateTo);
  if (jira)     params.set('jiraItem',  jira);

  const entries = await apiGet('/api/entries?' + params);
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
  const entry   = await apiGet(`/api/entries/${id}`);
  currentEditId = id;
  rowCounter    = 0;
  document.getElementById('entry-rows').innerHTML   = '';
  document.getElementById('entry-date').value       = entry.entryDate;
  document.getElementById('entry-form-title').innerHTML =
    'Editing entry — update the row and click <strong>Save All Entries</strong>.';
  addEntryRow({ ...entry, _editId: id });
  showSection('new-entry');
}

async function deleteEntry(id) {
  if (!confirm('Delete this entry? This cannot be undone.')) return;
  await apiDelete(`/api/entries/${id}`);
  await loadEntries();
  toast('Entry deleted');
}

function applyFilters() { loadEntries(); }

function clearFilters() {
  ['filter-developer', 'filter-jira'].forEach(id => document.getElementById(id).value = '');
  ['filter-date-from', 'filter-date-to'].forEach(id => document.getElementById(id).value = '');
  loadEntries();
}

async function exportCSV() {
  const entries = await apiGet('/api/entries');
  if (!entries.length) { toast('No entries to export', 'error'); return; }

  const headers = ['Date', 'Jira ID', 'Jira Title', 'Developer', 'Activity Details', 'Completion %', 'AI Usage %', 'AI Description'];
  const rows    = entries.map(e => [
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
  const a    = Object.assign(document.createElement('a'), { href: url, download: `devtracker-${todayISO()}.csv` });
  a.click();
  URL.revokeObjectURL(url);
  toast('Exported to CSV');
}
