const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { sql, getPool } = require('../db/connection');
const { sendEntrySummary } = require('../utils/email');

const router = Router();

const ENTRY_SELECT = `
  SELECT
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
  JOIN dbo.ProjectTracker_JiraItems  j ON j.JiraItemId  = e.JiraItemId
  JOIN dbo.ProjectTracker_Developers d ON d.DeveloperId = e.DeveloperId
`;

async function resolveDeveloperId(db, name) {
  const req = db.request();
  req.input('developer', sql.NVarChar(255), name);
  const result = await req.query(
    `SELECT DeveloperId FROM dbo.ProjectTracker_Developers WHERE Name = @developer`
  );
  return result.recordset[0]?.DeveloperId ?? null;
}

router.post('/batch', async (req, res) => {
  const entries = req.body;
  if (!Array.isArray(entries) || !entries.length)
    return res.status(400).json({ error: 'entries array required' });

  try {
    const db   = await getPool();
    const saved = [];

    for (const entry of entries) {
      const { jiraItemId, jiraId, jiraTitle, developer, entryDate, activityDetails, completion, aiUsage, aiDescription } = entry;
      const id = uuidv4();
      const developerId = await resolveDeveloperId(db, developer);
      if (!developerId) return res.status(400).json({ error: `Developer "${developer}" not found` });

      const request = db.request();
      request.input('id',              sql.UniqueIdentifier,   id);
      request.input('jiraItemId',      sql.UniqueIdentifier,   jiraItemId);
      request.input('developerId',     sql.Int,                developerId);
      request.input('entryDate',       sql.Date,               entryDate);
      request.input('activityDetails', sql.NVarChar(sql.MAX),  activityDetails ?? null);
      request.input('completion',      sql.TinyInt,            completion ?? 0);
      request.input('aiUsage',         sql.TinyInt,            aiUsage ?? 0);
      request.input('aiDescription',   sql.NVarChar(sql.MAX),  aiDescription ?? null);
      await request.query(
        `INSERT INTO dbo.ProjectTracker_Entries
           (EntryId, JiraItemId, DeveloperId, EntryDate, ActivityDetails, Completion, AiUsage, AiDescription)
         VALUES
           (@id, @jiraItemId, @developerId, @entryDate, @activityDetails, @completion, @aiUsage, @aiDescription)`
      );
      saved.push({ id, jiraId, jiraTitle, developer, entryDate, activityDetails, completion, aiUsage, aiDescription });
    }

    sendEntrySummary(db, saved).catch(err => console.error('[Email] batch send failed:', err.message));

    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
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
      `${ENTRY_SELECT} ${where} ORDER BY e.EntryDate DESC, e.CreatedAt DESC`
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = await getPool();
    const request = db.request();
    request.input('id', sql.UniqueIdentifier, req.params.id);
    const result = await request.query(
      `${ENTRY_SELECT} WHERE e.EntryId = @id`
    );
    if (result.recordset.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { jiraItemId, developer, entryDate, activityDetails, completion, aiUsage, aiDescription } = req.body;
  const id = uuidv4();
  try {
    const db = await getPool();
    const developerId = await resolveDeveloperId(db, developer);
    if (!developerId) return res.status(400).json({ error: `Developer "${developer}" not found` });

    const request = db.request();
    request.input('id',              sql.UniqueIdentifier,   id);
    request.input('jiraItemId',      sql.UniqueIdentifier,   jiraItemId);
    request.input('developerId',     sql.Int,                developerId);
    request.input('entryDate',       sql.Date,               entryDate);
    request.input('activityDetails', sql.NVarChar(sql.MAX),  activityDetails ?? null);
    request.input('completion',      sql.TinyInt,            completion ?? 0);
    request.input('aiUsage',         sql.TinyInt,            aiUsage ?? 0);
    request.input('aiDescription',   sql.NVarChar(sql.MAX),  aiDescription ?? null);
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

router.put('/:id', async (req, res) => {
  const { jiraItemId, developer, entryDate, activityDetails, completion, aiUsage, aiDescription } = req.body;
  try {
    const db = await getPool();
    const developerId = await resolveDeveloperId(db, developer);
    if (!developerId) return res.status(400).json({ error: `Developer "${developer}" not found` });

    const request = db.request();
    request.input('id',              sql.UniqueIdentifier,   req.params.id);
    request.input('jiraItemId',      sql.UniqueIdentifier,   jiraItemId);
    request.input('developerId',     sql.Int,                developerId);
    request.input('entryDate',       sql.Date,               entryDate);
    request.input('activityDetails', sql.NVarChar(sql.MAX),  activityDetails ?? null);
    request.input('completion',      sql.TinyInt,            completion ?? 0);
    request.input('aiUsage',         sql.TinyInt,            aiUsage ?? 0);
    request.input('aiDescription',   sql.NVarChar(sql.MAX),  aiDescription ?? null);
    const result = await request.query(
      `UPDATE dbo.ProjectTracker_Entries
       SET JiraItemId = @jiraItemId, DeveloperId = @developerId, EntryDate = @entryDate,
           ActivityDetails = @activityDetails, Completion = @completion,
           AiUsage = @aiUsage, AiDescription = @aiDescription
       WHERE EntryId = @id`
    );
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Not found' });

    // Fetch full entry (with jiraId/jiraTitle) to send email summary
    const updated = await db.request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .query(`${ENTRY_SELECT} WHERE e.EntryId = @id`);
    sendEntrySummary(db, updated.recordset).catch(err =>
      console.error('[Email] edit send failed:', err.message)
    );

    res.json({ id: req.params.id, jiraItemId, developer, entryDate, activityDetails, completion, aiUsage, aiDescription });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
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

module.exports = router;
