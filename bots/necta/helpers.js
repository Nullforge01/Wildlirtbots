'use strict';
// ─── Necta helpers — pure/standalone utility functions split out of index.js ──
// These don't depend on an active socket or in-flight message, so they're
// safe to isolate here without touching the command-handling logic.

function isValidBuffer(buf) {
    return Buffer.isBuffer(buf) && buf.length > 16 * 1024;
}

function generateId() { return Math.random().toString(36).substring(2, 7).toUpperCase(); }

function parseTime(input) { const now = new Date(); const rm = input.match(/^(?:(\d+)h)?(?:(\d+)m)?$/i); if (rm && (rm[1] || rm[2])) { const h = parseInt(rm[1] || '0'), mn = parseInt(rm[2] || '0'); if (h === 0 && mn === 0) return null; return new Date(now.getTime() + (h * 60 + mn) * 60 * 1000); } const cm = input.match(/^(\d{1,2}):(\d{2})(am|pm)?$/i); if (cm) { let h = parseInt(cm[1]), mn2 = parseInt(cm[2]), mer = cm[3]?.toLowerCase(); if (mer === 'pm' && h < 12) h += 12; if (mer === 'am' && h === 12) h = 0; const t = new Date(now); t.setHours(h, mn2, 0, 0); if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1); return t; } return null; }

function formatTimeLeft(ms) { if (ms <= 0) return 'now'; const ts = Math.floor(ms / 1000), h = Math.floor(ts / 3600), m = Math.floor((ts % 3600) / 60), s = ts % 60; const p = []; if (h) p.push(`${h}h`); if (m) p.push(`${m}m`); if (s || !p.length) p.push(`${s}s`); return p.join(' '); }

const formatMessage = (t, c, f) => `*${t}*\n\n${c}\n\n> *${f}*`;

const fmtBytes = (b, d = 2) => { if (!b) return '0 B'; const k = 1024, s = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(b) / Math.log(k)); return parseFloat((b / Math.pow(k, i)).toFixed(d < 0 ? 0 : d)) + ' ' + s[i]; };

function getCurrentDateTime() {
    const now = new Date(), opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' };
    return { formatted: now.toLocaleString('en-US', opts), timestamp: now.getTime(), day: now.toLocaleDateString('en-US', { weekday: 'long' }), date: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
}

module.exports = { isValidBuffer, generateId, parseTime, formatTimeLeft, formatMessage, fmtBytes, getCurrentDateTime };
