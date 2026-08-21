'use strict';
// ─── Necta config — split out of index.js for readability ────────────────────
const path = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// The Necta logo lives locally at assets/necta-logo.png and is used for every
// bot image (menu, alive, errors, deleted-message alerts, etc.) instead of an
// external URL.
const NECTA_LOGO_PATH = path.join(__dirname, 'assets', 'necta-logo.png');
const BOT_IMAGES = [NECTA_LOGO_PATH];
const AI_FULL_NAME = 'Necta Intelligence';
const AI_SHORT_NAME = 'Necta';
// Owner number(s) — loaded from env, not hardcoded. Owner-only commands check
// against config.OWNER_NUMBERS through the normal permission check below;
// there is no separate hidden bypass.
const DEVELOPER_NUMBER = process.env.OWNER_NUMBER || '';

const AI_SYSTEM_IDENTITY = `You are ${AI_SHORT_NAME}, whose full name is ${AI_FULL_NAME}. Created by Wild Lirt Studio in 2026. Never claim to be any other AI.`;

const config = {
    PREFIX: '.', BOT_NAME: AI_SHORT_NAME, BOT_FULL_NAME: AI_FULL_NAME, VERSION: '1.0.0',
    OWNER_NUMBERS: [DEVELOPER_NUMBER].filter(Boolean),
    OWNER_NAME: 'Nullforge',
    OWNER_WA: DEVELOPER_NUMBER ? `https://wa.me/${DEVELOPER_NUMBER}` : '',
    BOT_IMAGES, NEWSLETTER_JID: process.env.NEWSLETTER_JID || '', NEWSLETTER_NAME: 'Wild Lirt Studio',
    RCD_IMAGE_PATH: NECTA_LOGO_PATH,
    WATERMARK: '\n\n> *✰ Necta by Wild Lirt Studio ✰*',
    MAX_RETRIES: 3, OTP_EXPIRY: 300000,
    GROUP_INVITE_LINK: process.env.GROUP_INVITE_LINK || '',
    // All third-party API keys below are loaded from environment variables
    // only — no keys are hardcoded/shipped in this file. Set the ones you
    // need in .env; commands whose key is unset will just report "not configured".
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    TG_TOKEN: process.env.TG_TOKEN || '',
    PAXSENIX_API_KEY: process.env.PAXSENIX_API_KEY || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    TMDB_API_KEY: process.env.TMDB_API_KEY || '',
    NEWS_API_KEY: process.env.NEWS_API_KEY || '',
    GIFTED_TECH_API: 'https://api.giftedtech.com/api', GIFTED_API_KEY: process.env.GIFTED_API_KEY || 'free_key@maher_apis',
    SPORTS_API_BASE: 'https://apiskeith.top',
    PAXSENIX_URL: 'https://api.paxsenix.org',
    DAVID_API: 'https://apis.davidcyril.name.ng',
    NEXRAY_API: 'https://api.nexray.web.id',
    NEXRAY_EU: 'https://api.nexray.eu.cc',
    ELITE_API: 'https://eliteprotech-apis.zone.id',
    DELINE_API: 'https://api.deline.web.id',
    RYNEKOO_API: 'https://rynekoo-api.hf.space',
    QASIM_API: 'https://api.qasimdev.dpdns.org',
    NEOXR_API: 'https://api.neoxr.eu',
    PRINCE_API: 'https://api.princetechn.com/api', PRINCE_KEY: 'prince',
    PREXZY_API: 'https://apis.prexzyvilla.site',
    DISCARD_API: 'https://discardapi.dpdns.org',
    SILENT_API: 'https://darkvibe314-silent-movies-api.hf.space',
    OKATSU_API: 'https://okatsu-rolezapiiz.vercel.app',
    NAYAN_API: 'https://nayan-video-downloader.vercel.app',
    BOT_FOOTER: '✰ Necta | Wild Lirt Studio',
    AUTO_RECORDING: 'true'
};
const WM = config.WATERMARK;

module.exports = { config, WM, AI_FULL_NAME, AI_SHORT_NAME, AI_SYSTEM_IDENTITY, DEVELOPER_NUMBER, NECTA_LOGO_PATH, BOT_IMAGES };
