var jiraEditId = null;

function isActive(j) {
  return j.active !== false;
}

async function loadJiraItems() {
  jiraItems = await apiGet('/api/jira-items');
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
        : '<span class="text-muted-sm">—</span>'}</td>
      <td class="col-center">
        <input type="checkbox" class="active-toggle" ${isActive(j) ? 'checked' : ''}
          onchange="toggleJiraActive('${j.id}', this.checked)" title="Toggle active">
      </td>
      <td style="white-space:nowrap">
        <button class="btn-icon-edit" onclick="editJiraItem('${j.id}')">Edit</button>
        <button class="btn-icon-del"  onclick="deleteJiraItem('${j.id}')">Delete</button>
      </td>
    </tr>`).join('');
}

function editJiraItem(id) {
  const j = jiraItems.find(i => i.id === id);
  if (!j) return;
  jiraEditId = id;
  document.getElementById('jira-form-title').textContent     = 'Edit Jira Item';
  document.getElementById('jira-edit-id').value              = id;
  document.getElementById('jira-id').value                   = j.jiraId;
  document.getElementById('jira-title').value                = j.title;
  document.getElementById('jira-url').value                  = j.url || '';
  document.getElementById('jira-active').checked             = isActive(j);
  document.getElementById('jira-submit-btn').textContent     = 'Save Changes';
  document.getElementById('jira-cancel-btn').classList.remove('hidden');
  document.getElementById('jira-id').focus();
}

function cancelEditJiraItem() {
  jiraEditId = null;
  document.getElementById('jira-form').reset();
  document.getElementById('jira-form-title').textContent  = 'Add Jira Item';
  document.getElementById('jira-edit-id').value           = '';
  document.getElementById('jira-submit-btn').textContent  = 'Add Item';
  document.getElementById('jira-cancel-btn').classList.add('hidden');
  document.getElementById('jira-active').checked          = true;
}

async function submitJiraItem(e) {
  e.preventDefault();
  const jiraId = document.getElementById('jira-id').value.trim();
  const title  = document.getElementById('jira-title').value.trim();
  const url    = document.getElementById('jira-url').value.trim() || null;
  const active = document.getElementById('jira-active').checked;

  const duplicate = jiraItems.some(i =>
    i.jiraId.toLowerCase() === jiraId.toLowerCase() && i.id !== jiraEditId
  );
  if (duplicate) { toast('Jira ID already exists', 'error'); return; }

  if (jiraEditId) {
    const result = await apiPut(`/api/jira-items/${jiraEditId}`, { jiraId, title, url, active });
    if (result.error) { toast(result.error, 'error'); return; }
    toast('Jira item updated');
  } else {
    const result = await apiPost('/api/jira-items', { jiraId, title, url, active });
    if (result.error) { toast(result.error, 'error'); return; }
    toast('Jira item added');
  }

  cancelEditJiraItem();
  await loadJiraItemsList();
}

async function toggleJiraActive(id, active) {
  await apiPut(`/api/jira-items/${id}`, { active });
  await loadJiraItems();
  toast(active ? 'Item marked active' : 'Item marked inactive');
  document.querySelectorAll('#jira-tbody tr').forEach(row => {
    const cb = row.querySelector('.active-toggle');
    if (cb) row.classList.toggle('jira-inactive-row', !cb.checked);
  });
}

async function deleteJiraItem(id) {
  if (!confirm('Delete this Jira item?')) return;
  const result = await apiDelete(`/api/jira-items/${id}`);
  if (result.error) { toast(result.error, 'error'); return; }
  await loadJiraItemsList();
  toast('Jira item deleted');
}
