const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { sql, getPool } = require('../db/connection');

const router = Router();

router.get('/', async (req, res) => {
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

router.post('/', async (req, res) => {
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

router.put('/:id', async (req, res) => {
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

router.delete('/:id', async (req, res) => {
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

module.exports = router;
