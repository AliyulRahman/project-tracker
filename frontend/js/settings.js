function renderSettings() {
  document.getElementById('dev-inputs').innerHTML = developers.map((d, i) => `
    <div class="dev-input-row">
      <label>Developer ${i + 1}</label>
      <input type="text" data-index="${i}" value="${esc(d)}" placeholder="Developer name" required>
    </div>`).join('');
}

async function saveSettings(e) {
  e.preventDefault();
  const inputs  = document.querySelectorAll('#dev-inputs input');
  const updated = [...inputs].map(i => i.value.trim()).filter(Boolean);
  await apiPut('/api/config', { developers: updated });
  developers = updated;
  populateDevDropdowns();
  toast('Settings saved');
}
