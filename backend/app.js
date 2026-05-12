const express = require('express');
const cors = require('cors');
const path = require('path');

const configRoutes    = require('./routes/config.routes');
const jiraItemRoutes  = require('./routes/jiraItems.routes');
const entriesRoutes   = require('./routes/entries.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/config',     configRoutes);
app.use('/api/jira-items', jiraItemRoutes);
app.use('/api/entries',    entriesRoutes);

module.exports = app;
