const { Router } = require('express');
const { sql, getPool } = require('../db/connection');

const router = Router();

router.get('/', async (req, res) => {
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

router.put('/', async (req, res) => {
  const { developers } = req.body;
  if (!Array.isArray(developers)) {
    return res.status(400).json({ error: 'developers must be an array' });
  }

  try {
    const db = await getPool();
    const tx = new sql.Transaction(db);
    await tx.begin();

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

module.exports = router;
