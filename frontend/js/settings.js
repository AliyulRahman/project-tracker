var devEditId  = null;
var devList    = [];

async function loadDevelopers() {
  const result = await apiGet('/api/developers');
  if (!Array.isArray(result)) {
    toast(result?.error || 'Failed to load developers', 'error');
    return;
  }
  devList = result;
  renderDevTable();
}

function renderDevTable() {
  const tbody = document.getElementById('dev-tbody');
  if (!devList.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No developers found.</td></tr>';
    return;
  }
  tbody.innerHTML = devList.map(d => `
    <tr class="dev-row${d.isActive ? '' : ' jira-inactive-row'}" onclick="editDeveloper(${d.id})" title="Click to edit">
      <td>${esc(d.name)}</td>
      <td class="pwd-cell">${d.hasPassword ? '●●●●●●●●' : '<em class="text-muted-sm">Not set</em>'}</td>
      <td><span class="role-badge role-${d.role || 'developer'}">${d.role || 'developer'}</span></td>
      <td class="col-center">
        <input type="checkbox" class="active-toggle" ${d.isActive ? 'checked' : ''} disabled>
      </td>
      <td style="white-space:nowrap">
        <button class="btn-icon-edit" onclick="editDeveloper(${d.id})">Edit</button>
        <button class="btn-icon-del"  onclick="deleteDeveloper(${d.id}); event.stopPropagation();">Del</button>
      </td>
    </tr>`).join('');
}

function editDeveloper(id) {
  const dev = devList.find(d => Number(d.id) === Number(id));
  if (!dev) return;
  devEditId = id;
  document.getElementById('dev-form-title').textContent        = 'Edit Developer';
  document.getElementById('dev-edit-id').value                 = id;
  document.getElementById('dev-name').value                    = dev.name;
  document.getElementById('dev-password').value                = '';
  document.getElementById('dev-password').placeholder          = 'Leave blank to keep current';
  document.getElementById('dev-role').value                    = dev.role || 'developer';
  document.getElementById('dev-active').checked                = !!dev.isActive;
  document.getElementById('dev-submit-btn').textContent        = 'Save Changes';
  document.getElementById('dev-cancel-btn').classList.remove('hidden');
}

function cancelEditDeveloper() {
  devEditId = null;
  document.getElementById('dev-form').reset();
  document.getElementById('dev-form-title').textContent  = 'Add Developer';
  document.getElementById('dev-edit-id').value           = '';
  document.getElementById('dev-password').placeholder    = 'Password';
  document.getElementById('dev-submit-btn').textContent  = 'Add Developer';
  document.getElementById('dev-cancel-btn').classList.add('hidden');
  document.getElementById('dev-active').checked          = true;
}

async function submitDeveloperForm(e) {
  e.preventDefault();
  const name     = document.getElementById('dev-name').value.trim();
  const password = document.getElementById('dev-password').value.trim();
  const role     = document.getElementById('dev-role').value;
  const isActive = document.getElementById('dev-active').checked;

  if (!name) { toast('Name is required', 'error'); return; }
  if (!devEditId && !password) { toast('Password is required for new developers', 'error'); return; }

  if (devEditId) {
    const result = await apiPut(`/api/developers/${devEditId}`, { name, password, role, isActive });
    if (result.error) { toast(result.error, 'error'); return; }
    toast('Developer updated');
  } else {
    const result = await apiPost('/api/developers', { name, password, role, isActive });
    if (result.error) { toast(result.error, 'error'); return; }
    toast('Developer added');
  }

  cancelEditDeveloper();
  await loadDevelopers();
  await loadConfig();
}

async function deleteDeveloper(id) {
  if (!confirm('Delete this developer?\n\nDevelopers with existing entries cannot be deleted — deactivate instead.')) return;
  const result = await apiDelete(`/api/developers/${id}`);
  if (result.error) { toast(result.error, 'error'); return; }
  toast('Developer deleted');
  await loadDevelopers();
  await loadConfig();
}
