const { Router } = require('express');
const { sql, getPool } = require('../db/connection');
const crypto = require('crypto');

const router = Router();
const hashPassword = p => crypto.createHash('sha256').update(p).digest('hex');

// Returns active developer list for login dropdown
router.get('/developers', async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request().query(
      `SELECT DeveloperId AS id, Name AS name
       FROM dbo.ProjectTracker_Developers
       WHERE IsActive = 1
       ORDER BY Name`
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify credentials and return developer info
router.post('/login', async (req, res) => {
  const { developerId, password } = req.body;
  if (!developerId || !password)
    return res.status(400).json({ error: 'Developer and password are required' });

  try {
    const db = await getPool();
    const request = db.request();
    request.input('id',  sql.Int,          parseInt(developerId));
    request.input('pwd', sql.NVarChar(255), hashPassword(password));
    const result = await request.query(
      `SELECT DeveloperId AS id, Name AS name, ISNULL(Role, 'developer') AS role
       FROM dbo.ProjectTracker_Developers
       WHERE DeveloperId = @id AND [Password] = @pwd AND IsActive = 1`
    );
    if (!result.recordset.length)
      return res.status(401).json({ error: 'Invalid name or password' });

    res.json({ developer: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
