'use strict';

const express = require('express');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = process.env.PORT || 3000;
const NECTA_PORT = 4001;
const WILD_LIRT_PORT = 4002;

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

function spawnBot(name, cwd, entry, port) {
    console.log(`[SPAWN] Starting ${name} on internal port ${port}...`);
    const child = spawn('node', [entry], {
        cwd,
        env: { ...process.env, PORT: String(port) },
        stdio: 'inherit'
    });

    child.on('exit', (code) => {
        console.error(`[CRASH] ${name} exited with code ${code}. Restarting in 5s...`);
        setTimeout(() => spawnBot(name, cwd, entry, port), 5000);
    });

    return child;
}

spawnBot('Necta', path.join(__dirname, 'bots', 'necta'), 'server.js', NECTA_PORT);
spawnBot('Wild Lirt', path.join(__dirname, 'bots', 'wild-lirt'), 'index.js', WILD_LIRT_PORT);

function waitForPort(port, name, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        (function attempt() {
            const socket = net.connect(port, '127.0.0.1');
            socket.once('connect', () => {
                socket.destroy();
                console.log(`[READY] ${name} is listening on port ${port} (took ${((Date.now() - start) / 1000).toFixed(1)}s)`);
                resolve();
            });
            socket.once('error', () => {
                socket.destroy();
                if (Date.now() - start > timeoutMs) {
                    return reject(new Error(`${name} never came up on port ${port} within ${timeoutMs / 1000}s`));
                }
                setTimeout(attempt, 1000);
            });
        })();
    });
}

waitForPort(NECTA_PORT, 'Necta').then(() => {
    app.use('/api/necta', createProxyMiddleware({
        target: `http://localhost:${NECTA_PORT}`,
        changeOrigin: true,
        pathRewrite: { '^/api/necta': '' }
    }));
    console.log('[PROXY] /api/necta -> :' + NECTA_PORT);
}).catch(err => console.error('[PROXY ERROR]', err.message));

waitForPort(WILD_LIRT_PORT, 'Wild Lirt').then(() => {
    app.use('/api/wild-lirt', createProxyMiddleware({
        target: `http://localhost:${WILD_LIRT_PORT}`,
        changeOrigin: true,
        pathRewrite: { '^/api/wild-lirt': '' }
    }));
    console.log('[PROXY] /api/wild-lirt -> :' + WILD_LIRT_PORT);
}).catch(err => console.error('[PROXY ERROR]', err.message));

app.listen(PORT, () => {
    console.log(`[MAIN] Wild Lirt Studio combined server listening on port ${PORT}`);
});
