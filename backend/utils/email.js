const { sql } = require('../db/connection');

const sendMail = async (pool, to, subject, body) => {
  if (!to) return;
  try {
    await pool.request()
      .input('to',      sql.NVarChar, to)
      .input('subject', sql.NVarChar, subject)
      .input('body',    sql.NVarChar, body)
      .query(`EXEC msdb.dbo.sp_send_dbmail
                @recipients  = @to,
                @subject     = @subject,
                @body        = @body,
                @body_format = 'HTML'`);
    console.log(`[Email] Sent → ${to} | ${subject}`);
  } catch (err) {
    console.error(`[Email] Failed → ${to}:`, err.message);
  }
};

const sendEntrySummary = async (pool, entries) => {
  const recipient = process.env.EMAIL_RECIPIENT;
  if (!recipient || !entries.length) return;

  const date = entries[0].entryDate;
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const rows = entries.map((e, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:13px">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">
        <span style="color:#2563eb;font-weight:600;font-size:13px">${e.jiraId || '—'}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b">${e.jiraTitle || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">
        <span style="background:#dbeafe;color:#2563eb;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap">${e.developer}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b">${e.activityDetails}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:13px;font-weight:600;color:#16a34a">${e.completion}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:13px;font-weight:600;color:#7c3aed">${e.aiUsage}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b">${e.aiDescription || '—'}</td>
    </tr>`).join('');

  const body = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:960px;margin:0 auto;background:#f1f5f9;padding:24px">

      <div style="background:#1e293b;padding:20px 28px;border-radius:10px 10px 0 0">
        <h1 style="color:#f8fafc;font-size:20px;margin:0;font-weight:700">DevTracker</h1>
        <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;letter-spacing:.02em">Daily Progress Tracker</p>
      </div>

      <div style="background:#ffffff;padding:24px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">
        <h2 style="font-size:17px;color:#1e293b;margin:0 0 4px;font-weight:700">Daily Entry Summary</h2>
        <p style="font-size:13px;color:#64748b;margin:0 0 24px">
          ${formattedDate} &nbsp;&middot;&nbsp;
          <strong style="color:#1e293b">${entries.length}</strong> entr${entries.length > 1 ? 'ies' : 'y'} saved
        </p>

        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #e2e8f0">#</th>
              <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #e2e8f0">Jira ID</th>
              <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #e2e8f0">Title</th>
              <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #e2e8f0">Developer</th>
              <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #e2e8f0">Activity Details</th>
              <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #e2e8f0">Done&nbsp;%</th>
              <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #e2e8f0">AI&nbsp;%</th>
              <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #e2e8f0">AI Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <p style="font-size:11px;color:#94a3b8;margin:20px 0 0;text-align:right">
          Sent by DevTracker &middot; ${new Date().toLocaleString('en-GB')}
        </p>
      </div>
    </div>`;

  await sendMail(pool, recipient, `DevTracker — Daily Entries: ${date}`, body);
};

module.exports = { sendEntrySummary };
