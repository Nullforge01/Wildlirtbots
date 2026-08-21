'use strict';

// ═══════════════════════════════════════════════════════════════════════
// Wild Lirt Studio - combined server
//
// Runs the website + Necta + Wild Lirt as ONE Render service. Each bot
// keeps running as its own child process, in its own folder, on its own
// internal port - this matters because both bots' code uses paths like
// './session' that are relative to wherever the process is launched
// FROM (its cwd), not relative to this file. Running them as children
// with cwd set to their own folder means all their existing path logic
// keeps working untouched, and a crash in one bot can't take the other
// bot or the website down with it.
//
// ProCoder X is NOT included here - it stays on its own separate Render
// service (already deployed), so it isn't touched by this file at all.
// ═══════════════════════════════════════════════════════════════════════

const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = process.env.PORT || 3000;       // Render assigns this - only the main server binds it
const NECTA_PORT = 4001;                     // internal only, never exposed directly
const WILD_LIRT_PORT = 4002;                 // internal only, never exposed directly

const app = express();

// ─── STATIC SITE ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── CHILD PROCESS MANAGEMENT ───────────────────────────────────────
function spawnBot(name, cwd, entry, port) {
    console.log(`[SPAWN] Starting ${name} on internal port ${port}...`);
    const child = spawn('node', [entry], {
        cwd,
        env: { ...process.env, PORT: String(port) },
        stdio: 'inherit' // bot's own console.log output shows up in this process's logs too
    });

    child.on('exit', (code) => {
        console.error(`[CRASH] ${name} exited with code ${code}. Restarting in 5s...`);
        setTimeout(() => spawnBot(name, cwd, entry, port), 5000);
    });

    return child;
}

spawnBot('Necta', path.join(__dirname, 'bots', 'necta'), 'server.js', NECTA_PORT);
spawnBot('Wild Lirt', path.join(__dirname, 'bots', 'wild-lirt'), 'index.js', WILD_LIRT_PORT);

// ─── REVERSE PROXY - /api/<bot>/* -> that bot's internal port ───────
// Give each bot's own process a moment to actually bind its port before
// the proxy starts forwarding to it.
setTimeout(() => {
    app.use('/api/necta', createProxyMiddleware({
        target: `http://localhost:${NECTA_PORT}`,
        changeOrigin: true,
        pathRewrite: { '^/api/necta': '' }
    }));

    app.use('/api/wild-lirt', createProxyMiddleware({
        target: `http://localhost:${WILD_LIRT_PORT}`,
        changeOrigin: true,
        pathRewrite: { '^/api/wild-lirt': '' }
    }));

    console.log('[PROXY] Routes wired: /api/necta -> :' + NECTA_PORT + ', /api/wild-lirt -> :' + WILD_LIRT_PORT);
}, 3000);

app.listen(PORT, () => {
    console.log(`[MAIN] Wild Lirt Studio combined server listening on port ${PORT}`);
});
