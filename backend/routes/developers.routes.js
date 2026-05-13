const { Router } = require('express');
const { sql, getPool } = require('../db/connection');
const crypto = require('crypto');

const router = Router();

const hashPassword = p => crypto.createHash('sha256').update(p).digest('hex');

router.get('/', async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request().query(
      `SELECT DeveloperId                                          AS id,
              Name                                               AS name,
              ISNULL(Role, 'developer')                         AS role,
              CAST(IsActive AS BIT)                             AS isActive,
              CASE WHEN [Password] IS NOT NULL THEN 1 ELSE 0 END AS hasPassword
       FROM dbo.ProjectTracker_Developers ORDER BY Name`
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, password, role, isActive } = req.body;
  if (!name || !password || !role)
    return res.status(400).json({ error: 'name, password and role are required' });

  try {
    const db = await getPool();
    const request = db.request();
    request.input('name',     sql.NVarChar(255), name);
    request.input('password', sql.NVarChar(255), hashPassword(password));
    request.input('role',     sql.NVarChar(50),  role);
    request.input('isActive', sql.Bit,           isActive !== false ? 1 : 0);
    const result = await request.query(
      `INSERT INTO dbo.ProjectTracker_Developers (Name, Password, Role, IsActive)
       OUTPUT INSERTED.DeveloperId AS id
       VALUES (@name, @password, @role, @isActive)`
    );
    res.status(201).json({ id: result.recordset[0].id, name, role, isActive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, password, role, isActive } = req.body;
  if (!name || !role)
    return res.status(400).json({ error: 'name and role are required' });

  try {
    const db = await getPool();
    const request = db.request();
    request.input('id',       sql.Int,           parseInt(req.params.id));
    request.input('name',     sql.NVarChar(255), name);
    request.input('role',     sql.NVarChar(50),  role);
    request.input('isActive', sql.Bit,           isActive !== false ? 1 : 0);

    if (password) {
      request.input('password', sql.NVarChar(255), hashPassword(password));
      await request.query(
        `UPDATE dbo.ProjectTracker_Developers
         SET Name = @name, Password = @password, Role = @role, IsActive = @isActive
         WHERE DeveloperId = @id`
      );
    } else {
      await request.query(
        `UPDATE dbo.ProjectTracker_Developers
         SET Name = @name, Role = @role, IsActive = @isActive
         WHERE DeveloperId = @id`
      );
    }
    res.json({ id: req.params.id, name, role, isActive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = await getPool();
    const check = await db.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`SELECT COUNT(*) AS cnt FROM dbo.ProjectTracker_Entries WHERE DeveloperId = @id`);

    if (check.recordset[0].cnt > 0)
      return res.status(409).json({ error: 'Cannot delete a developer who has entries. Deactivate instead.' });

    await db.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`DELETE FROM dbo.ProjectTracker_Developers WHERE DeveloperId = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
