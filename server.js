require('dotenv').config();
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const sql = require('mssql/msnodesqlv8');

const app = express();
const PORT = process.env.APP_PORT || 3000;

const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  driver: process.env.DB_DRIVER,
  port: 1433,
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
  },
};

let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
  }
  return pool;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Config ────────────────────────────────────────────────────────────────────

app.get('/api/config', async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request().query(
      `SELECT Name FROM dbo.ProjectTracker_Developers WHERE IsActive = 1 ORDER BY Name`
    );
    res.json({ developers: result.recordset.map(r => r.Name) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/config', async (req, res) => {
  // Replaces the active developer list: deactivates removed names, adds new ones
  const { developers } = req.body;
  if (!Array.isArray(developers)) return res.status(400).json({ error: 'developers must be an array' });

  try {
    const db = await getPool();
    const tx = new sql.Transaction(db);
    await tx.begin();

    // Deactivate all, then activate only the submitted names
    await tx.request().query(`UPDATE dbo.ProjectTracker_Developers SET IsActive = 0`);

    for (const name of developers) {
      const req1 = tx.request();
      req1.input('name', sql.NVarChar(255), name);
      const exists = await req1.query(
        `SELECT DeveloperId FROM dbo.ProjectTracker_Developers WHERE Name = @name`
      );
      if (exists.recordset.length > 0) {
        const req2 = tx.request();
        req2.input('name', sql.NVarChar(255), name);
        await req2.query(`UPDATE dbo.ProjectTracker_Developers SET IsActive = 1 WHERE Name = @name`);
      } else {
        const req3 = tx.request();
        req3.input('name', sql.NVarChar(255), name);
        await req3.query(`INSERT INTO dbo.ProjectTracker_Developers (Name, IsActive) VALUES (@name, 1)`);
      }
    }

    await tx.commit();
    res.json({ developers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Jira Items ────────────────────────────────────────────────────────────────

app.get('/api/jira-items', async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request().query(
      `SELECT JiraItemId AS id, JiraId AS jiraId, Title AS title, Url AS url,
              IsActive AS active, CreatedAt AS createdAt, UpdatedAt AS updatedAt
       FROM dbo.ProjectTracker_JiraItems
       ORDER BY CreatedAt DESC`
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jira-items', async (req, res) => {
  const { jiraId, title, url = null, active = true } = req.body;
  const id = uuidv4();
  try {
    const db = await getPool();
    const request = db.request();
    request.input('id',     sql.UniqueIdentifier, id);
    request.input('jiraId', sql.NVarChar(50),     jiraId);
    request.input('title',  sql.NVarChar(500),    title);
    request.input('url',    sql.NVarChar(2048),   url);
    request.input('active', sql.Bit,              active ? 1 : 0);
    await request.query(
      `INSERT INTO dbo.ProjectTracker_JiraItems (JiraItemId, JiraId, Title, Url, IsActive)
       VALUES (@id, @jiraId, @title, @url, @active)`
    );
    res.status(201).json({ id, jiraId, title, url, active, createdAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/jira-items/:id', async (req, res) => {
  const { jiraId, title, url, active } = req.body;
  try {
    const db = await getPool();
    const request = db.request();
    request.input('id',     sql.UniqueIdentifier, req.params.id);
    request.input('jiraId', sql.NVarChar(50),     jiraId);
    request.input('title',  sql.NVarChar(500),    title);
    request.input('url',    sql.NVarChar(2048),   url ?? null);
    request.input('active', sql.Bit,              active ? 1 : 0);
    const result = await request.query(
      `UPDATE dbo.ProjectTracker_JiraItems
       SET JiraId = @jiraId, Title = @title, Url = @url, IsActive = @active,
           UpdatedAt = SYSUTCDATETIME()
       WHERE JiraItemId = @id`
    );
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ id: req.params.id, jiraId, title, url, active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/jira-items/:id', async (req, res) => {
  try {
    const db = await getPool();
    const request = db.request();
    request.input('id', sql.UniqueIdentifier, req.params.id);
    await request.query(`DELETE FROM dbo.ProjectTracker_JiraItems WHERE JiraItemId = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Entries ───────────────────────────────────────────────────────────────────

app.get('/api/entries', async (req, res) => {
  const { developer, dateFrom, dateTo, jiraItem } = req.query;
  try {
    const db = await getPool();
    const request = db.request();

    let where = `WHERE 1 = 1`;

    if (developer) {
      request.input('developer', sql.NVarChar(255), developer);
      where += ` AND d.Name = @developer`;
    }
    if (dateFrom) {
      request.input('dateFrom', sql.Date, dateFrom);
      where += ` AND e.EntryDate >= @dateFrom`;
    }
    if (dateTo) {
      request.input('dateTo', sql.Date, dateTo);
      where += ` AND e.EntryDate <= @dateTo`;
    }
    if (jiraItem) {
      request.input('jiraItem', sql.UniqueIdentifier, jiraItem);
      where += ` AND e.JiraItemId = @jiraItem`;
    }

    const result = await request.query(
      `SELECT
         e.EntryId          AS id,
         e.JiraItemId       AS jiraItemId,
         j.JiraId           AS jiraId,
         j.Title            AS jiraTitle,
         j.JiraId + N' — ' + j.Title AS jiraItemDisplay,
         d.Name             AS developer,
         CONVERT(VARCHAR(10), e.EntryDate, 120) AS entryDate,
         e.ActivityDetails  AS activityDetails,
         e.Completion       AS completion,
         e.AiUsage          AS aiUsage,
         e.AiDescription    AS aiDescription,
         e.CreatedAt        AS createdAt
       FROM dbo.ProjectTracker_Entries e
       JOIN dbo.ProjectTracker_JiraItems    j ON j.JiraItemId  = e.JiraItemId
       JOIN dbo.ProjectTracker_Developers   d ON d.DeveloperId = e.DeveloperId
       ${where}
       ORDER BY e.EntryDate DESC, e.CreatedAt DESC`
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/entries/:id', async (req, res) => {
  try {
    const db = await getPool();
    const request = db.request();
    request.input('id', sql.UniqueIdentifier, req.params.id);
    const result = await request.query(
      `SELECT
         e.EntryId          AS id,
         e.JiraItemId       AS jiraItemId,
         j.JiraId           AS jiraId,
         j.Title            AS jiraTitle,
         j.JiraId + N' — ' + j.Title AS jiraItemDisplay,
         d.Name             AS developer,
         CONVERT(VARCHAR(10), e.EntryDate, 120) AS entryDate,
         e.ActivityDetails  AS activityDetails,
         e.Completion       AS completion,
         e.AiUsage          AS aiUsage,
         e.AiDescription    AS aiDescription,
         e.CreatedAt        AS createdAt
       FROM dbo.ProjectTracker_Entries e
       JOIN dbo.ProjectTracker_JiraItems    j ON j.JiraItemId  = e.JiraItemId
       JOIN dbo.ProjectTracker_Developers   d ON d.DeveloperId = e.DeveloperId
       WHERE e.EntryId = @id`
    );
    if (result.recordset.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/entries', async (req, res) => {
  const { jiraItemId, developer, entryDate, activityDetails, completion, aiUsage, aiDescription } = req.body;
  const id = uuidv4();
  try {
    const db = await getPool();

    // Resolve developer name to DeveloperId
    const devReq = db.request();
    devReq.input('developer', sql.NVarChar(255), developer);
    const devResult = await devReq.query(
      `SELECT DeveloperId FROM dbo.ProjectTracker_Developers WHERE Name = @developer`
    );
    if (devResult.recordset.length === 0) return res.status(400).json({ error: `Developer "${developer}" not found` });
    const developerId = devResult.recordset[0].DeveloperId;

    const request = db.request();
    request.input('id',              sql.UniqueIdentifier, id);
    request.input('jiraItemId',      sql.UniqueIdentifier, jiraItemId);
    request.input('developerId',     sql.Int,              developerId);
    request.input('entryDate',       sql.Date,             entryDate);
    request.input('activityDetails', sql.NVarChar(sql.MAX), activityDetails ?? null);
    request.input('completion',      sql.TinyInt,          completion ?? 0);
    request.input('aiUsage',         sql.TinyInt,          aiUsage ?? 0);
    request.input('aiDescription',   sql.NVarChar(sql.MAX), aiDescription ?? null);

    await request.query(
      `INSERT INTO dbo.ProjectTracker_Entries
         (EntryId, JiraItemId, DeveloperId, EntryDate, ActivityDetails, Completion, AiUsage, AiDescription)
       VALUES
         (@id, @jiraItemId, @developerId, @entryDate, @activityDetails, @completion, @aiUsage, @aiDescription)`
    );

    res.status(201).json({ id, jiraItemId, developer, entryDate, activityDetails, completion, aiUsage, aiDescription, createdAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/entries/:id', async (req, res) => {
  const { jiraItemId, developer, entryDate, activityDetails, completion, aiUsage, aiDescription } = req.body;
  try {
    const db = await getPool();

    // Resolve developer name to DeveloperId
    const devReq = db.request();
    devReq.input('developer', sql.NVarChar(255), developer);
    const devResult = await devReq.query(
      `SELECT DeveloperId FROM dbo.ProjectTracker_Developers WHERE Name = @developer`
    );
    if (devResult.recordset.length === 0) return res.status(400).json({ error: `Developer "${developer}" not found` });
    const developerId = devResult.recordset[0].DeveloperId;

    const request = db.request();
    request.input('id',              sql.UniqueIdentifier, req.params.id);
    request.input('jiraItemId',      sql.UniqueIdentifier, jiraItemId);
    request.input('developerId',     sql.Int,              developerId);
    request.input('entryDate',       sql.Date,             entryDate);
    request.input('activityDetails', sql.NVarChar(sql.MAX), activityDetails ?? null);
    request.input('completion',      sql.TinyInt,          completion ?? 0);
    request.input('aiUsage',         sql.TinyInt,          aiUsage ?? 0);
    request.input('aiDescription',   sql.NVarChar(sql.MAX), aiDescription ?? null);

    const result = await request.query(
      `UPDATE dbo.ProjectTracker_Entries
       SET JiraItemId = @jiraItemId, DeveloperId = @developerId, EntryDate = @entryDate,
           ActivityDetails = @activityDetails, Completion = @completion,
           AiUsage = @aiUsage, AiDescription = @aiDescription
       WHERE EntryId = @id`
    );
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ id: req.params.id, jiraItemId, developer, entryDate, activityDetails, completion, aiUsage, aiDescription });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/entries/:id', async (req, res) => {
  try {
    const db = await getPool();
    const request = db.request();
    request.input('id', sql.UniqueIdentifier, req.params.id);
    await request.query(`DELETE FROM dbo.ProjectTracker_Entries WHERE EntryId = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  DevTracker running at http://localhost:${PORT}\n`);
});
