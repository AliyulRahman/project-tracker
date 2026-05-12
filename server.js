require('dotenv').config();
const app = require('./backend/app');

const PORT = process.env.APP_PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n  DevTracker running at http://localhost:${PORT}\n`);
});
