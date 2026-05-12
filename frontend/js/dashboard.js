async function loadDashboard() {
  const all    = await apiGet('/api/entries');
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

  const devDiv     = document.getElementById('dev-progress');
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

  const recentDiv = document.getElementById('recent-entries');
  const recent    = all.slice(0, 5);
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
