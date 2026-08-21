'use strict';

const express = require('express');
const fs = require('fs-extra');
const chalk = require('chalk');

// ─── SETUP DIRECTORIES ──────────────────────────────────────────
const dirs = ['./session', './data', './temp', './logs', './tmp'];
for (const d of dirs) fs.ensureDirSync(d);

// Requiring index.js runs its startup IIFE as a side effect (session
// restore, module auto-install, etc.) and gives us back the Express router
// it exports.
const router = require('./index');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use('/', router);

app.listen(PORT, () => {
    console.log(chalk.blue(`🌐 Necta API listening on port ${PORT}`));
});

module.exports = app;
