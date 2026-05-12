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
  await apiPut(`/api/jira-items/${id}`, { active });
  await loadJiraItems();
  toast(active ? 'Item marked active' : 'Item marked inactive');
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

  await apiPost('/api/jira-items', { jiraId, title, url, active });
  document.getElementById('jira-form').reset();
  document.getElementById('jira-active').checked = true;
  await loadJiraItemsList();
  toast('Jira item added');
}

async function deleteJiraItem(id) {
  if (!confirm('Delete this Jira item?')) return;
  await apiDelete(`/api/jira-items/${id}`);
  await loadJiraItemsList();
  toast('Jira item deleted');
}
