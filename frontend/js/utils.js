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

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast show${type === 'error' ? ' error' : ''}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 3000);
}

function csvCell(v) {
  return `"${String(v || '').replace(/"/g, '""')}"`;
}
