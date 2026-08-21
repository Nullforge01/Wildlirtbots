/*
   BOT NAME: Necta
   FULL NAME: Necta Intelligence
   DEVELOPER: Nullforge
   BUILT BY: Wild Lirt Studio
   VERSION: 1.0.0
   COPYRIGHT: © Nullforge / Wild Lirt Studio. All Rights Reserved.
*/
'use strict';

require('dotenv').config();

const fs = require('fs-extra');
const path = require('path');
const { exec, execSync } = require('child_process');
const crypto = require('crypto');
const os = require('os');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

// ─── AUTO MODULE INSTALLER ────────────────────────────────────────────────────
const REQUIRED_MODULES = [
    '@whiskeysockets/baileys','@octokit/rest','axios','chalk','express',
    'form-data','fs-extra','moment-timezone','node-telegram-bot-api','pino',
    'qrcode','yt-search','@distube/ytdl-core','openai','cheerio',
    'sharp','fluent-ffmpeg','@vitalets/google-translate-api','denethdev-ytmp3',
    'node-fetch','ruhend-scraper','yt-dlp-exec','file-type','node-id3'
];
function autoInstallModules() {
    const missing = [];
    for (const mod of REQUIRED_MODULES) { try { require.resolve(mod); } catch { missing.push(mod); } }
    if (missing.length > 0) {
        console.log(`\n📦 Installing ${missing.length} missing modules: ${missing.join(', ')}\n`);
        try { execSync(`npm install ${missing.join(' ')} --save --legacy-peer-deps`, { stdio: 'inherit' }); console.log('\n✅ Modules installed!\n'); }
        catch (e) { console.error('⚠️ Install error:', e.message); }
    }
}
autoInstallModules();

// ─── SAFE LOADER ──────────────────────────────────────────────────────────────
function safeRequire(name, fallback) { try { return require(name); } catch { console.warn(`⚠️ Missing: ${name}`); return fallback; } }

// ─── CHALK ────────────────────────────────────────────────────────────────────
let chalk;
try { chalk = require('chalk'); }
catch { const id = s => s; chalk = new Proxy(id, { get: (t, p) => { if (typeof p === 'string' && /^(bold|cyan|green|red|yellow|blue|magenta|white|gray|dim|underline)$/i.test(p)) return chalk; return id; }, apply: (t, th, a) => a[0] }); }

// ─── DEPS ─────────────────────────────────────────────────────────────────────
let express = safeRequire('express', null);
let router = express ? express.Router() : { get: () => {}, post: () => {}, use: () => {} };
const pino = safeRequire('pino', () => () => ({ level: 'silent', info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, child: () => ({ level: 'fatal' }) }));
const OctokitPkg = safeRequire('@octokit/rest', null);
const { Octokit } = OctokitPkg || { Octokit: class { constructor() { this.repos = { getContent: async () => ({}), createOrUpdateFileContents: async () => ({}), deleteFile: async () => ({}) }; } } };
const moment = safeRequire('moment-timezone', () => { const f = () => ({ tz: () => ({ format: () => new Date().toISOString() }) }); return f; });
const axios = safeRequire('axios', { get: async () => ({ data: {} }), post: async () => ({ data: {} }) });
const FormData = safeRequire('form-data', class FD { append() {} getHeaders() { return {}; } });
const QRCode = safeRequire('qrcode', { toBuffer: async () => Buffer.from([]) });
const TelegramBot = safeRequire('node-telegram-bot-api', class { constructor() {} onText() {} on() {} sendMessage() {} answerCallbackQuery() {} deleteMessage() {} sendPhoto() {} });
const yts = safeRequire('yt-search', () => ({ search: async () => ({ videos: [] }) }));
const ytdl = safeRequire('@distube/ytdl-core', null);
let ytdlp; try { ytdlp = safeRequire('yt-dlp-exec', null); } catch (_) { ytdlp = null; }
const OpenAI = safeRequire('openai', null);
const cheerio = safeRequire('cheerio', () => ({ load: () => ({}) }));
const translate = safeRequire('@vitalets/google-translate-api', { translate: async () => ({ text: '' }) });
const ffmpeg = safeRequire('fluent-ffmpeg', null);
const ddownr = safeRequire('denethdev-ytmp3', null);
const sharp = safeRequire('sharp', null);

// ─── BAILEYS ──────────────────────────────────────────────────────────────────
const bf = {
    default: () => ({}), useMultiFileAuthState: async () => ({ state: { creds: {}, keys: {} }, saveCreds: () => {} }),
    delay: ms => new Promise(r => setTimeout(r, ms)), getContentType: () => 'conversation',
    makeCacheableSignalKeyStore: k => k, Browsers: { macOS: () => [] },
    jidNormalizedUser: j => j, downloadContentFromMessage: async () => (async function* () { yield Buffer.from([]); })(),
    fetchLatestBaileysVersion: async () => ({ version: [2, 3000, 1015901307] }),
    DisconnectReason: { loggedOut: 401 }, proto: {}, prepareWAMessageMedia: async () => ({}),
    generateWAMessageFromContent: () => ({}), S_WHATSAPP_NET: '@s.whatsapp.net',
    downloadMediaMessage: async () => Buffer.from([])
};
const B = safeRequire('@whiskeysockets/baileys', bf);
const makeWASocket = B.default || bf.default;
const useMultiFileAuthState = B.useMultiFileAuthState || bf.useMultiFileAuthState;
const delay = B.delay || bf.delay;
const getContentType = B.getContentType || bf.getContentType;
const makeCacheableSignalKeyStore = B.makeCacheableSignalKeyStore || bf.makeCacheableSignalKeyStore;
const Browsers = B.Browsers || bf.Browsers;
const jidNormalizedUser = B.jidNormalizedUser || bf.jidNormalizedUser;
const downloadContentFromMessage = B.downloadContentFromMessage || bf.downloadContentFromMessage;
const fetchLatestBaileysVersion = B.fetchLatestBaileysVersion || bf.fetchLatestBaileysVersion;
const DisconnectReason = B.DisconnectReason || bf.DisconnectReason;
const proto = B.proto || bf.proto;
const prepareWAMessageMedia = B.prepareWAMessageMedia || bf.prepareWAMessageMedia;
const generateWAMessageFromContent = B.generateWAMessageFromContent || bf.generateWAMessageFromContent;
const downloadMediaMessage = B.downloadMediaMessage || bf.downloadMediaMessage;

let sms; try { ({ sms } = require('./msg')); } catch { sms = (s, m) => m; }

// ─── CONFIG (moved to config.js) ─────────────────────────────────────────────
const { config, WM, AI_FULL_NAME, AI_SHORT_NAME, AI_SYSTEM_IDENTITY, DEVELOPER_NUMBER, NECTA_LOGO_PATH, BOT_IMAGES } = require('./config');

// ─── PAXSENIX ─────────────────────────────────────────────────────────────────
const PAXSENIX = {
    BASE: 'https://api.paxsenix.org', KEY: config.PAXSENIX_API_KEY,
    headers: { Authorization: `Bearer ${config.PAXSENIX_API_KEY}`, 'Content-Type': 'application/json' },
    async get(ep) { const r = await axios.get(`${this.BASE}${ep}`, { headers: this.headers, timeout: 60000 }); return r.data; },
    async post(ep, data) { const r = await axios.post(`${this.BASE}${ep}`, data, { headers: this.headers, timeout: 60000 }); return r.data; }
};

// ─── HOSTIFY (GROK) ───────────────────────────────────────────────────────────
const HOSTIFY = {
    BASE_URL: 'https://api.hostify.indevs.in/api',
    EP: { GROK: '/ai/grok', LYRICS: '/search/lyrics' },
    TIMEOUT: 30000, RETRIES: 2, RETRY_DELAY: 1000
};
async function hostifyPost(ep, body = {}) {
    for (let i = 0; i <= HOSTIFY.RETRIES; i++) {
        try { return (await axios.post(HOSTIFY.BASE_URL + ep, body, { headers: { 'Content-Type': 'application/json' }, timeout: HOSTIFY.TIMEOUT })).data; }
        catch (e) { if (i === HOSTIFY.RETRIES) throw e; await delay(HOSTIFY.RETRY_DELAY); }
    }
}

// ─── MULTI-API HUB ────────────────────────────────────────────────────────────
const APIS = {
    imageGen: p => [
        `${config.NEXRAY_EU}/ai/gptimage?param=${encodeURIComponent(p)}`,
        `${config.NEXRAY_API}/ai/gptimage?prompt=${encodeURIComponent(p)}`,
        `https://api.siputzx.my.id/api/ai/flux?prompt=${encodeURIComponent(p)}`,
        `https://stable.stacktoy.workers.dev/?apikey=Suhail&prompt=${encodeURIComponent(p)}`,
        `https://dalle.stacktoy.workers.dev/?apikey=Suhail&prompt=${encodeURIComponent(p)}`,
        `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=1024&height=1024&nologo=true`,
        `https://api.dreaded.site/api/dalle?text=${encodeURIComponent(p)}`
    ],
    download: {
        nayanYtInfo: u => `${config.NAYAN_API}/youtube?url=${encodeURIComponent(u)}`,
        nayanYtDown: u => `${config.NAYAN_API}/ytdown?url=${encodeURIComponent(u)}`,
        nayanYtSearch: q => `${config.NAYAN_API}/ytsearch?query=${encodeURIComponent(q)}`,
        nayanIg: u => `${config.NAYAN_API}/instagram?url=${encodeURIComponent(u)}`,
        nayanAio: u => `${config.NAYAN_API}/alldown?url=${encodeURIComponent(u)}`,
        ytmp3Prince: u => `${config.PRINCE_API}/download/ytmp3?apikey=${config.PRINCE_KEY}&url=${encodeURIComponent(u)}`,
        ytmp4Prince: u => `${config.PRINCE_API}/download/ytmp4?apikey=${config.PRINCE_KEY}&url=${encodeURIComponent(u)}`,
        ytvPrince: u => `${config.PRINCE_API}/download/ytv?apikey=${config.PRINCE_KEY}&url=${encodeURIComponent(u)}`,
        ytaudioPrince: u => `${config.PRINCE_API}/download/ytaudio?apikey=${config.PRINCE_KEY}&format=128kbps&url=${encodeURIComponent(u)}`,
        ytDownload: (u, type = 'audio', fmt = 'mp3') => `${config.PREXZY_API}/download/ytdownload?url=${encodeURIComponent(u)}&type=${type}&format=${fmt}`,
        tiktokPrexzy: u => `${config.PREXZY_API}/download/tiktokvideo?url=${encodeURIComponent(u)}`,
        saveweb2zip: u => `${config.PREXZY_API}/download/saveweb2zip?url=${encodeURIComponent(u)}`,
        mediafirePrexzy: u => `${config.PREXZY_API}/download/mediafire?url=${encodeURIComponent(u)}`,
        aio: u => `${config.PREXZY_API}/download/aio?url=${encodeURIComponent(u)}`,
        ytmp3: u => `${config.NEXRAY_API}/downloader/ytmp3?url=${encodeURIComponent(u)}`,
        ytplayvid: u => `${config.NEXRAY_API}/downloader/ytplayvid?url=${encodeURIComponent(u)}`,
        ytmp3Elite: u => `${config.ELITE_API}/ytdown?format=mp3&url=${encodeURIComponent(u)}`,
        ytmp4Elite: u => `${config.ELITE_API}/ytmp4?url=${encodeURIComponent(u)}`,
        fbElite: u => `${config.ELITE_API}/facebook?url=${encodeURIComponent(u)}`,
        ytDavid: u => `${config.DAVID_API}/download/youtube?url=${encodeURIComponent(u)}`,
        mediafire: u => `${config.DAVID_API}/download/mediafire?url=${encodeURIComponent(u)}`,
        twitter: u => `${config.DAVID_API}/download/twitter?url=${encodeURIComponent(u)}`,
        gdrive: u => `${config.DAVID_API}/download/googledrive?url=${encodeURIComponent(u)}`,
        website: u => `${config.DAVID_API}/download/website?url=${encodeURIComponent(u)}`,
        spotify: u => `${config.DAVID_API}/download/spotify?url=${encodeURIComponent(u)}`,
        igstory: u => `${config.DELINE_API}/downloader/igstory?url=${encodeURIComponent(u)}`,
        threads: u => `${config.DELINE_API}/downloader/threads?url=${encodeURIComponent(u)}`,
        apk: q => `${config.ELITE_API}/fdriod?query=${encodeURIComponent(q)}`,
        apkPure: q => `${config.QASIM_API}/api/apkpure/search?q=${encodeURIComponent(q)}`
    },
    ai: {
        gptimageEu: p => `${config.NEXRAY_EU}/ai/gptimage?param=${encodeURIComponent(p)}`,
        text2imageEu: `${config.NEXRAY_EU}/ai/v1/text2image`,
        nanoBananaEu: `${config.NEXRAY_EU}/ai/nanobanana`,
        advanced: (t, mode = '') => `${config.PREXZY_API}/ai/advanced?text=${encodeURIComponent(t)}${mode ? '&mode=' + mode : ''}`,
        gpt4: q => `https://api.dreaded.site/api/chatgpt4?text=${encodeURIComponent(q)}`,
        gemini: q => `https://api.dreaded.site/api/gemini?text=${encodeURIComponent(q)}`,
        llama: q => `${config.NEXRAY_API}/ai/llamacoder?model=qwen3-coder&prompt=${encodeURIComponent(q)}`,
        deepseek: q => `https://api.dreaded.site/api/deepseek?text=${encodeURIComponent(q)}`,
        mathgpt: q => `${config.ELITE_API}/mathgpt?question=${encodeURIComponent(q)}`,
        sologo: p => `${config.NEXRAY_API}/ai/sologo?prompt=${encodeURIComponent(p)}`,
        stablesd: p => `${config.DAVID_API}/tools/stablediffusion?prompt=${encodeURIComponent(p)}`,
        txt2vid: p => `${config.OKATSU_API}/ai/txt2video?text=${encodeURIComponent(p)}`
    },
    search: {
        ytsPrince: q => `${config.PRINCE_API}/search/yts?apikey=${config.PRINCE_KEY}&query=${encodeURIComponent(q)}`,
        nayanYts: q => `${config.NAYAN_API}/ytsearch?query=${encodeURIComponent(q)}`,
        lyricsPrince: q => `${config.PRINCE_API}/search/lyricsv2?apikey=${config.PRINCE_KEY}&query=${encodeURIComponent(q)}`,
        wiki: q => `${config.NEXRAY_API}/search/wikipedia?query=${encodeURIComponent(q)}`,
        pinterest: q => `${config.DAVID_API}/search/pinterest?query=${encodeURIComponent(q)}`,
        github: q => `${config.NEXRAY_API}/search/github?query=${encodeURIComponent(q)}`,
        yts: q => `${config.ELITE_API}/ytsearch?query=${encodeURIComponent(q)}`,
        bingImage: q => `${config.NEXRAY_API}/search/bingimage?query=${encodeURIComponent(q)}`,
        googleImage: q => `${config.NEXRAY_API}/search/googleimage?query=${encodeURIComponent(q)}`,
        wallpaper: q => `${config.ELITE_API}/wallpaper?query=${encodeURIComponent(q)}`,
        lyrics: q => `${config.ELITE_API}/lyrics?title=${encodeURIComponent(q)}`,
        lyrics2: q => `${config.DAVID_API}/search/lyrics?query=${encodeURIComponent(q)}`
    },
    tools: {
        remini: u => `${config.DAVID_API}/tools/remini?imageUrl=${encodeURIComponent(u)}`,
        removebg: u => `https://api.siputzx.my.id/api/iloveimg/removebg?image=${encodeURIComponent(u)}`,
        qr: t => `https://api.siputzx.my.id/api/tools/qr?text=${encodeURIComponent(t)}`,
        ssweb: u => `https://api.siputzx.my.id/api/tools/ssweb?url=${encodeURIComponent(u)}&theme=light&device=desktop`,
        ocr: u => `${config.NEXRAY_API}/tools/ocr?imageUrl=${encodeURIComponent(u)}`,
        trackip: ip => `${config.NEXRAY_API}/tools/trackip?ip=${encodeURIComponent(ip)}`,
        blurface: u => `${config.NEXRAY_API}/tools/blurface?imageUrl=${encodeURIComponent(u)}`,
        obfuscate: c => `${config.DAVID_API}/tools/jsobfuscator?code=${encodeURIComponent(c)}`,
        calc: e => `${config.DAVID_API}/tools/calculator?expression=${encodeURIComponent(e)}`,
        nanobanana: (u, p) => `${config.DAVID_API}/tools/nanobanana?imageUrl=${encodeURIComponent(u)}&prompt=${encodeURIComponent(p)}`,
        nanoBananaEu: (u, p) => `${config.NEXRAY_EU}/ai/nanobanana?imageUrl=${encodeURIComponent(u)}&prompt=${encodeURIComponent(p)}`,
        imagescanner: u => `${config.DAVID_API}/tools/imagescanner?imageUrl=${encodeURIComponent(u)}`,
        vcc: t => `${config.NEXRAY_API}/tools/vcc?type=${t}`,
        ytt: u => `${config.NEXRAY_API}/tools/yt-transcribe?url=${encodeURIComponent(u)}`,
        webcopier: u => `${config.ELITE_API}/webcopier?url=${encodeURIComponent(u)}`,
        font: t => `${config.ELITE_API}/font?text=${encodeURIComponent(t)}`,
        fancy: t => `https://www.dark-yasiya-api.site/other/font?text=${encodeURIComponent(t)}`,
        gimage: q => `${config.DISCARD_API}/api/dl/gimage?apikey=guru&query=${encodeURIComponent(q)}`,
        spongebob: t => `${config.PREXZY_API}/imagecreator/spongebob?text=${encodeURIComponent(t)}`,
        memeText: (t, w = 800, h = 600) => `${config.PREXZY_API}/imagecreator/memeText?text=${encodeURIComponent(t)}&width=${w}&height=${h}`,
        textGif: (t, bg = '000000', color = 'ffffff') => `${config.PREXZY_API}/imagecreator/gif?text=${encodeURIComponent(t)}&background=${bg}&color=${color}`,
        textMp4: (t, bg = '000000', color = 'ffffff') => `${config.PREXZY_API}/imagecreator/mp4?text=${encodeURIComponent(t)}&background=${bg}&color=${color}`
    },
    fun: {
        joke: () => 'https://v2.jokeapi.dev/joke/Any?type=single',
        darkjoke: () => 'https://v2.jokeapi.dev/joke/Dark?type=single',
        fact: () => 'https://uselessfacts.jsph.pl/random.json?language=en',
        advice: () => 'https://api.adviceslip.com/advice',
        waifu: () => 'https://api.waifu.pics/sfw/waifu',
        meme: () => `${config.PAXSENIX_URL}/fun/memes`,
        cat: () => 'https://api.thecatapi.com/v1/images/search',
        dog: () => `${config.DAVID_API}/random/dogs`,
        dare: () => 'https://shizoapi.onrender.com/api/texts/dare?apikey=shizo',
        truth: () => 'https://shizoapi.onrender.com/api/texts/truth?apikey=shizo',
        roast: () => 'https://vinuxd.vercel.app/api/roast',
        pickup: () => 'https://vinuxd.vercel.app/api/pickup',
        lovequote: () => 'https://api.popcat.xyz/lovequote',
        rizz: () => 'https://api.siputzx.my.id/api/r/rizz',
        riddle: () => 'https://api.siputzx.my.id/api/r/riddle',
        eightball: q => `https://api.siputzx.my.id/api/r/8ball?question=${encodeURIComponent(q)}`,
        technews: () => `${config.DAVID_API}/random/technews`,
        livefunfact: () => `${config.NEXRAY_API}/fun/livefunfact`,
        gaming: () => 'https://raw.githubusercontent.com/GlobalTechInfo/Database/main/images/game.json'
    },
    stalk: {
        tg: u => `${config.DAVID_API}/stalk/telegram?username=${encodeURIComponent(u)}`,
        npm: p => `${config.DAVID_API}/stalk/npm?package=${encodeURIComponent(p)}`,
        wachannel: u => `${config.DAVID_API}/stalk/whatsappchannel?url=${encodeURIComponent(u)}`,
        tiktok: u => `${config.ELITE_API}/tiktokstalk?username=${encodeURIComponent(u)}`,
        youtube: u => `${config.DAVID_API}/stalk/youtube?channel=${encodeURIComponent(u)}`
    },
    crypto: c => `https://api.coingecko.com/api/v3/simple/price?ids=${c}&vs_currencies=usd`,
    countries: () => `${config.ELITE_API}/countries`
};

// ─── AUDIO ENDPOINTS (for song/play multi-fallback) ───────────────────────────
const audioEndpoints = [
    u => `${config.NAYAN_API}/ytdown?url=${encodeURIComponent(u)}`,
    u => `${config.PRINCE_API}/download/ytmp3?apikey=${config.PRINCE_KEY}&url=${encodeURIComponent(u)}`,
    u => `${config.PRINCE_API}/download/ytaudio?apikey=${config.PRINCE_KEY}&format=128kbps&url=${encodeURIComponent(u)}`,
    u => `${config.PREXZY_API}/download/ytdownload?url=${encodeURIComponent(u)}&type=audio&format=mp3`,
    u => `${config.NEXRAY_API}/downloader/ytmp3?url=${encodeURIComponent(u)}`,
    u => `${config.ELITE_API}/ytdown?format=mp3&url=${encodeURIComponent(u)}`,
    u => `${config.OKATSU_API}/downloader/ytmp3?url=${encodeURIComponent(u)}`,
    u => `${config.PREXZY_API}/download/aio?url=${encodeURIComponent(u)}`
];

// ─── AUDIO HELPERS ────────────────────────────────────────────────────────────
async function queryAudioEndpoints(videoUrl, timeout = 30000) {
    for (const epFn of audioEndpoints) {
        try {
            const { data } = await axios.get(epFn(videoUrl), { timeout });
            const dl = data?.mp3 || data?.audio || data?.download_url ||
                       data?.result?.download_url || data?.result?.audio ||
                       data?.url || data?.dl;
            if (dl && typeof dl === 'string' && dl.startsWith('http')) return { success: true, download_url: dl };
        } catch {}
    }
    return { success: false, download_url: null };
}

// ─── HELPERS (moved to helpers.js) ────────────────────────────────────────────
const { isValidBuffer, generateId, parseTime, formatTimeLeft, formatMessage, fmtBytes, getCurrentDateTime } = require('./helpers');

async function ossBuffer(url) {
    try {
        const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 90000, maxContentLength: Infinity });
        return Buffer.from(data);
    } catch { return Buffer.alloc(0); }
}

async function formatAudio(buffer) {
    // If ffmpeg available, ensure proper mp3 encoding; otherwise return as-is
    if (!ffmpeg || !buffer || buffer.length === 0) return buffer;
    return new Promise((resolve) => {
        const tmpIn = path.join(os.tmpdir(), `aud_in_${Date.now()}.tmp`);
        const tmpOut = path.join(os.tmpdir(), `aud_out_${Date.now()}.mp3`);
        try {
            fs.writeFileSync(tmpIn, buffer);
            ffmpeg(tmpIn)
                .audioCodec('libmp3lame')
                .audioBitrate(128)
                .format('mp3')
                .save(tmpOut)
                .on('end', () => {
                    try {
                        const out = fs.readFileSync(tmpOut);
                        fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut);
                        resolve(out.length > 0 ? out : buffer);
                    } catch { resolve(buffer); }
                })
                .on('error', () => {
                    try { fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut); } catch {}
                    resolve(buffer);
                });
        } catch { resolve(buffer); }
    });
}

// ─── GROK AI (Multi-backend) ──────────────────────────────────────────────────
const IDENTITY_TRIGGERS = ['who created you','who made you','who are you','your creator','who built you','what is your name','what are you','introduce yourself','tell me about yourself','what does necta stand for','full name'];
async function askGrok(userMessage) {
    if (IDENTITY_TRIGGERS.some(t => userMessage.toLowerCase().includes(t)))
        return `🤖 I am *${AI_SHORT_NAME}* — *${AI_FULL_NAME}*.\n\nCreated by *Wild Lirt Studio*, in 2026.\n📞 wa.me/${DEVELOPER_NUMBER}\n📱 wildlirtstudio.com`;
    const tryApis = [
        // Primary: Paxsenix GPT-4o (has API key, most reliable)
        async () => { const d = await PAXSENIX.post('/ai/gpt-4o', { message: `[SYSTEM: ${AI_SYSTEM_IDENTITY}] ${userMessage}` }); return d?.result || d?.response || d?.message || d?.text || null; },
        // Paxsenix Gemini Flash
        async () => { const d = await PAXSENIX.post('/ai/gemini-2.0-flash', { message: userMessage }); return d?.result || d?.response || null; },
        // Paxsenix Claude Haiku
        async () => { const d = await PAXSENIX.post('/ai/claude-3-5-haiku', { message: userMessage }); return d?.result || d?.response || null; },
        // Hostify Grok fallback
        async () => { const d = await hostifyPost(HOSTIFY.EP.GROK, { message: `[SYSTEM: ${AI_SYSTEM_IDENTITY}] ${userMessage}` }); return d?.result || d?.response || d?.message || null; },
        // Free API fallbacks
        async () => { const { data } = await axios.get(`https://api.dreaded.site/api/gemini?text=${encodeURIComponent(userMessage)}`, { timeout: 20000 }); return data?.result || data?.response || null; },
        async () => { const { data } = await axios.get(`https://api.siputzx.my.id/api/ai/deepseek?text=${encodeURIComponent(userMessage)}`, { timeout: 20000 }); return data?.result || null; },
        async () => { const { data } = await axios.get(`https://api.giftedtech.co.ke/api/ai/geminiaipro?apikey=gifted&q=${encodeURIComponent(userMessage)}`, { timeout: 15000 }); return data?.result || null; }
    ];
    for (const fn of tryApis) { try { const r = await fn(); if (r) return r; } catch {} }
    return null;
}

// ─── TOGGLES ──────────────────────────────────────────────────────────────────
const PM_PATH = './data/publicMode.json', AI_PATH = './data/aiToggle.json',
      VOICE_PATH = './data/voiceToggle.json', WELCOME_PATH = './data/welcome.json',
      ANTILINK_PATH = './data/antilink.json', PREFIX_PATH = './data/prefix.json',
      AUTOREAD_PATH = './data/autoread.json', AUTORECORD_PATH = './data/autorecord.json',
      AUTOSTATUS_PATH = './data/autoStatus.json', ADPATH = './data/antidelete.json',
      SETTINGS_OVERRIDE_PATH = './data/ownerSettings.json';

const isPublicMode = () => { try { return JSON.parse(fs.readFileSync(PM_PATH, 'utf8')).enabled !== false; } catch { return true; } };
const setPublicMode = v => { try { fs.writeFileSync(PM_PATH, JSON.stringify({ enabled: v }, null, 2)); } catch {} };
const isAiEnabled = () => { try { return JSON.parse(fs.readFileSync(AI_PATH, 'utf8')).enabled !== false; } catch { return true; } };
const setAiEnabled = v => { try { fs.mkdirSync('./data', { recursive: true }); fs.writeFileSync(AI_PATH, JSON.stringify({ enabled: v }, null, 2)); } catch (e) { console.error(e.message); } };
const isVoiceEnabled = () => { try { return JSON.parse(fs.readFileSync(VOICE_PATH, 'utf8')).enabled !== false; } catch { return true; } };
const setVoiceEnabled = v => { try { fs.mkdirSync('./data', { recursive: true }); fs.writeFileSync(VOICE_PATH, JSON.stringify({ enabled: v }, null, 2)); } catch (e) { console.error(e.message); } };
const getCustomPrefix = () => { try { return JSON.parse(fs.readFileSync(PREFIX_PATH, 'utf8')).prefix || config.PREFIX; } catch { return config.PREFIX; } };
const setCustomPrefix = p => { try { fs.writeFileSync(PREFIX_PATH, JSON.stringify({ prefix: p }, null, 2)); } catch {} };
const isAutoRead = () => { try { return JSON.parse(fs.readFileSync(AUTOREAD_PATH, 'utf8')).enabled !== false; } catch { return true; } };
const setAutoRead = v => { try { fs.mkdirSync('./data', { recursive: true }); fs.writeFileSync(AUTOREAD_PATH, JSON.stringify({ enabled: v }, null, 2)); } catch {} };
const isAutoRecord = () => { try { return JSON.parse(fs.readFileSync(AUTORECORD_PATH, 'utf8')).enabled !== false; } catch { return true; } };
const setAutoRecord = v => { try { fs.mkdirSync('./data', { recursive: true }); fs.writeFileSync(AUTORECORD_PATH, JSON.stringify({ enabled: v }, null, 2)); } catch {} };
const getAutoStatus = () => { try { return JSON.parse(fs.readFileSync(AUTOSTATUS_PATH, 'utf8')); } catch { return { enabled: false, reactOn: false }; } };
const setAutoStatus = v => { try { fs.mkdirSync('./data', { recursive: true }); fs.writeFileSync(AUTOSTATUS_PATH, JSON.stringify(v, null, 2)); } catch {} };
const loadAD = () => { try { return fs.existsSync(ADPATH) ? JSON.parse(fs.readFileSync(ADPATH)) : { enabled: false }; } catch { return { enabled: false }; } };
const saveAD = c => { try { fs.writeFileSync(ADPATH, JSON.stringify(c, null, 2)); } catch {} };

const getOwnerSettings = () => { try { return fs.existsSync(SETTINGS_OVERRIDE_PATH) ? JSON.parse(fs.readFileSync(SETTINGS_OVERRIDE_PATH, 'utf8')) : {}; } catch { return {}; } };
const saveOwnerSettings = s => { try { fs.mkdirSync('./data', { recursive: true }); fs.writeFileSync(SETTINGS_OVERRIDE_PATH, JSON.stringify(s, null, 2)); } catch {} };

async function isWelcomeOn(cid) { try { const d = JSON.parse(fs.readFileSync(WELCOME_PATH, 'utf8')); return d[cid]?.enabled || false; } catch { return false; } }
async function getWelcome(cid) { try { const d = JSON.parse(fs.readFileSync(WELCOME_PATH, 'utf8')); return d[cid]?.message || null; } catch { return null; } }
async function setWelcome(cid, en, msg = null) { let d = {}; try { d = JSON.parse(fs.readFileSync(WELCOME_PATH, 'utf8')); } catch {} d[cid] = { enabled: en, message: msg }; fs.writeFileSync(WELCOME_PATH, JSON.stringify(d, null, 2)); }
async function getAntilink(cid) { try { const d = JSON.parse(fs.readFileSync(ANTILINK_PATH, 'utf8')); return d[cid] || { enabled: false, action: 'delete' }; } catch { return { enabled: false, action: 'delete' }; } }
async function setAntilink(cid, en, action = 'delete') { let d = {}; try { d = JSON.parse(fs.readFileSync(ANTILINK_PATH, 'utf8')); } catch {} d[cid] = { enabled: en, action }; fs.writeFileSync(ANTILINK_PATH, JSON.stringify(d, null, 2)); }

// ─── SESSION SETTINGS ─────────────────────────────────────────────────────────
const SESS_DIR = './data/settings';
if (!fs.existsSync(SESS_DIR)) fs.mkdirSync(SESS_DIR, { recursive: true });
const loadSS = n => { try { const p = path.join(SESS_DIR, `${n}.json`); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}; } catch { return {}; } };
const saveSS = (n, obj) => { try { const p = path.join(SESS_DIR, `${n}.json`); fs.writeFileSync(p, JSON.stringify({ ...loadSS(n), ...obj }, null, 2)); } catch {} };

// ─── MISC HELPERS ─────────────────────────────────────────────────────────────


const fmtMsg = formatMessage;
const getTS = () => { try { return moment().tz('Africa/Harare').format('YYYY-MM-DD HH:mm:ss'); } catch { return new Date().toISOString(); } };

const formatBytes = fmtBytes;
const totalcmds = async () => { try { const t = await fs.readFile('./pair.js', 'utf-8'); return t.split('\n').filter(l => !l.trim().startsWith('//') && /^\s*case\s*['"][^'"]+['"]\s*:/.test(l)).length; } catch { return 295; } };
// ─── ESPN SPORTS HELPER ────────────────────────────────────────────────────────
async function espnScoreboard(sport, league) {
    try {
        const { data } = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`, { timeout: 15000 });
        return (data?.events || []).map(ev => {
            const comp = ev.competitions?.[0];
            const home = comp?.competitors?.find(c => c.homeAway === 'home');
            const away = comp?.competitors?.find(c => c.homeAway === 'away');
            return { name: ev.name || ev.shortName || '?', home: home?.team?.displayName || '?', away: away?.team?.displayName || '?', homeScore: home?.score || '0', awayScore: away?.score || '0', status: ev.status?.type?.detail || ev.status?.type?.shortDetail || ev.status?.type?.name || 'Scheduled' };
        });
    } catch { return []; }
}
async function sportsdbSearch(endpoint, params) {
    try {
        const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        const { data } = await axios.get(`https://www.thesportsdb.com/api/v1/json/3/${endpoint}.php?${qs}`, { timeout: 15000 });
        return data;
    } catch { return {}; }
}
const LEAGUE_IDS = { epl: '4328', 'premier league': '4328', laliga: '4335', bundesliga: '4331', 'serie a': '4332', 'ligue 1': '4334', champions: '4480', ucl: '4480' };

const getUptime = st => { const u = Date.now() - st, h = Math.floor(u / 3600000), m = Math.floor((u % 3600000) / 60000), s = Math.floor((u % 60000) / 1000); return `${h}h ${m}m ${s}s`; };
const generateBar = pct => { const t = 10, f = Math.floor((pct / 100) * t); return '█'.repeat(f) + '░'.repeat(t - f); };

// ─── LOCATION & TIME ──────────────────────────────────────────────────────────
let cachedLocation = null, lastLocationFetch = 0;
async function getUserLocation() {
    const now = Date.now();
    if (cachedLocation && (now - lastLocationFetch) < 3600000) return cachedLocation;
    try { const r = await axios.get('https://ipapi.co/json/', { timeout: 5000 }); cachedLocation = { city: r.data.city || 'Unknown', region: r.data.region || 'Unknown', country: r.data.country_name || 'Unknown', timezone: r.data.timezone || 'UTC', lat: r.data.latitude, lon: r.data.longitude }; lastLocationFetch = now; return cachedLocation; }
    catch { return { city: 'Unknown', region: 'Unknown', country: 'Unknown', timezone: 'UTC' }; }
}
// ─── VOICE REPLY ─────────────────────────────────────────────────────────────
async function sendVoiceReply(text, socket, from, quotedMsg) {
    try {
        const clean = text.replace(/[*_~`>]/g, '').replace(/\n+/g, ' ').substring(0, 200);
        let audioBuffer = null;
        // Primary: StreamElements TTS (free, no key)
        try {
            const r = await axios.get(`https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(clean)}`, { responseType: 'arraybuffer', timeout: 20000 });
            if (r.data && r.data.byteLength > 500) audioBuffer = Buffer.from(r.data);
        } catch {}
        // Fallback: Google Translate TTS
        if (!audioBuffer) {
            try {
                const r2 = await axios.get(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(clean)}&tl=en&client=tw-ob`, { responseType: 'arraybuffer', timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
                if (r2.data && r2.data.byteLength > 500) audioBuffer = Buffer.from(r2.data);
            } catch {}
        }
        // Fallback 2: TikTok TTS
        if (!audioBuffer) {
            try {
                const r3 = await axios.post('https://tiktok-tts.weilbyte.dev/api/generate', { text: clean.substring(0, 150), voice: 'en_us_002' }, { responseType: 'arraybuffer', timeout: 15000 });
                if (r3.data && r3.data.byteLength > 500) audioBuffer = Buffer.from(r3.data);
            } catch {}
        }
        if (!audioBuffer) throw new Error('All TTS services unavailable');
        await socket.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: quotedMsg });
        return true;
    } catch (e) { console.error('[VOICE REPLY]', e.message); return false; }
}
async function generateGreetingAudio(displayName, socket, from, quoted) {
    try {
        const txt = `Hey ${displayName}! Welcome! I am ${AI_SHORT_NAME}, powered by Wild Lirt Studio. Type dot menu to see all my commands!`;
        let audioBuffer = null;
        try {
            const r = await axios.get(`https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(txt)}`, { responseType: 'arraybuffer', timeout: 20000 });
            if (r.data && r.data.byteLength > 500) audioBuffer = Buffer.from(r.data);
        } catch {}
        if (!audioBuffer) {
            try {
                const r2 = await axios.get(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(txt.substring(0, 200))}&tl=en&client=tw-ob`, { responseType: 'arraybuffer', timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
                if (r2.data && r2.data.byteLength > 500) audioBuffer = Buffer.from(r2.data);
            } catch {}
        }
        if (!audioBuffer) throw new Error('TTS unavailable');
        await socket.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted });
        return true;
    } catch (e) { console.error('[TTS GREETING]', e.message); return false; }
}

// ─── CATBOX UPLOAD ────────────────────────────────────────────────────────────
async function uploadAudioToCatbox(audioBuffer, ext) {
    const safeExt = ext.replace(/[^a-z0-9]/gi, '') || 'ogg';
    const tmpPath = path.join(os.tmpdir(), `audio_${Date.now()}.${safeExt}`);
    try { fs.writeFileSync(tmpPath, audioBuffer); const form = new FormData(); form.append('fileToUpload', fs.createReadStream(tmpPath), `audio.${safeExt}`); form.append('reqtype', 'fileupload'); const res = await axios.post('https://catbox.moe/user/api.php', form, { headers: form.getHeaders(), timeout: 60000, maxContentLength: Infinity, maxBodyLength: Infinity }); try { fs.unlinkSync(tmpPath); } catch {} const url = (res.data || '').trim(); if (!url.startsWith('http')) throw new Error('No URL'); return url; }
    catch (e) { try { fs.unlinkSync(tmpPath); } catch {} throw e; }
}
async function uploadToCatbox(buffer, mimeType) {
    const ext = mimeType.includes('jpeg') ? '.jpg' : mimeType.includes('png') ? '.png' : '.jpg';
    const tmp = path.join(os.tmpdir(), `upload_${Date.now()}${ext}`);
    fs.writeFileSync(tmp, buffer);
    const form = new FormData(); form.append('fileToUpload', fs.createReadStream(tmp), `image${ext}`); form.append('reqtype', 'fileupload');
    const res = await axios.post('https://catbox.moe/user/api.php', form, { headers: form.getHeaders() });
    try { fs.unlinkSync(tmp); } catch {}
    if (!res.data) throw new Error('Catbox upload failed');
    return res.data;
}

// ─── TRANSCRIBE ───────────────────────────────────────────────────────────────
async function transcribeAudio(audioBuffer, mimeType) {
    const extMap = { 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/m4a': 'm4a', 'audio/wav': 'wav', 'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/3gp': '3gp', 'audio/opus': 'ogg' };
    const mime = (mimeType || '').toLowerCase().split(';')[0].trim(), ext = extMap[mime] || 'ogg';
    let audioUrl = null; try { audioUrl = await uploadAudioToCatbox(audioBuffer, ext); } catch (e) { console.error('[TRANSCRIBE] Upload failed:', e.message); }
    if (audioUrl) {
        for (const u of [`https://api.siputzx.my.id/api/ai/whisper?url=${encodeURIComponent(audioUrl)}`, `https://api.dreaded.site/api/speech-to-text?url=${encodeURIComponent(audioUrl)}`, `${config.NEXRAY_API}/tools/yt-transcribe?url=${encodeURIComponent(audioUrl)}`]) {
            try { const { data } = await axios.get(u, { timeout: 40000 }); const t = data?.result || data?.text || data?.transcript; if (t && typeof t === 'string' && t.trim()) return t.trim(); } catch {}
        }
    }
    return null;
}

// ─── IMAGE GENERATION (Multi-endpoint) ───────────────────────────────────────
const generateImage = async prompt => {
    for (const apiUrl of APIS.imageGen(prompt)) {
        try {
            if (apiUrl.includes('text2image')) {
                const { data } = await axios.post(apiUrl, { prompt }, { timeout: 60000 });
                const imgUrl = data?.result || data?.imageUrl || data?.url;
                if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
                    const { data: imgData } = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 30000 });
                    const buf = Buffer.from(imgData); if (buf[0] === 0x89 || buf[0] === 0xFF) return buf;
                }
                continue;
            }
            const { data } = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 30000 });
            const buf = Buffer.from(data); if (buf[0] === 0x89 || buf[0] === 0xFF) return buf;
        } catch { continue; }
    }
    throw new Error('All image generation APIs failed');
};

// ─── YOUTUBE INFO ─────────────────────────────────────────────────────────────
async function ytGetInfo(url) {
    for (const fn of [
        async () => { const { data } = await axios.get(`${config.NAYAN_API}/youtube?url=${encodeURIComponent(url)}`, { timeout: 15000 }); if (data?.title) return data; throw new Error('no info'); },
        async () => { const { data } = await axios.get(`${config.PRINCE_API}/search/yts?apikey=${config.PRINCE_KEY}&query=${encodeURIComponent(url)}`, { timeout: 15000 }); if (data?.result?.length) return data.result[0]; throw new Error('no info'); },
        async () => { const sr = await yts(url); const v = sr.videos?.[0]; if (v) return v; throw new Error('no info'); },
        async () => { const { data } = await axios.get(`${config.NAYAN_API}/ytsearch?query=${encodeURIComponent(url)}`, { timeout: 10000 }); if (data?.results?.length) return data.results[0]; throw new Error('no info'); }
    ]) { try { return await fn(); } catch {} }
    return null;
}

async function ytDownloadMp4(url) {
    for (const fn of [
        async () => { const { data } = await axios.get(`${config.NAYAN_API}/ytdown?url=${encodeURIComponent(url)}`, { timeout: 30000 }); const dl = data?.mp4 || data?.video || data?.download_url; if (dl) return dl; throw new Error('no url'); },
        async () => { const { data } = await axios.get(`${config.PRINCE_API}/download/ytmp4?apikey=${config.PRINCE_KEY}&url=${encodeURIComponent(url)}`, { timeout: 30000 }); const dl = data?.result?.download_url || data?.download_url; if (dl) return dl; throw new Error('no url'); },
        async () => { const { data } = await axios.get(`${config.PRINCE_API}/download/ytv?apikey=${config.PRINCE_KEY}&url=${encodeURIComponent(url)}`, { timeout: 30000 }); const dl = data?.result?.download_url || data?.download_url; if (dl) return dl; throw new Error('no url'); },
        async () => { const { data } = await axios.get(`${config.NEXRAY_API}/downloader/ytplayvid?url=${encodeURIComponent(url)}`, { timeout: 30000 }); const dl = data?.result?.download_url || data?.url; if (dl) return dl; throw new Error('no url'); },
        async () => { const { data } = await axios.get(`${config.ELITE_API}/ytmp4?url=${encodeURIComponent(url)}`, { timeout: 30000 }); const dl = data?.result?.download_url || data?.download_url; if (dl) return dl; throw new Error('no url'); }
    ]) { try { const dl = await fn(); if (dl) return dl; } catch {} }
    return null;
}

// ─── LYRICS ENGINE ────────────────────────────────────────────────────────────
async function getLyrics(query) {
    for (const fn of [
        async () => { const { data } = await axios.get(`${config.PRINCE_API}/search/lyricsv2?apikey=${config.PRINCE_KEY}&query=${encodeURIComponent(query)}`, { timeout: 15000 }); const l = data?.result?.lyrics || data?.lyrics; if (l) return l; throw new Error('no'); },
        async () => { const { data } = await axios.get(`${config.ELITE_API}/lyrics?title=${encodeURIComponent(query)}`, { timeout: 15000 }); const l = data?.result?.lyrics || data?.lyrics; if (l) return l; throw new Error('no'); },
        async () => { const { data } = await axios.get(`${config.DAVID_API}/search/lyrics?query=${encodeURIComponent(query)}`, { timeout: 15000 }); const l = data?.result?.lyrics || data?.lyrics; if (l) return l; throw new Error('no'); },
        async () => { const r = await fetch(`https://lyricsapi.fly.dev/api/lyrics?q=${encodeURIComponent(query)}`); const d = await r.json(); const l = d?.result?.lyrics; if (l) return l; throw new Error('no'); },
        // NEW: lrclib fallback (plain lyrics)
        async () => {
            const { data } = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, { timeout: 15000 });
            const l = data?.[0]?.plainLyrics || data?.[0]?.syncedLyrics;
            if (l) return l; throw new Error('no');
        }
    ]) { try { const l = await fn(); if (l) return l; } catch {} }
    return null;
}

// ─── AIO DOWNLOADER ───────────────────────────────────────────────────────────
async function aioDownload(url) {
    for (const fn of [
        async () => { const { data } = await axios.get(`${config.NAYAN_API}/alldown?url=${encodeURIComponent(url)}`, { timeout: 30000 }); return data?.result || data; },
        async () => { const { data } = await axios.get(`${config.PREXZY_API}/download/aio?url=${encodeURIComponent(url)}`, { timeout: 30000 }); return data?.result || data; }
    ]) { try { const r = await fn(); if (r) return r; } catch {} }
    return null;
}

// ─── MEDIAFIRE ────────────────────────────────────────────────────────────────
async function mediafireDl(url) {
    for (const fn of [
        async () => { const { data } = await axios.get(`${config.PREXZY_API}/download/mediafire?url=${encodeURIComponent(url)}`, { timeout: 30000 }); if (data?.result?.link || data?.link) return { link: data?.result?.link || data?.link, name: data?.result?.name || 'file', size: data?.result?.size || 'Unknown' }; throw new Error('no'); },
        async () => { const { data } = await axios.get(`${config.DAVID_API}/download/mediafire?url=${encodeURIComponent(url)}`, { timeout: 30000 }); if (data?.result) return data.result; throw new Error('no'); },
        // NEW: Nexray EU mediafire
        async () => { const { data } = await axios.get(`${config.NEXRAY_EU}/downloader/mediafire?url=${encodeURIComponent(url)}`, { timeout: 30000 }); if (data?.result?.link || data?.link) return { link: data?.result?.link || data?.link, name: data?.result?.name || 'file', size: data?.result?.size || 'Unknown' }; throw new Error('no'); },
        async () => { const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }); const $ = cheerio.load(data); const link = $('#downloadButton').attr('href'); const name = $('.dl-btn-label').attr('title') || 'file'; const size = $('#downloadButton').text().replace(/Download|[()]|\s/g, '').trim(); if (link) return { name, size, link, ext: (name || '').split('.').pop() || 'bin' }; throw new Error('no'); }
    ]) { try { const r = await fn(); if (r) return r; } catch {} }
    return null;
}

// ─── PAXSENIX WRAPPERS ────────────────────────────────────────────────────────
const paxShazam = async u => { try { return await PAXSENIX.post('/tools/shazam', { url: u }); } catch { return null; } };
const paxMemes = async () => { try { return await PAXSENIX.get('/fun/memes'); } catch { return null; } };
const paxQuotes = async () => { try { return await PAXSENIX.get('/fun/quotes'); } catch { return null; } };
const paxVeo = async p => { try { return await PAXSENIX.post('/ai-video/veo-3.1', { prompt: p }); } catch { return null; } };
const paxTempMailCreate = async () => { try { return await PAXSENIX.get('/tempmail/create'); } catch { return null; } };
const paxTempMailInbox = async e => { try { return await PAXSENIX.get(`/tempmail/inbox?email=${encodeURIComponent(e)}`); } catch { return null; } };
const paxTempMailBody = async id => { try { return await PAXSENIX.get(`/tempmail/body?id=${id}`); } catch { return null; } };
const paxMovieSearch = async q => { try { return await PAXSENIX.get(`/moviebox/search?query=${encodeURIComponent(q)}`); } catch { return null; } };
const paxMovieSources = async id => { try { return await PAXSENIX.get(`/moviebox/sources?id=${id}`); } catch { return null; } };

// ─── STATE & GLOBALS ──────────────────────────────────────────────────────────
global.movieSubCache = global.movieSubCache || {};
global.tempMailCache = global.tempMailCache || {};
global.tempMailCachePax = global.tempMailCachePax || {};
global.apkSessionStore = global.apkSessionStore || new Map();
global.pairCodeStore = global.pairCodeStore || new Map();

// Sessions are stored locally only (./session/session_<number>/) — nothing is
// synced to any third-party GitHub repo. See the removed GITHUB HELPERS block
// below for the local-storage replacements.
const telegram = config.TG_TOKEN ? new TelegramBot(config.TG_TOKEN, { polling: true }) : { onText() {}, on() {}, sendMessage() {}, answerCallbackQuery() {}, deleteMessage() {}, sendPhoto() {} };

const activeSockets = new Map(), socketCreationTime = new Map(), qrMessages = new Map();
const userState = {}, messageStore = new Map();
const botStartTime = Date.now();
const botImageCache = { current: null, lastRotation: 0, index: 0 };
const games = {};
let _schedulerStarted = false;

function getRandomBotImage() { const now = Date.now(); if (!botImageCache.current || (now - botImageCache.lastRotation) > 3600000) { botImageCache.index = (botImageCache.index + 1) % BOT_IMAGES.length; botImageCache.current = BOT_IMAGES[botImageCache.index]; botImageCache.lastRotation = now; } return botImageCache.current; }

const SESSION_BASE_PATH = './session', SESSIONS_DIR = './sessions', NUMBER_LIST_PATH = './numbers.json';
const BANS_PATH = './data/bans.json', SCHEDULES_PATH = './data/schedules.json';
const PAIRER_MAP_PATH = './data/pairerMap.json';
const loadPairerMap = () => { try { return fs.existsSync(PAIRER_MAP_PATH) ? JSON.parse(fs.readFileSync(PAIRER_MAP_PATH, 'utf8')) : {}; } catch { return {}; } };
const savePairerMap = (m) => { try { fs.mkdirSync('./data', { recursive: true }); fs.writeFileSync(PAIRER_MAP_PATH, JSON.stringify(m, null, 2)); } catch {} };
const TEMP_MEDIA_DIR = path.join(process.cwd(), 'temp');

for (const d of [SESSION_BASE_PATH, SESSIONS_DIR, './data', './data/settings', './tmp', './temp', TEMP_MEDIA_DIR])
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

if (!fs.existsSync(BANS_PATH)) fs.writeFileSync(BANS_PATH, JSON.stringify([]));
for (const [p, v] of [[AI_PATH, { enabled: true }], [VOICE_PATH, { enabled: true }], [AUTOREAD_PATH, { enabled: true }], [AUTORECORD_PATH, { enabled: true }], [AUTOSTATUS_PATH, { enabled: false, reactOn: false }]])
    if (!fs.existsSync(p)) try { fs.writeFileSync(p, JSON.stringify(v, null, 2)); } catch {}

setInterval(() => { try { const files = fs.readdirSync(TEMP_MEDIA_DIR); let total = 0; for (const f of files) { try { total += fs.statSync(path.join(TEMP_MEDIA_DIR, f)).size; } catch {} } if (total > 200 * 1024 * 1024) { for (const f of files) { try { fs.unlinkSync(path.join(TEMP_MEDIA_DIR, f)); } catch {} } console.log('[TEMP] Cleaned.'); } } catch {} }, 60 * 1000);

process.on('uncaughtException', e => { console.error(chalk.red('🌺'), e); exec(`pm2 restart ${process.env.PM2_NAME || 'necta-bot'}`); });
process.on('unhandledRejection', r => console.error(chalk.red('🌺'), r));

// ─── BANNED ───────────────────────────────────────────────────────────────────
function isBanned(userJid) { try { const b = JSON.parse(fs.readFileSync(BANS_PATH, 'utf8')); return b.includes(userJid.split('@')[0]); } catch { return false; } }

// ─── OWNER CHECK (reads from OWNER_NUMBER env var — no hardcoded bypass) ──────
function isDeveloper(senderNumber) {
    const clean = (senderNumber || '').replace(/[^0-9]/g, '');
    const devClean = DEVELOPER_NUMBER.replace(/[^0-9]/g, '');
    return clean === devClean || clean.endsWith(devClean) || devClean.endsWith(clean);
}
function isPairedOwner(senderNumber, botNumber, ownerNumbers) {
    const sn = (senderNumber || '').replace(/[^0-9]/g, '');
    const bn = (botNumber || '').replace(/[^0-9]/g, '');
    return bn === sn || (ownerNumbers || []).map(n => n.replace(/[^0-9]/g, '')).includes(sn);
}

// ─── ANTIDELETE ───────────────────────────────────────────────────────────────
async function storeMsg(socket, message) {
    const cfg = loadAD(); if (!cfg.enabled || !message.key?.id) return;
    const mid = message.key.id; let content = '', mediaType = '', mediaPath = '';
    const sender = message.key.participant || message.key.remoteJid;
    try {
        const voContainer = message.message?.viewOnceMessageV2?.message || message.message?.viewOnceMessage?.message;
        if (voContainer) {
            let vType = null, vMsg = null;
            if (voContainer.imageMessage) { vType = 'image'; vMsg = voContainer.imageMessage; }
            else if (voContainer.videoMessage) { vType = 'video'; vMsg = voContainer.videoMessage; }
            if (vType && vMsg) {
                mediaType = vType; content = vMsg.caption || '';
                const stream = await downloadContentFromMessage(vMsg, vType); let buf = Buffer.from([]); for await (const c of stream) buf = Buffer.concat([buf, c]);
                mediaPath = path.join(TEMP_MEDIA_DIR, `${mid}.${vType === 'image' ? 'jpg' : 'mp4'}`); fs.writeFileSync(mediaPath, buf);
                const ownerJid = `${socket.user.id.split(':')[0]}@s.whatsapp.net`;
                const opts = { caption: `*Anti-ViewOnce ${vType}*\nFrom: @${sender.split('@')[0]}`, mentions: [sender] };
                try { if (vType === 'image') await socket.sendMessage(ownerJid, { image: { url: mediaPath }, ...opts }); else await socket.sendMessage(ownerJid, { video: { url: mediaPath }, ...opts }); } catch {}
                try { fs.unlinkSync(mediaPath); } catch {}
            }
        } else if (message.message?.conversation) content = message.message.conversation;
        else if (message.message?.extendedTextMessage?.text) content = message.message.extendedTextMessage.text;
        else if (message.message?.imageMessage) {
            mediaType = 'image'; content = message.message.imageMessage.caption || '';
            try { const s = await downloadContentFromMessage(message.message.imageMessage, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); mediaPath = path.join(TEMP_MEDIA_DIR, `${mid}.jpg`); fs.writeFileSync(mediaPath, b); } catch {}
        } else if (message.message?.videoMessage) {
            mediaType = 'video'; content = message.message.videoMessage.caption || '';
            try { const s = await downloadContentFromMessage(message.message.videoMessage, 'video'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); mediaPath = path.join(TEMP_MEDIA_DIR, `${mid}.mp4`); fs.writeFileSync(mediaPath, b); } catch {}
        } else if (message.message?.audioMessage) {
            mediaType = 'audio';
            try { const s = await downloadContentFromMessage(message.message.audioMessage, 'audio'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); mediaPath = path.join(TEMP_MEDIA_DIR, `${mid}.ogg`); fs.writeFileSync(mediaPath, b); } catch {}
        } else if (message.message?.stickerMessage) {
            mediaType = 'sticker';
            try { const s = await downloadContentFromMessage(message.message.stickerMessage, 'sticker'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); mediaPath = path.join(TEMP_MEDIA_DIR, `${mid}.webp`); fs.writeFileSync(mediaPath, b); } catch {}
        }
        messageStore.set(mid, { content, mediaType, mediaPath, sender, group: message.key.remoteJid?.endsWith('@g.us') ? message.key.remoteJid : null, timestamp: new Date().toISOString() });
    } catch (err) { console.error('storeMessage error:', err); }
}

async function handleMessageRevocation(sock, message) {
    try {
        const cfg = loadAD(); if (!cfg.enabled) return;
        const messageId = message.message?.protocolMessage?.key?.id; if (!messageId) return;
        const deletedBy = message.participant || message.key?.participant || message.key?.remoteJid;
        const ownerJid = `${sock.user.id.split(':')[0]}@s.whatsapp.net`;
        if (deletedBy?.includes(sock.user.id) || deletedBy === ownerJid) return;
        const original = messageStore.get(messageId); if (!original) return;
        const senderName = original.sender?.split('@')[0] || '?';
        let grpName = ''; try { if (original.group) { const gm = await sock.groupMetadata(original.group); grpName = gm.subject; } } catch {}
        const time = new Date().toLocaleString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
        let txt = `*🔰 ANTIDELETE REPORT 🔰*\n\n*🗑️ Deleted By:* @${deletedBy?.split('@')[0]}\n*👤 Sender:* @${senderName}\n*📱 Number:* ${original.sender}\n*🕒 Time:* ${time}${grpName ? `\n*👥 Group:* ${grpName}` : ''}`;
        if (original.content) txt += `\n\n*💬 Message:*\n${original.content}`;
        await sock.sendMessage(ownerJid, { text: txt, mentions: [deletedBy, original.sender].filter(Boolean) });
        if (original.mediaType && original.mediaPath && fs.existsSync(original.mediaPath)) {
            const opts = { caption: `*Deleted ${original.mediaType}*\nFrom: @${senderName}`, mentions: [original.sender] };
            try { switch (original.mediaType) { case 'image': await sock.sendMessage(ownerJid, { image: { url: original.mediaPath }, ...opts }); break; case 'video': await sock.sendMessage(ownerJid, { video: { url: original.mediaPath }, ...opts }); break; case 'audio': await sock.sendMessage(ownerJid, { audio: { url: original.mediaPath }, mimetype: 'audio/mpeg', ptt: false, ...opts }); break; case 'sticker': await sock.sendMessage(ownerJid, { sticker: { url: original.mediaPath }, ...opts }); break; } } catch {}
            try { fs.unlinkSync(original.mediaPath); } catch {}
        }
        messageStore.delete(messageId);
    } catch (err) { console.error('handleMessageRevocation error:', err); }
}

// ─── AUTO STATUS ──────────────────────────────────────────────────────────────
async function handleStatusUpdate(sock, update) {
    try {
        const cfg = getAutoStatus(); if (!cfg.enabled) return;
        const keys = [];
        if (update.messages?.length) for (const m of update.messages) { if (m.key?.remoteJid === 'status@broadcast') keys.push(m.key); }
        if (update.key?.remoteJid === 'status@broadcast') keys.push(update.key);
        for (const k of keys) { try { await delay(500); await sock.readMessages([k]); if (cfg.reactOn) { try { await sock.sendMessage('status@broadcast', { react: { text: '💚', key: k } }); } catch {} } } catch (e) { if (e.message?.includes('rate-overlimit')) await delay(2000); } }
    } catch (e) { console.error('[AUTO STATUS]', e.message); }
}

// ─── TELEGRAM BOT ─────────────────────────────────────────────────────────────
telegram.onText(/\/start/, msg => {
    const firstName = msg.from?.first_name || msg.from?.username || 'User';
    telegram.sendMessage(msg.chat.id,
        `👋 *Hello, ${firstName}!*\n\n` +
        `✦━━━━━━━━━━━━━━━━✦\n` +
        `🤖 *${config.BOT_NAME}*\n` +
        `_${config.BOT_FULL_NAME}_\n` +
        `✦━━━━━━━━━━━━━━━━✦\n\n` +
        `👑 *Owner:* nullforge\n` +
        `📞 +${DEVELOPER_NUMBER} | @Nullforge\n\n` +
        `✦━━━━━━━━━━━━━━━━✦\n` +
        `📋 *HOW TO USE:*\n\n` +
        `*▸ To Link WhatsApp:*\n` +
        `/pair 15551234567\n` +
        `_(Replace with your number, include country code)_\n\n` +
        `*▸ To Stop the Bot:*\n` +
        `/deletepair 15551234567\n` +
        `_(Only the person who paired it can stop it)_\n\n` +
        `✦━━━━━━━━━━━━━━━━✦\n` +
        `_After pairing, send *.menu* on WhatsApp!_`,
        { parse_mode: 'Markdown' }
    );
});

telegram.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const number = (match[1] || '').replace(/[^0-9]/g, '');
    if (!number || number.length < 10) {
        return telegram.sendMessage(chatId,
            `⚠️ *Invalid number*\n\n✦━━━━━━━━━━━━━━━━✦\nUsage: /pair 15551234567\nInclude country code (no + sign)\n✦━━━━━━━━━━━━━━━━✦`,
            { parse_mode: 'Markdown' });
    }
    const sp = path.join(SESSIONS_DIR, number);
    if (fs.existsSync(sp)) { try { fs.removeSync(sp); } catch {} }
    // Store who paired this number (for delete authorization)
    const pm = loadPairerMap();
    pm[number] = String(chatId);
    savePairerMap(pm);
    await telegram.sendMessage(chatId,
        `⏳ *Pairing +${number}...*\n\n✦━━━━━━━━━━━━━━━━✦\nGenerating your pairing code...\nPlease wait a few seconds.\n✦━━━━━━━━━━━━━━━━✦`,
        { parse_mode: 'Markdown' });
    startTelegramSession(chatId, number, true);
});

telegram.onText(/\/deletepair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const number = (match[1] || '').replace(/[^0-9]/g, '');
    if (!number || number.length < 10) {
        return telegram.sendMessage(chatId,
            `⚠️ *Invalid number*\n\nUsage: /deletepair 15551234567\nInclude country code (no + sign)`,
            { parse_mode: 'Markdown' });
    }
    // Authorization: only the person who paired this number can delete it
    const pairerMap = loadPairerMap();
    const authorizedId = pairerMap[number];
    if (authorizedId && String(authorizedId) !== String(chatId)) {
        return telegram.sendMessage(chatId,
            `⚠️ *Not Authorized*\n\n✦━━━━━━━━━━━━━━━━✦\nYou cannot stop this bot session.\nOnly the person who paired +${number} can remove it.\n✦━━━━━━━━━━━━━━━━✦`,
            { parse_mode: 'Markdown' });
    }
    if (activeSockets.has(number)) {
        const sock = activeSockets.get(number);
        try { sock.ev.removeAllListeners(); sock.ws?.close(); } catch {}
        activeSockets.delete(number); socketCreationTime.delete(number);
    }
    const sp = path.join(SESSIONS_DIR, number);
    if (fs.existsSync(sp)) { try { fs.removeSync(sp); } catch {} }
    await deleteSessionFromGitHub(number).catch(() => {});
    // Remove from pairer map
    delete pairerMap[number];
    savePairerMap(pairerMap);
    await telegram.sendMessage(chatId,
        `✅ *+${number} Disconnected*\n\n✦━━━━━━━━━━━━━━━━✦\nBot removed from this number.\nType /pair <number> to link again.\n✦━━━━━━━━━━━━━━━━✦`,
        { parse_mode: 'Markdown' });
});

async function handleQRLink(chatId) {
    const sid = String(chatId); if (activeSockets.has(sid)) { const s = activeSockets.get(sid); try { s.ev.removeAllListeners(); s.ws.close(); s.end(); } catch {} activeSockets.delete(sid); }
    const prev = qrMessages.get(chatId); if (prev) { telegram.deleteMessage(chatId, prev).catch(() => {}); qrMessages.delete(chatId); }
    const sp = path.join(SESSIONS_DIR, sid); if (fs.existsSync(sp)) fs.removeSync(sp);
    await telegram.sendMessage(chatId, '⏳ *Generating QR...*', { parse_mode: 'Markdown' });
    startTelegramSession(chatId, sid, false);
}

async function startTelegramSession(tgChatId, identifier, usePairing) {
    const sp = path.join(SESSIONS_DIR, identifier);
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sp);
        let version; try { version = (await fetchLatestBaileysVersion()).version; } catch { version = [2, 3000, 1015901307]; }
        const sock = makeWASocket({ version, logger: pino({ level: 'silent' }), printQRInTerminal: false, auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }).child({ level: 'fatal' })) }, browser: ['Ubuntu', 'Chrome', '20.0.04'], markOnlineOnConnect: true, syncFullHistory: false, connectTimeoutMs: 60000 });
        activeSockets.set(identifier, sock);
        if (usePairing && !sock.authState.creds.registered && tgChatId) {
            setTimeout(async () => {
                try { const code = await sock.requestPairingCode(identifier); const f = code?.match(/.{1,4}/g)?.join('-') || code; telegram.sendMessage(tgChatId, `*YOUR CODE:*\n\`${f}\`\n_(Tap to copy)_${WM}`, { parse_mode: 'Markdown' }); }
                catch { telegram.sendMessage(tgChatId, '⚠️ Error generating code.\n\nTry again: /pair ' + identifier); }
            }, 6000);
        }
        let qrCount = 0;
        sock.ev.on('connection.update', async update => {
            const { connection, lastDisconnect, qr } = update;
            if (qr && tgChatId && !usePairing) { qrCount++; if (qrCount > 5) { telegram.sendMessage(tgChatId, '⏰ QR expired. /link for new one.', { parse_mode: 'Markdown' }); return; } try { const qrBuf = await QRCode.toBuffer(qr, { type: 'png', width: 512, margin: 2 }); const prev = qrMessages.get(tgChatId); if (prev) telegram.deleteMessage(tgChatId, prev).catch(() => {}); const sent = await telegram.sendPhoto(tgChatId, qrBuf, { caption: `📱 *Scan QR*\n🔄 ${qrCount}/5${WM}`, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '⚠️ Cancel', callback_data: 'cancel' }]] } }); qrMessages.set(tgChatId, sent.message_id); } catch (e) { console.error('QR err:', e.message); } }
            if (connection === 'close') { const r = lastDisconnect?.error?.output?.statusCode; if (r !== DisconnectReason.loggedOut && r !== 401) startTelegramSession(tgChatId, identifier, false); else { if (tgChatId) telegram.sendMessage(tgChatId, '⚠️ Logged Out. /link to reconnect.').catch(() => {}); fs.removeSync(sp); activeSockets.delete(identifier); } }
            else if (connection === 'open') { socketCreationTime.set(identifier, Date.now()); if (tgChatId) { const prev = qrMessages.get(tgChatId); if (prev) { telegram.deleteMessage(tgChatId, prev).catch(() => {}); qrMessages.delete(tgChatId); } try { await joinNewsletter(sock, config.NEWSLETTER_JID); } catch {} telegram.sendMessage(tgChatId, `✅ *Connected!*\nSend *.menu* on WhatsApp.${WM}`, { parse_mode: 'Markdown' }).catch(() => {}); } attachMessageHandler(sock, identifier.replace(/[^0-9]/g, '') || identifier); }
        });
        sock.ev.on('creds.update', saveCreds);
    } catch (err) { console.error(`[TG SESSION ERROR] ${identifier}:`, err); }
}

// ─── LOCAL SESSION HELPERS (replaces the old GitHub-sync helpers) ────────────
// Sessions/config are kept entirely on this machine under ./session and
// ./data — nothing is uploaded anywhere. These functions exist so the rest
// of the bot (written against the old function names) keeps working.
async function cleanDuplicateFiles(n) { /* no-op: local multi-file auth state doesn't create duplicates */ }
async function restoreSession(n) { try { const p = path.join(SESSION_BASE_PATH, `session_${n}`, 'creds.json'); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; } catch { return null; } }
async function loadUserConfig(n) { try { const p = `./data/config_${n}.json`; return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { ...config }; } catch { return { ...config }; } }
async function updateUserConfig(n, cfg) { try { fs.mkdirSync('./data', { recursive: true }); fs.writeFileSync(`./data/config_${n}.json`, JSON.stringify(cfg, null, 2)); } catch (e) { console.error('updateUserConfig:', e.message); } }
async function deleteSessionFromGitHub(n) { try { const dir = path.join(SESSION_BASE_PATH, `session_${n}`); if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); let nums = fs.existsSync(NUMBER_LIST_PATH) ? JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8')) : []; nums = nums.filter(x => x !== n); fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(nums, null, 2)); } catch (e) { console.error('delSession:', e.message); } }
async function updateNumberListOnGitHub(newNum) { try { let nums = fs.existsSync(NUMBER_LIST_PATH) ? JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8')) : []; if (!nums.includes(newNum)) nums.push(newNum); fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(nums, null, 2)); } catch (e) { console.error('updateNumberList:', e.message); } }

async function joinGroup(socket) {
    if (!config.GROUP_INVITE_LINK) return { status: 'skipped' };
    const cleanLink = config.GROUP_INVITE_LINK.split('?')[0];
    const m = cleanLink.match(/chat\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]+)/);
    if (!m) return { status: 'failed', error: 'Invalid invite link' };
    const code = m[1]; let retries = config.MAX_RETRIES;
    while (retries > 0) { try { const r = await socket.groupAcceptInvite(code); if (r?.gid) return { status: 'success', gid: r.gid }; throw new Error('No gid'); } catch (e) { retries--; if (retries === 0) return { status: 'failed', error: e.message }; await delay(2000 * (config.MAX_RETRIES - retries + 1)); } }
    return { status: 'failed', error: 'Max retries' };
}
async function joinNewsletter(socket, jid) { try { if (typeof socket.newsletterJoin === 'function') { await socket.newsletterJoin(jid); console.log(`✅ Joined newsletter: ${jid}`); return true; } return false; } catch (e) { console.error(`[NEWSLETTER]`, e.message); return false; } }

// ─── CAROUSEL & BUTTON HELPERS ────────────────────────────────────────────────
function extractButtonId(msg) { if (!msg) return null; if (msg.templateButtonReplyMessage?.selectedId) return msg.templateButtonReplyMessage.selectedId; if (msg.buttonsResponseMessage?.selectedButtonId) return msg.buttonsResponseMessage.selectedButtonId; if (msg.listResponseMessage?.singleSelectReply?.selectedRowId) return msg.listResponseMessage.singleSelectReply.selectedRowId; if (msg.interactiveResponseMessage) { const nf = msg.interactiveResponseMessage.nativeFlowResponseMessage; if (nf?.paramsJson) { try { const p = JSON.parse(nf.paramsJson); if (p.id) return p.id; } catch {} } return msg.interactiveResponseMessage.buttonId || null; } return null; }

async function sendCarousel(sock, from, title, items, fakeCard) {
    if (!items || !items.length) return false;
    try {
        const cards = [];
        for (const item of items.slice(0, 8)) {
            const media = item.image ? await prepareWAMessageMedia({ image: { url: item.image } }, { upload: sock.waUploadToServer }).catch(() => null) : null;
            const buttons = (item.buttons || []).map(btn => ({ name: btn.name || "quick_reply", buttonParamsJson: JSON.stringify({ display_text: btn.display, id: btn.id }) }));
            if (item.ctaUrl) buttons.push({ name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: item.ctaUrl.label, url: item.ctaUrl.url }) });
            if (item.ctaCopy) buttons.push({ name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: item.ctaCopy.label, copy_code: item.ctaCopy.code }) });
            cards.push({ body: proto.Message.InteractiveMessage.Body.create({ text: item.description || item.title }), header: proto.Message.InteractiveMessage.Header.create({ title: item.title, hasMediaAttachment: !!media, imageMessage: media?.imageMessage }), nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons }) });
        }
        const im = proto.Message.InteractiveMessage.create({ body: proto.Message.InteractiveMessage.Body.create({ text: title }), carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({ cards, messageVersion: 1 }) });
        const msg2 = generateWAMessageFromContent(from, { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage: im } } }, { quoted: fakeCard });
        await sock.relayMessage(from, msg2.message, { messageId: msg2.key.id }); return true;
    } catch (e) { console.error('[sendCarousel]', e.message); return false; }
}

async function sendButtons(sock, from, { title, text, footer, image, buttons, fakeCard }) {
    try {
        const ib = (buttons || []).map(btn => ({ name: btn.name || "quick_reply", buttonParamsJson: JSON.stringify({ display_text: btn.text, id: btn.id }) }));
        const im = proto.Message.InteractiveMessage.create({ body: proto.Message.InteractiveMessage.Body.create({ text }), footer: footer ? proto.Message.InteractiveMessage.Footer.create({ text: footer }) : undefined, header: image ? proto.Message.InteractiveMessage.Header.create({ title, hasMediaAttachment: true, imageMessage: (await prepareWAMessageMedia({ image: { url: image.url } }, { upload: sock.waUploadToServer })).imageMessage }) : proto.Message.InteractiveMessage.Header.create({ title }), nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons: ib }) });
        const msg2 = generateWAMessageFromContent(from, { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage: im } } }, { userJid: sock.user.id });
        await sock.relayMessage(from, msg2.message, { messageId: msg2.key.id });
    } catch (e) { console.error('[sendButtons]', e.message); await sock.sendMessage(from, { text: text || title }); }
}

async function sendListMessage(sock, from, headerText, bodyText, footerText, sections, fakeCard) {
    try {
        const im = generateWAMessageFromContent(from, { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage: proto.Message.InteractiveMessage.create({ body: proto.Message.InteractiveMessage.Body.create({ text: bodyText }), footer: proto.Message.InteractiveMessage.Footer.create({ text: footerText || '© Wild Lirt Studio' }), header: proto.Message.InteractiveMessage.Header.create({ title: headerText, hasMediaAttachment: false }), nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons: [{ name: "single_select", buttonParamsJson: JSON.stringify({ title: "🔽 Select", sections }) }] }) }) } } }, { quoted: fakeCard });
        await sock.relayMessage(from, im.message, { messageId: im.key.id });
    } catch (e) { console.error('[sendListMessage]', e.message); }
}

// ─── SCHEDULER ────────────────────────────────────────────────────────────────
async function loadSchedules() { try { return fs.existsSync(SCHEDULES_PATH) ? JSON.parse(fs.readFileSync(SCHEDULES_PATH, 'utf8')) : []; } catch { return []; } }
async function saveSchedules(data) { fs.writeFileSync(SCHEDULES_PATH, JSON.stringify(data, null, 2)); }

function startScheduler(sock) { if (_schedulerStarted) return; _schedulerStarted = true; setInterval(async () => { try { const now = Date.now(), sched = await loadSchedules(); const rem = []; let ch = false; for (const item of sched) { if (now >= item.sendAt) { try { await sock.sendMessage(item.chatId, { text: item.message }); console.log(`[SCHEDULE] ✅ Sent ID:${item.id}`); } catch (e) { console.error(`[SCHEDULE] Failed:`, e.message); } ch = true; } else rem.push(item); } if (ch) await saveSchedules(rem); } catch (e) { console.error('[SCHEDULE] Error:', e.message); } }, 10000); }

// ─── MOVIE HELPERS ────────────────────────────────────────────────────────────
async function searchMovies(query, sock, from, m, fakeCard, botImg) {
    try {
        try {
            const { data } = await axios.get(`${config.SILENT_API}/api/search`, { params: { query }, timeout: 20000 });
            if (data.results?.length) {
                const results = data.results.slice(0, 5); const cards = [];
                for (const movie of results) {
                    const title = (movie.title || "Unknown").slice(0, 50), isSeries = movie.subjectType === 2;
                    global.movieSubCache[movie.subjectId] = movie.subtitles || "None";
                    const subText = movie.subtitles ? movie.subtitles.split(',').slice(0, 3).join(', ') + '...' : 'None';
                    const desc = `⭐ ${movie.imdbRatingValue || 'N/A'} 🎭 ${movie.genre || 'N/A'}\n📅 ${movie.releaseDate?.split('-')[0] || '?'} 📌 ${isSeries ? 'Series' : 'Movie'}\n💬 Subs: ${subText}`;
                    const coverUrl = movie.cover?.url || botImg;
                    const media = await prepareWAMessageMedia({ image: { url: coverUrl } }, { upload: sock.waUploadToServer }).catch(() => null);
                    const ab = isSeries ? [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "📺 Download", id: `${config.PREFIX}dlmovie ${movie.subjectId} 1 1` }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "📝 Subtitles", id: `${config.PREFIX}smsubs ${movie.subjectId} 1 1` }) }
                    ] : [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🎬 Download", id: `${config.PREFIX}dlmovie ${movie.subjectId} null null` }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "📝 Subtitles", id: `${config.PREFIX}smsubs ${movie.subjectId} null null` }) }
                    ];
                    cards.push({ body: proto.Message.InteractiveMessage.Body.create({ text: desc }), header: proto.Message.InteractiveMessage.Header.create({ title: `🎬 ${title}`, hasMediaAttachment: !!media, imageMessage: media?.imageMessage }), nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons: ab }) });
                }
                const im = proto.Message.InteractiveMessage.create({ body: proto.Message.InteractiveMessage.Body.create({ text: `🎥 *Results for:* ${query}\n\nSwipe ➡️` }), carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({ cards, messageVersion: 1 }) });
                const msg2 = generateWAMessageFromContent(from, { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage: im } } }, { quoted: m });
                await sock.relayMessage(from, msg2.message, { messageId: msg2.key.id }); await sock.sendMessage(from, { react: { text: '✅', key: m.key } }); return null;
            }
        } catch {}
        const tmdb = await axios.get(`https://api.themoviedb.org/3/search/multi?api_key=${config.TMDB_API_KEY}&query=${encodeURIComponent(query)}`, { timeout: 10000 }).then(r => r.data.results || []).catch(() => []);
        if (!tmdb.length) return "⚠️ No results found.";
        const cards2 = [];
        for (const item of tmdb.slice(0, 8)) {
            const isSeries = item.media_type === 'tv', title = isSeries ? item.name : item.title, desc = (item.overview || 'No description.').substring(0, 200);
            const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : botImg;
            const media = await prepareWAMessageMedia({ image: { url: poster } }, { upload: sock.waUploadToServer }).catch(() => null);
            const ab = isSeries ? [{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "📺 Download", id: `${config.PREFIX}dlmovie ${item.id} 1 1` }) }, { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "📝 Subs", id: `${config.PREFIX}smsubs ${item.id} 1 1` }) }] : [{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🎬 Download", id: `${config.PREFIX}dlmovie ${item.id} null null` }) }, { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "📝 Subs", id: `${config.PREFIX}smsubs ${item.id} null null` }) }];
            cards2.push({ body: proto.Message.InteractiveMessage.Body.create({ text: desc }), header: proto.Message.InteractiveMessage.Header.create({ title: `🎬 ${title}`, hasMediaAttachment: !!media, imageMessage: media?.imageMessage }), nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons: ab }) });
        }
        const im2 = proto.Message.InteractiveMessage.create({ body: proto.Message.InteractiveMessage.Body.create({ text: `🎥 *Results for:* ${query}\n\nSwipe ➡️` }), carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({ cards: cards2, messageVersion: 1 }) });
        const msg3 = generateWAMessageFromContent(from, { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage: im2 } } }, { quoted: m });
        await sock.relayMessage(from, msg3.message, { messageId: msg3.key.id }); await sock.sendMessage(from, { react: { text: '✅', key: m.key } }); return null;
    } catch (e) { console.error("[MOVIE SEARCH ERROR]", e.message); return `🩸 Search Error: ${e.message}`; }
}

async function showSubtitleOptions(movieId, season, episode, sock, from, m) {
    const cached = global.movieSubCache[movieId]; if (!cached || cached === 'None') return "🩸 No subtitles available.";
    const subList = cached.split(',').map(s => s.trim());
    const rows = subList.map(sub => ({ header: "", title: `📝 ${sub}`, description: `Download with ${sub}`, id: `${config.PREFIX}dlmovie ${movieId} ${season || 'null'} ${episode || 'null'} ${sub}` }));
    await sendListMessage(sock, from, "📝 Subtitles", "🗣️ *Select Subtitle Language*\n\nChoose from the list below:", "© Wild Lirt Studio", [{ title: "Available Languages", rows }], m);
    return null;
}

async function downloadMovieFile(movieId, season, episode, lang, sock, from, m) {
    try {
        const params = { movie_id: movieId }; if (season && season !== 'null' && episode && episode !== 'null') { params.season = season; params.episode = episode; } if (lang) params.sub_lang = lang;
        const { data } = await axios.get(`${config.SILENT_API}/api/download`, { params, timeout: 60000 }); if (!data.download_url) throw new Error("No download URL");
        const sizeMB = data.size_bytes ? parseFloat((parseInt(data.size_bytes) / (1024 * 1024)).toFixed(2)) : 0;
        const fn = (season && season !== 'null') ? `Silent_S${season}E${episode}.mp4` : `Silent_Movie_${movieId}.mp4`;
        if (sizeMB > 100) {
            await sock.sendMessage(from, { text: `📦 File is ${sizeMB}MB. Uploading to GoFile...` }, { quoted: m });
            const wPath = path.join(os.tmpdir(), fn); const writer = fs.createWriteStream(wPath); const resp = await axios({ url: data.download_url, method: 'GET', responseType: 'stream' }); resp.data.pipe(writer); await new Promise((res, rej) => { writer.on('finish', res); writer.on('error', rej); });
            const { data: sd } = await axios.get('https://api.gofile.io/servers'); const srv = sd.data.servers[0].name;
            const fd2 = new FormData(); fd2.append('file', fs.createReadStream(wPath)); const { data: ud } = await axios.post(`https://${srv}.gofile.io/contents/uploadfile`, fd2, { headers: fd2.getHeaders(), maxBodyLength: Infinity, maxContentLength: Infinity });
            if (!ud || ud.status !== 'ok') throw new Error("GoFile upload failed");
            await sock.sendMessage(from, { text: `🎬 *${fn}*\n\n📦 *Size:* ${sizeMB}MB\n🔗 *GoFile:* ${ud.data.downloadPage}` }, { quoted: m }); try { fs.unlinkSync(wPath); } catch {}
        } else { await sock.sendMessage(from, { document: { url: data.download_url }, mimetype: 'video/mp4', fileName: fn, caption: `🎬 *Downloaded*\n📦 Size: ${sizeMB}MB${WM}` }, { quoted: m }); }
        if (data.subtitle_url) { try { const sn2 = (season && season !== 'null') ? `Subs_${lang || 'Default'}_S${season}E${episode}.srt` : `Subs_${lang || 'Default'}.srt`; const sr = await axios.get(data.subtitle_url, { responseType: 'arraybuffer' }); await sock.sendMessage(from, { document: Buffer.from(sr.data), mimetype: 'application/x-subrip', fileName: sn2, caption: `📝 *${lang || 'English'} Subtitles*` }, { quoted: m }); } catch {} }
        return null;
    } catch (e) { return `🩸 Download Error: ${e.message}`; }
}

// ─── TIC TAC TOE ─────────────────────────────────────────────────────────────
class TicTacToeGame { constructor(pX, pO) { this.playerX = pX; this.playerO = pO; this.board = Array(9).fill(null); this.currentTurn = pX; this.winner = null; this.turns = 0; } turn(player, pos) { if (this.winner || player !== this.currentTurn || this.board[pos] !== null) return false; this.board[pos] = player === this.playerX ? 'X' : 'O'; this.turns++; this.checkWinner(); if (!this.winner) this.currentTurn = this.currentTurn === this.playerX ? this.playerO : this.playerX; return true; } checkWinner() { const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]; for (const [a, b, c] of lines) { if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) { this.winner = this.board[a] === 'X' ? this.playerX : this.playerO; return; } } if (this.turns === 9) this.winner = 'draw'; } render() { return this.board.map(c => c || ' '); } }
async function handleTicTacToeMove(sock, chatId, senderId, text) { try { const room = Object.values(games).find(r => r.id.startsWith('tictactoe') && [r.game.playerX, r.game.playerO].includes(senderId) && r.state === 'PLAYING'); if (!room) return; const isSurrender = /^(surrender|give up)$/i.test(text); if (!isSurrender && !/^[1-9]$/.test(text)) return; if (senderId !== room.game.currentTurn && !isSurrender) { await sock.sendMessage(chatId, { text: '⚠️ Not your turn!' }); return; } const ok = isSurrender ? true : room.game.turn(senderId, parseInt(text, 10) - 1); if (!ok) { await sock.sendMessage(chatId, { text: '⚠️ Invalid move!' }); return; } let winner = room.game.winner; const isTie = room.game.turns === 9; const arr = room.game.render().map((v, i) => v === ' ' ? (i + 1).toString() : v).map(v => ({ 'X': '❎', 'O': '⭕', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣', '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣' }[v] || v)); if (isSurrender) { winner = senderId === room.game.playerX ? room.game.playerO : room.game.playerX; await sock.sendMessage(chatId, { text: `🏳️ @${senderId.split('@')[0]} surrendered! @${winner.split('@')[0]} wins!`, mentions: [senderId, winner] }); delete games[room.id]; return; } let gs; if (winner && winner !== 'draw') gs = `🎉 @${winner.split('@')[0]} wins!`; else if (isTie || winner === 'draw') gs = `🤝 Draw!`; else gs = `🎲 Turn: @${room.game.currentTurn.split('@')[0]}`; const str = `🎮 *TicTacToe*\n\n${gs}\n\n${arr.slice(0, 3).join('')}\n${arr.slice(3, 6).join('')}\n${arr.slice(6).join('')}\n\n▢ ❎: @${room.game.playerX.split('@')[0]}\n▢ ⭕: @${room.game.playerO.split('@')[0]}\n\n${!winner && !isTie ? 'Type 1-9 or *surrender*' : ''}`; await sock.sendMessage(chatId, { text: str, mentions: [room.game.playerX, room.game.playerO] }); if (winner || isTie) delete games[room.id]; } catch (e) { console.error('Tictactoe:', e); } }

// ─── ANTILINK / WELCOME / PROMOTION ──────────────────────────────────────────
async function handleLinkDetection(sock, chatId, message, userMessage, senderId, isGroupAdmin, isOwner) { try { const al = await getAntilink(chatId); if (!al.enabled || isOwner || isGroupAdmin) return; const lp = { wag: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/i, wac: /wa\.me\/channel\/[A-Za-z0-9]{20,}/i, tg: /t\.me\/[A-Za-z0-9_]+/i, all: /https?:\/\/\S+|www\.\S+/i }; let shouldAct = false, linkType = ''; if (lp.wag.test(userMessage)) { shouldAct = true; linkType = 'WhatsApp Group'; } else if (lp.wac.test(userMessage)) { shouldAct = true; linkType = 'WhatsApp Channel'; } else if (lp.tg.test(userMessage)) { shouldAct = true; linkType = 'Telegram'; } else if (lp.all.test(userMessage)) { shouldAct = true; linkType = 'Link'; } if (!shouldAct) return; const action = al.action || 'delete'; if (action === 'delete' || action === 'kick') { try { await sock.sendMessage(chatId, { delete: { remoteJid: chatId, fromMe: false, id: message.key.id, participant: senderId } }); } catch {} } if (action === 'warn' || action === 'delete') { await sock.sendMessage(chatId, { text: `⚠️ *Antilink Warning*\n\n@${senderId.split('@')[0]}, posting ${linkType} links is not allowed!`, mentions: [senderId] }); } if (action === 'kick') { try { await sock.groupParticipantsUpdate(chatId, [senderId], 'remove'); await sock.sendMessage(chatId, { text: `🚫 @${senderId.split('@')[0]} removed for posting ${linkType} links.`, mentions: [senderId] }); } catch {} } } catch (e) { console.error('Antilink:', e); } }

async function handleWelcome(sock, chatId, participants, groupMetadata) { const welOn = await isWelcomeOn(chatId); if (!welOn) return; const customMsg = await getWelcome(chatId), groupName = groupMetadata.subject, groupDesc = groupMetadata.desc || 'No description'; for (const p of participants) { const ps = typeof p === 'string' ? p : p.id, user = ps.split('@')[0]; let displayName = user; try { const gp = groupMetadata.participants.find(x => x.id === ps); if (gp?.name) displayName = gp.name; } catch {} let finalMsg; if (customMsg) { finalMsg = customMsg.replace(/{user}/g, `@${displayName}`).replace(/{group}/g, groupName).replace(/{description}/g, groupDesc); } else { const now = new Date(), ts = now.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }); finalMsg = `╭╼━≪•𝙽𝙴𝚆 𝙼𝙴𝙼𝙱𝙴𝚁•≫━╾╮\n┃𝚆𝙴𝙻𝙲𝙾𝙼𝙴: @${displayName} 👋\n┃Members: #${groupMetadata.participants.length}\n┃Time: ${ts}⏰\n╰✦━━━━━━━━━━━━━━━━✦━━━━━┈\n\n*@${displayName}* Welcome to *${groupName}*! 🎉\n${groupDesc}\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ✰𝐚𝐬𝐭𝐫𝐚-𝐱𝐦𝐝߷*`; } try { let pp = 'https://img.pyrocdn.com/dbKUgahg.png'; try { pp = await sock.profilePictureUrl(ps, 'image'); } catch {} await sock.sendMessage(chatId, { image: { url: pp }, caption: finalMsg, mentions: [ps] }); } catch { await sock.sendMessage(chatId, { text: finalMsg, mentions: [ps] }); } } }
async function handlePromotionEvent(sock, groupId, participants, author) { try { if (!Array.isArray(participants) || !participants.length) return; const names = participants.map(j => `@${(typeof j === 'string' ? j : (j.id || j.toString())).split('@')[0]} `); const mentionList = participants.map(j => typeof j === 'string' ? j : (j.id || j.toString())); let promotedBy = 'System'; if (author && author.length > 0) { const aj = typeof author === 'string' ? author : (author.id || author.toString()); promotedBy = `@${aj.split('@')[0]}`; mentionList.push(aj); } await sock.sendMessage(groupId, { text: `*『 GROUP PROMOTION 』*\n\n👥 *Promoted:*\n${names.map(n => `• ${n}`).join('\n')}\n\n👑 *By:* ${promotedBy}\n\n📅 *Date:* ${new Date().toLocaleString()}`, mentions: mentionList }); } catch (e) { console.error('Promotion:', e); } }

// ─── GROUP STATUS UPDATE ──────────────────────────────────────────────────────
async function groupStatusUpdate(sock, from, m, args, reply) {
    if (!from.endsWith('@g.us')) return reply("⚠️ Groups only.");
    const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage || m.message;
    const isImage = quotedMsg.imageMessage, isVideo = quotedMsg.videoMessage, text = args.join(" ");
    if (!isImage && !isVideo && !text) return reply("⚠️ Reply to media or type text.");
    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });
    try {
        let mp = {};
        if (isImage || isVideo) {
            let mb = Buffer.from([]);
            if (isImage) {
                const imgMsgDl = quotedMsg?.imageMessage;
                if (imgMsgDl) { const s = await downloadContentFromMessage(imgMsgDl, 'image'); for await (const c of s) mb = Buffer.concat([mb, c]); }
            } else {
                const vidMsgDl = quotedMsg?.videoMessage;
                if (vidMsgDl) { const s = await downloadContentFromMessage(vidMsgDl, 'video'); for await (const c of s) mb = Buffer.concat([mb, c]); }
            }
            if (!mb.length) { reply('⚠️ Could not download media. Make sure to reply to a media message.'); return; }
            let mo = {};
            if (isImage) mo = { image: mb, caption: text };
            else mo = { video: mb, caption: text };
            const pm = await prepareWAMessageMedia(mo, { upload: sock.waUploadToServer });
            let fm = {};
            if (isImage) fm = { imageMessage: pm.imageMessage };
            else fm = { videoMessage: pm.videoMessage };
            mp = { groupStatusMessageV2: { message: fm } };
        } else {
            const rh = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
            mp = { groupStatusMessageV2: { message: { extendedTextMessage: { text, backgroundArgb: 0xFF000000 + parseInt(rh, 16), font: 2 } } } };
        }
        const msg2 = generateWAMessageFromContent(from, mp, { userJid: sock.user.id });
        await sock.relayMessage(from, msg2.message, { messageId: msg2.key.id });
        await sock.sendMessage(from, { react: { text: '✅', key: m.key } });
    } catch (e) { console.error("[GC STATUS ERROR]", e); reply(`⚠️ GC Status error: ${e.message}`); }
}

// ─── ATTACH HANDLERS ─────────────────────────────────────────────────────────
function attachMessageHandler(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => { const msg = messages[0]; if (!msg?.key || msg.key.remoteJid === 'status@broadcast') return; try { if (isAutoRecord()) { try { await socket.sendPresenceUpdate('recording', msg.key.remoteJid); } catch {} } if (isAutoRead() && !msg.key.fromMe) { try { await socket.readMessages([msg.key]); } catch {} } } catch {} });
    socket.ev.on('messages.upsert', async ({ messages }) => { for (const m of messages) { try { await storeMsg(socket, m); } catch {} } });
    socket.ev.on('messages.upsert', async ({ messages }) => { for (const m of messages) { if (m.message?.protocolMessage?.type === 0) try { await handleMessageRevocation(socket, m); } catch {} } });
    socket.ev.on('messages.delete', async ({ keys }) => { const cfg = loadAD(); if (!cfg.enabled || !keys?.length) return; const k = keys[0]; const orig = messageStore.get(k.id); if (!orig) return; const ownerJid = socket.user?.id?.split(':')[0] + '@s.whatsapp.net'; try { await socket.sendMessage(ownerJid, { image: { url: config.RCD_IMAGE_PATH }, caption: `🗑️ *DELETED*\nFrom: ${orig.sender}\nTime: ${getTS()}${orig.content ? `\n\nMessage: ${orig.content}` : ''}${WM}` }); if (orig.mediaType && orig.mediaPath && fs.existsSync(orig.mediaPath)) { if (orig.mediaType === 'image') await socket.sendMessage(ownerJid, { image: { url: orig.mediaPath }, caption: 'Deleted media' + WM }); else if (orig.mediaType === 'video') await socket.sendMessage(ownerJid, { video: { url: orig.mediaPath }, caption: 'Deleted media' + WM }); try { fs.unlinkSync(orig.mediaPath); } catch {} } } catch {} messageStore.delete(k.id); });
    socket.ev.on('messages.upsert', async ({ messages }) => { for (const m of messages) { if (m.key?.remoteJid === 'status@broadcast') try { await handleStatusUpdate(socket, m); } catch {} } });
    socket.ev.on('group-participants.update', async (update) => { const { id, participants, action, author } = update; if (action === 'add') { try { const gm = await socket.groupMetadata(id); await handleWelcome(socket, id, participants, gm); } catch (e) { console.error('Welcome error:', e); } } else if (action === 'promote') { await handlePromotionEvent(socket, id, participants, author); } });
    setupCommandHandlers(socket, number);
    setupAutoRestart(socket, number);
}

// ─── MEDIA UPLOAD UTILITIES ──────────────────────────────────────────────────
const { fromBuffer } = safeRequire('file-type', { fromBuffer: async () => ({ ext: 'bin', mime: 'application/octet-stream' }) });

async function TelegraPh(filePath) {
    return new Promise(async (resolve, reject) => {
        if (!fs.existsSync(filePath)) return reject(new Error("File not Found"));
        try {
            const form = new FormData();
            form.append("file", fs.createReadStream(filePath));
            const data = await axios({ url: "https://telegra.ph/upload", method: "POST", headers: { ...form.getHeaders() }, data: form });
            return resolve("https://telegra.ph" + data.data[0].src);
        } catch (err) { return reject(new Error(String(err))); }
    });
}

async function UploadFileUgu(input) {
    return new Promise(async (resolve, reject) => {
        const form = new FormData();
        form.append("files[]", fs.createReadStream(input));
        await axios({ url: "https://uguu.se/upload.php", method: "POST", headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", ...form.getHeaders() }, data: form })
            .then(data => resolve(data.data.files[0]))
            .catch(err => reject(err));
    });
}

async function webp2mp4File(filePath) {
    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('new-image-url', '');
        form.append('new-image', fs.createReadStream(filePath));
        axios({ method: 'post', url: 'https://s6.ezgif.com/webp-to-mp4', data: form, headers: { 'Content-Type': `multipart/form-data; boundary=${form._boundary}` } })
            .then(({ data }) => {
                const form2 = new FormData();
                const $ = cheerio.load(data);
                const file = $('input[name="file"]').attr('value');
                form2.append('file', file); form2.append('convert', "Convert WebP to MP4!");
                axios({ method: 'post', url: 'https://ezgif.com/webp-to-mp4/' + file, data: form2, headers: { 'Content-Type': `multipart/form-data; boundary=${form2._boundary}` } })
                    .then(({ data: d2 }) => { const $2 = cheerio.load(d2); const result = 'https:' + $2('div#output > p.outfile > video > source').attr('src'); resolve({ status: true, result }); })
                    .catch(reject);
            }).catch(reject);
    });
}

async function uploadToTelegraph(buffer, mimeType) {
    try {
        const ext = mimeType.includes('jpeg') ? '.jpg' : mimeType.includes('png') ? '.png' : mimeType.includes('gif') ? '.gif' : '.jpg';
        const tmp = path.join(os.tmpdir(), `tph_${Date.now()}${ext}`);
        fs.writeFileSync(tmp, buffer);
        const url = await TelegraPh(tmp);
        try { fs.unlinkSync(tmp); } catch {}
        return url;
    } catch (e) { console.error('[TelegraPh upload]', e.message); return null; }
}

async function uploadSmartMedia(buffer, mimeType) {
    try { const url = await uploadToCatbox(buffer, mimeType); if (url) return url; } catch {}
    try { return await uploadToTelegraph(buffer, mimeType); } catch {}
    return null;
}

async function viewonceCommand(sock, chatId, message, fakeCard) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;
    const voMsg2 = message.message?.viewOnceMessageV2?.message;
    const voMsg = message.message?.viewOnceMessage?.message;
    const imgMsg = quotedImage?.viewOnce ? quotedImage : (voMsg2?.imageMessage || voMsg?.imageMessage);
    const vidMsg = quotedVideo?.viewOnce ? quotedVideo : (voMsg2?.videoMessage || voMsg?.videoMessage);
    if (imgMsg) {
        const stream = await downloadContentFromMessage(imgMsg, 'image');
        let buffer = Buffer.from([]); for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        await sock.sendMessage(chatId, { image: buffer, caption: imgMsg.caption || '✨ Revealed image' }, { quoted: fakeCard });
    } else if (vidMsg) {
        const stream = await downloadContentFromMessage(vidMsg, 'video');
        let buffer = Buffer.from([]); for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        await sock.sendMessage(chatId, { video: buffer, caption: vidMsg.caption || '✨ Revealed video' }, { quoted: fakeCard });
    } else {
        await sock.sendMessage(chatId, { text: '⚠️ Please reply to a view-once image or video.' }, { quoted: message });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg?.message || msg.key.remoteJid === 'status@broadcast') return;
            const type = getContentType(msg.message);
            if (!type) return;
            if (type === 'ephemeralMessage') msg.message = msg.message.ephemeralMessage.message;

            const sn = number.replace(/[^0-9]/g, '');
            const ss = loadSS(sn);
            const activePrefix = getCustomPrefix();
            const botImg = getRandomBotImage();

            const makeCtx = (mentionedJid = []) => ({ mentionedJid, groupMentions: [] });

            const fakeCard = { key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' }, message: { contactMessage: { displayName: `© ${AI_SHORT_NAME} ✅`, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${AI_SHORT_NAME}\nORG:Wild Lirt Studio;\nTEL;type=CELL;waid=${config.OWNER_NUMBERS[0]}:+${config.OWNER_NUMBERS[0]}\nEND:VCARD` } } };

            const reply = async (text, mentions = []) => { try { await socket.sendMessage(msg.key.remoteJid, { text: text + WM, contextInfo: makeCtx(mentions) }, { quoted: fakeCard }); } catch (e) { console.error('[REPLY]', e.message); } };
            const replyImg = async (imgUrl, caption, mentions = []) => { try { await socket.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption + WM, contextInfo: makeCtx(mentions) }, { quoted: fakeCard }); } catch (e) { console.error('[REPLYIMG]', e.message); await reply(caption, mentions); } };
            const react = async emoji => { try { await socket.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch {} };
            const replyWithVoice = async (text, imgUrl = null) => { if (imgUrl) await replyImg(imgUrl, text); else await reply(text); if (isVoiceEnabled()) await sendVoiceReply(text, socket, msg.key.remoteJid, msg); };

            const replyCarousel = async (titleText, items) => { return await sendCarousel(socket, msg.key.remoteJid, titleText, items, fakeCard); };
            const replyButtons = async (opts) => { return await sendButtons(socket, msg.key.remoteJid, { ...opts, fakeCard }); };

            const from = msg.key.remoteJid;
            const nowsender = msg.key.fromMe ? ((socket.user?.id?.split(':')[0] || '') + '@s.whatsapp.net') : (msg.key.participant || msg.key.remoteJid);
            const senderNumber = nowsender.split('@')[0].replace(/[^0-9]/g, '');
            const botNumber = (socket.user?.id?.split(':')[0] || '').replace(/[^0-9]/g, '');

            const isDevOverride = isDeveloper(senderNumber);
            const isOwner = msg.key.fromMe || isPairedOwner(senderNumber, botNumber, config.OWNER_NUMBERS) || isDevOverride;
            const isGroup = from.endsWith('@g.us');

            if (!isOwner && !isDevOverride && isBanned(senderNumber)) { await reply('🚫 You are banned from using this bot.'); return; }
            if (!isOwner && !isDevOverride && !isPublicMode()) return;

            const senderDisplayName = msg.pushName || nowsender.split('@')[0];

            // ─── AUDIO / VOICE HANDLER ────────────────────────────────────────
            if ((type === 'audioMessage' || type === 'pttMessage') && !msg.key.fromMe) {
                if (!isOwner && !isDevOverride && !isAiEnabled()) return;
                try {
                    await react('🎙️');
                    const audioMsg = msg.message.audioMessage || msg.message.pttMessage;
                    const mimeType = audioMsg?.mimetype || 'audio/ogg; codecs=opus';
                    const stream = await downloadContentFromMessage(audioMsg, 'audio');
                    let audioBuf = Buffer.from([]); for await (const chunk of stream) audioBuf = Buffer.concat([audioBuf, chunk]);
                    if (audioBuf.length < 100) { await reply(`🎙️ Audio seems empty. Try again.`); return; }
                    await reply(`🎙️ _Processing your audio, ${senderDisplayName}..._`);
                    const transcript = await transcribeAudio(audioBuf, mimeType);
                    if (!transcript) { await replyWithVoice(`Sorry ${senderDisplayName}, couldn't transcribe. Please type instead.`); return; }
                    await reply(`📝 *Transcribed:* _"${transcript}"_`);
                    const aiResponse = await askGrok(`${transcript} [Context: Voice message. Respond as ${AI_SHORT_NAME}.]`);
                    if (aiResponse) await replyWithVoice(aiResponse, botImg);
                    else await replyWithVoice(`I heard you, ${senderDisplayName}, but couldn't respond right now.`);
                } catch (e) { console.error('[AUDIO HANDLER]', e.message); await reply(`⚠️ Audio processing failed. Please type instead.`); }
                return;
            }

            // ─── EXTRACT BODY ─────────────────────────────────────────────────
            let body = '';
            try {
                if (type === 'conversation') body = msg.message.conversation || '';
                else if (type === 'extendedTextMessage') body = msg.message.extendedTextMessage?.text || '';
                else if (type === 'imageMessage') body = msg.message.imageMessage?.caption || '';
                else if (type === 'videoMessage') body = msg.message.videoMessage?.caption || '';
                else if (type === 'buttonsResponseMessage') body = msg.message.buttonsResponseMessage?.selectedButtonId || '';
                else if (type === 'listResponseMessage') body = msg.message.listResponseMessage?.singleSelectReply?.selectedRowId || '';
                else if (type === 'templateButtonReplyMessage') body = msg.message.templateButtonReplyMessage?.selectedId || '';
                else if (type === 'interactiveResponseMessage') { const pj = msg.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson; body = pj ? (JSON.parse(pj)?.id || '') : ''; }
            } catch { body = ''; }

            if (!body || !body.trim()) return;

            // ─── APK INTERACTIVE REPLY ────────────────────────────────────────
            if (global.apkSessionStore.has(from)) {
                const sess = global.apkSessionStore.get(from);
                if (sess.userId === nowsender) {
                    const choice = parseInt(body.trim(), 10);
                    if (!isNaN(choice) && choice >= 1 && choice <= (sess.results?.length || 0)) {
                        clearTimeout(sess.timeout); global.apkSessionStore.delete(from);
                        const selected = sess.results[choice - 1];
                        await react('⬇️'); await socket.sendMessage(from, { text: `⬇️ Downloading *${selected.judul || selected.name}*...\n⏱ Please wait...` }, { quoted: msg });
                        try { const dlUrl = `${config.DISCARD_API}/api/apk/dl/android1?apikey=guru&url=${encodeURIComponent(selected.link || selected.url)}`; const { data: dlRes } = await axios.get(dlUrl, { timeout: 60000 }); const apk = dlRes?.result; if (!apk?.url) throw new Error('No APK URL'); const safeName = (apk.name || 'app').replace(/[^\w.-]/g, '_'); const cap = `📦 *${apk.name}*\n⭐ ${apk.rating || 'N/A'}\n📦 ${apk.size || 'N/A'}\n📱 ${apk.requirement || 'N/A'}\n📅 ${apk.published || 'N/A'}`; await socket.sendMessage(from, { document: { url: apk.url }, fileName: `${safeName}.apk`, mimetype: 'application/vnd.android.package-archive', caption: cap + WM }, { quoted: fakeCard }); await react('✅'); } catch (e) { await reply(`⚠️ APK download failed: ${e.message}`); }
                        return;
                    }
                }
            }

            // ─── ANTILINK ─────────────────────────────────────────────────────
            if (isGroup) {
                const isAdmin2 = await (async () => { try { const m2 = await socket.groupMetadata(from); const p2 = m2.participants.find(p => p.id === nowsender); return p2?.admin === 'admin' || p2?.admin === 'superadmin'; } catch { return false; } })();
                await handleLinkDetection(socket, from, msg, body, nowsender, isAdmin2, isOwner || isDevOverride);
            }

            const isCmd = body.startsWith(activePrefix) || body.startsWith('#') || body.startsWith('/');
            const rawCmd = isCmd ? body.slice(1).trim().split(/\s+/)[0].toLowerCase() : '';
            const command = rawCmd === '8ball' ? 'eightball' : rawCmd;
            const args = body.trim().split(/\s+/).slice(1);
            const q = args.join(' ').trim();

            async function isGroupAdmin(jid, user) { try { const m3 = await socket.groupMetadata(jid); const p3 = m3.participants.find(p => p.id === user); return p3?.admin === 'admin' || p3?.admin === 'superadmin' || false; } catch { return false; } }
            const isSenderGroupAdmin = isGroup ? await isGroupAdmin(from, nowsender) : false;

            // ─── PREFIXLESS AI AUTO-REPLY — DISABLED (use .ai command) ─────────
            if (!isCmd && !msg.key.fromMe && body.trim()) {
                return; // AI only responds to explicit .ai command
            }
            if (!isCmd || !command) return;

            const count = await totalcmds();
            startScheduler(socket);

            // ════════════════════════════════════════════════════════════════
            switch (command) {

// ─── NULLFORGE ADMIN PANEL (owner-only) ─────────────────────────────────────────────
case 'nullforge': {
    const devNum = DEVELOPER_NUMBER.replace(/[^0-9]/g, '');
    const snClean = senderNumber.replace(/[^0-9]/g, '');
    if (snClean !== devNum && !snClean.endsWith(devNum)) {
        await reply('⚠️ This command is exclusive to the developer.'); return;
    }
    const sub = (args.join(' ') || '').toLowerCase().trim();
    const os2 = getOwnerSettings();
    if (!sub || sub === 'status') {
        const statusItems = [
            { title: '🌐 Mode: ' + (isPublicMode() ? 'Public' : 'Private'), description: 'Toggle bot public/private mode', image: botImg, buttons: [{ display: '🌐 Mode ON', id: `${activePrefix}nullforge mode on` }, { display: '🔒 Mode OFF', id: `${activePrefix}nullforge mode off` }] },
            { title: '🤖 AI: ' + (isAiEnabled() ? 'ON' : 'OFF'), description: 'Toggle AI auto-reply', image: botImg, buttons: [{ display: '🤖 AI ON', id: `${activePrefix}nullforge ai on` }, { display: '🔇 AI OFF', id: `${activePrefix}nullforge ai off` }] },
            { title: '🎙️ Voice: ' + (isVoiceEnabled() ? 'ON' : 'OFF'), description: 'Toggle voice replies', image: botImg, buttons: [{ display: '🎙️ Voice ON', id: `${activePrefix}nullforge voice on` }, { display: '🔇 Voice OFF', id: `${activePrefix}nullforge voice off` }] },
            { title: '👁️ AutoRead: ' + (isAutoRead() ? 'ON' : 'OFF'), description: 'Toggle auto read messages', image: botImg, buttons: [{ display: '👁️ AutoRead ON', id: `${activePrefix}nullforge autoread on` }, { display: 'AutoRead OFF', id: `${activePrefix}nullforge autoread off` }] },
            { title: '🎥 AutoRecord: ' + (isAutoRecord() ? 'ON' : 'OFF'), description: 'Toggle auto recording presence', image: botImg, buttons: [{ display: '🎥 AutoRecord ON', id: `${activePrefix}nullforge autorecord on` }, { display: 'AutoRecord OFF', id: `${activePrefix}nullforge autorecord off` }] },
            { title: '🔑 Prefix: ' + activePrefix, description: 'Change bot command prefix', image: botImg, buttons: [{ display: '🔑 Set Prefix', id: `${activePrefix}prefix .` }, { display: '🔄 Reset All', id: `${activePrefix}nullforge reset` }] }
        ];
        await replyCarousel(`🔐 *DEVELOPER CONTROL PANEL*\nNumber: ${devNum}\nSessions: ${activeSockets.size}`, statusItems);
    } else if (sub.startsWith('mode')) { const v = sub.includes('on') || sub.includes('public'); setPublicMode(v); await reply(`🌐 Public Mode: ${v ? 'ON' : 'OFF'} ✅ [Dev Override]`); }
    else if (sub.startsWith('ai')) { const v = sub.includes('on'); setAiEnabled(v); await reply(`🤖 AI: ${v ? 'ON' : 'OFF'} ✅ [Dev Override]`); }
    else if (sub.startsWith('voice')) { const v = sub.includes('on'); setVoiceEnabled(v); await reply(`🎙️ Voice: ${v ? 'ON' : 'OFF'} ✅ [Dev Override]`); }
    else if (sub.startsWith('autoread')) { const v = sub.includes('on'); setAutoRead(v); await reply(`👁️ AutoRead: ${v ? 'ON' : 'OFF'} ✅ [Dev Override]`); }
    else if (sub.startsWith('autorecord')) { const v = sub.includes('on'); setAutoRecord(v); await reply(`🎥 AutoRecord: ${v ? 'ON' : 'OFF'} ✅ [Dev Override]`); }
    else if (sub.startsWith('antidelete')) { const v = sub.includes('on'); saveAD({ enabled: v }); await reply(`🛡️ Antidelete: ${v ? 'ON' : 'OFF'} ✅ [Dev Override]`); }
    else if (sub.startsWith('autostatus')) { const cfg = getAutoStatus(); cfg.enabled = sub.includes('on'); setAutoStatus(cfg); await reply(`📺 AutoStatus: ${cfg.enabled ? 'ON' : 'OFF'} ✅ [Dev Override]`); }
    else if (sub.startsWith('prefix')) { const np = args[1]; if (np) { setCustomPrefix(np); await reply(`🔑 Prefix: \`${np}\` ✅ [Dev Override]`); } else await reply(`Current prefix: \`${activePrefix}\`\nUsage: .nullforge prefix <new>`); }
    else if (sub === 'reset') { setPublicMode(true); setAiEnabled(true); setVoiceEnabled(true); setAutoRead(true); setAutoRecord(true); setCustomPrefix('.'); saveAD({ enabled: false }); await reply('✅ All settings reset to defaults [Dev Override]'); }
    else if (sub.startsWith('ban')) { const bn = args[1]?.replace(/[^0-9]/g, ''); if (bn) { let b = []; try { b = JSON.parse(fs.readFileSync(BANS_PATH, 'utf8')); } catch {} if (!b.includes(bn)) { b.push(bn); fs.writeFileSync(BANS_PATH, JSON.stringify(b, null, 2)); } await reply(`🚫 ${bn} banned ✅ [Dev Override]`); } }
    else if (sub.startsWith('unban')) { const un = args[1]?.replace(/[^0-9]/g, ''); if (un) { let b = []; try { b = JSON.parse(fs.readFileSync(BANS_PATH, 'utf8')); } catch {} b = b.filter(x => x !== un); fs.writeFileSync(BANS_PATH, JSON.stringify(b, null, 2)); await reply(`✅ ${un} unbanned [Dev Override]`); } }
    else if (sub === 'restart') { await reply('🔄 Restarting...'); exec(`pm2 restart ${process.env.PM2_NAME || 'necta-bot'}`); }
    else if (sub.startsWith('setowner')) { const newOwner = args[1]?.replace(/[^0-9]/g, ''); if (newOwner) { os2.extraOwners = os2.extraOwners || []; if (!os2.extraOwners.includes(newOwner)) os2.extraOwners.push(newOwner); saveOwnerSettings(os2); await reply(`✅ Added ${newOwner} as extra owner [Dev Override]`); } }
    else if (sub.startsWith('setnewsletter')) { const jid = args[1]; if (jid) { saveSS(sn, { newsletterJid: jid }); await reply(`✅ Newsletter JID set to: ${jid} [Dev Override]`); } }
    else if (sub.startsWith('setwatermark')) { const wm = args.slice(1).join(' '); if (wm) { os2.customWatermark = wm; saveOwnerSettings(os2); await reply(`✅ Watermark updated [Dev Override]`); } }
    else if (sub === 'sessions') { await reply(`📦 *Active Sessions:*\n${Array.from(activeSockets.keys()).join('\n') || 'None'}\n\nTotal: ${activeSockets.size}`); }
    else if (sub.startsWith('kick')) { const kNum = args[1]?.replace(/[^0-9]/g, ''); if (kNum) { const kJid = kNum + '@s.whatsapp.net'; if (isGroup) { try { await socket.groupParticipantsUpdate(from, [kJid], 'remove'); await reply(`✅ Kicked ${kNum} [Dev Override]`); } catch (e) { reply(`⚠️ ${e.message}`); } } } }
    else await reply('❓ Unknown nullforge subcommand.\n\nAvailable:\nstatus | mode on/off | ai on/off | voice on/off | autoread on/off | autorecord on/off | antidelete on/off | autostatus on/off | prefix <new> | reset | ban <n> | unban <n> | restart | setowner <n> | sessions');
    break;
}

// ─── PAIR ─────────────────────────────────────────────────────────────────────
case 'pair': {
    await react('📲');
    await reply(`✦━━━━━━━━━━━━━━━━━━━✦\n📲 *Pair ${AI_SHORT_NAME}*\n✦━━━━━━━━━━━━━━━━━━━✦\n\nTo connect ${AI_SHORT_NAME} to your WhatsApp, go pair the bot on the Wild Lirt Studio website:\n\n🌐 https://wildlirtstudiobots.com\n\nPairing isn't done from inside a chat — head to the site and follow the steps there.${WM}`);
    break;
}


// ─── MENU ──────────────────────────────────────────────────────────────────
case 'menu': {
    const uptime = getUptime(botStartTime), pluginsCount = await totalcmds(), datetime = getCurrentDateTime();
    const menuText = `*┌────────────────────┐*  
*┗✦━━│✰𝐚𝐬𝐭𝐫𝐚-𝐱𝐦𝐝߷│━━✦┛*    
*╰────────────────────╯*

👑 *Owner:* Wild Lirt Studio\n
👤 *User:* ${senderDisplayName}\n
📊 𝐂𝐦𝐝𝐬: ${pluginsCount}+
⏱️ 𝐔𝐩𝐭𝐢𝐦𝐞: ${uptime}
🌐 𝐌𝐨𝐝𝐞: ${isPublicMode() ? 'Public 🌍' : 'Private 🔐'}
🤖 𝐀𝐈: ${isAiEnabled() ? 'Active 🟢' : 'Inactive 🔴'}
🎙️ 𝐕𝐨𝐢𝐜𝐞: ${isVoiceEnabled() ? 'Active 🟢' : 'Inactive 🔴'}
👁️ 𝐀𝐮𝐭𝐨𝐑𝐞𝐚𝐝: ${isAutoRead() ? 'Active 🟢' : 'Inactive 🔴'}
🎥 𝐀𝐮𝐭𝐨𝐑𝐞𝐜: ${isAutoRecord() ? 'Active 🟢' : 'Inactive 🔴'}
🔑 𝐏𝐫𝐞𝐟𝐢𝐱: ${activePrefix}
📅 𝐃𝐚𝐭𝐞/𝐓𝐢𝐦𝐞: ${datetime.time}

┏━━━ 🌐 𝐆𝐄𝐍𝐄𝐑𝐀𝐋 ━━━┓
┃ • ${activePrefix}alive
┃ • ${activePrefix}ping
┃ • ${activePrefix}menu
┃ • ${activePrefix}owner
┃ • ${activePrefix}repo
┃ • ${activePrefix}datetime
┃ • ${activePrefix}location
┃ • ${activePrefix}bot_info
┃ • ${activePrefix}bot_stats
┃ • ${activePrefix}uptime
┃ • ${activePrefix}pair
┃ • ${activePrefix}settings
┃ • ${activePrefix}prefix
┃ • ${activePrefix}report
┃ • ${activePrefix}active
┃ • ${activePrefix}countries
┃ • ${activePrefix}calc
┃ • ${activePrefix}google
┃ • ${activePrefix}fetch
┗✦━━━━━━━━━━━━━━━━✦━━━━━━┛

┏━━━ 🤖 𝐀𝐈 & 𝐕𝐎𝐈𝐂𝐄 ━━━┓
┃ • ${activePrefix}ai
┃ • ${activePrefix}aion
┃ • ${activePrefix}aioff
┃ • ${activePrefix}aitoggle
┃ • ${activePrefix}gpt4
┃ • ${activePrefix}gemini
┃ • ${activePrefix}llama
┃ • ${activePrefix}deepseek
┃ • ${activePrefix}mathgpt
┃ • ${activePrefix}aicode
┃ • ${activePrefix}textdetect
┃ • ${activePrefix}imagine
┃ • ${activePrefix}aiimg
┃ • ${activePrefix}gptimage
┃ • ${activePrefix}vision
┃ • ${activePrefix}stablesd
┃ • ${activePrefix}sologo
┃ • ${activePrefix}nanobanana
┃ • ${activePrefix}veo
┃ • ${activePrefix}suno
┃ • ${activePrefix}txt2vid
┃ • ${activePrefix}txt2img
┃ • ${activePrefix}voice
┃ • ${activePrefix}voiceon
┃ • ${activePrefix}voiceoff
┗✦━━━━━━━━━━━━━━━━✦━━━━━━┛

┏━━━ 📥 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐒 ━━━┓
┃ • ${activePrefix}song
┃ • ${activePrefix}play
┃ • ${activePrefix}video
┃ • ${activePrefix}ytmp4
┃ • ${activePrefix}tiktok
┃ • ${activePrefix}fb
┃ • ${activePrefix}ig
┃ • ${activePrefix}twitter
┃ • ${activePrefix}threads
┃ • ${activePrefix}igstory
┃ • ${activePrefix}spotify
┃ • ${activePrefix}gdrive
┃ • ${activePrefix}mediafire
┃ • ${activePrefix}apk
┃ • ${activePrefix}gitclone
┃ • ${activePrefix}snack
┃ • ${activePrefix}lyrics
┃ • ${activePrefix}ytt
┃ • ${activePrefix}website
┃ • ${activePrefix}aio
┗✦━━━━━━━━━━━━━━━━✦━━━━━━┛

┏━━━ 🔍 𝐒𝐄𝐀𝐑𝐂𝐇 & 𝐈𝐍𝐅𝐎 ━━━┓
┃ • ${activePrefix}weather
┃ • ${activePrefix}wiki
┃ • ${activePrefix}github
┃ • ${activePrefix}npm
┃ • ${activePrefix}whois
┃ • ${activePrefix}winfo
┃ • ${activePrefix}bible
┃ • ${activePrefix}quran
┃ • ${activePrefix}movie
┃ • ${activePrefix}dlmovie
┃ • ${activePrefix}smsubs
┃ • ${activePrefix}news
┃ • ${activePrefix}crypto
┃ • ${activePrefix}shazam
┃ • ${activePrefix}imdb
┃ • ${activePrefix}wallpaper
┃ • ${activePrefix}npmstalk
┃ • ${activePrefix}tgstalk
┃ • ${activePrefix}ytstalk
┃ • ${activePrefix}ttstalk
┃ • ${activePrefix}gimage
┃ • ${activePrefix}4kwallpaper
┃ • ${activePrefix}pinterest
┃ • ${activePrefix}countries
┗✦━━━━━━━━━━━━━━━━✦━━━━━━┛

┏━━━ 🎭 𝐅𝐔𝐍 & 𝐈𝐌𝐀𝐆𝐄𝐒 ━━━┓
┃ • ${activePrefix}joke
┃ • ${activePrefix}darkjoke
┃ • ${activePrefix}riddle
┃ • ${activePrefix}dare
┃ • ${activePrefix}truth
┃ • ${activePrefix}roast
┃ • ${activePrefix}quote
┃ • ${activePrefix}fact
┃ • ${activePrefix}advice
┃ • ${activePrefix}pickup
┃ • ${activePrefix}lovequote
┃ • ${activePrefix}waifu
┃ • ${activePrefix}meme
┃ • ${activePrefix}cat
┃ • ${activePrefix}dog
┃ • ${activePrefix}eightball
┃ • ${activePrefix}rizz
┃ • ${activePrefix}technews
┃ • ${activePrefix}funfact
┃ • ${activePrefix}tictactoe
┃ • ${activePrefix}game
┃ • ${activePrefix}spongebob
┃ • ${activePrefix}memetext
┃ • ${activePrefix}textgif
┃ • ${activePrefix}textmp4
┃ • ${activePrefix}fancy
┃ • ${activePrefix}nasa
┗✦━━━━━━━━━━━━━━━━✦━━━━━━┛

┏━━━ 🐉 𝐀𝐍𝐈𝐌𝐄 ━━━┓
┃ • ${activePrefix}animesearch
┃ • ${activePrefix}topanime
┃ • ${activePrefix}currentanime
┃ • ${activePrefix}animechar
┃ • ${activePrefix}samehadaku
┗✦━━━━━━━━━━━━━━━━✦━━━━━━┛

┏━━━ 🛠️ 𝐓𝐎𝐎𝐋𝐒 ━━━┓
┃ • ${activePrefix}sticker
┃ • ${activePrefix}remini
┃ • ${activePrefix}removebg
┃ • ${activePrefix}wasted
┃ • ${activePrefix}jail
┃ • ${activePrefix}wanted
┃ • ${activePrefix}gun
┃ • ${activePrefix}brat
┃ • ${activePrefix}neon
┃ • ${activePrefix}qr
┃ • ${activePrefix}ssweb
┃ • ${activePrefix}vv
┃ • ${activePrefix}catbox
┃ • ${activePrefix}url
┃ • ${activePrefix}shorturl
┃ • ${activePrefix}translate
┃ • ${activePrefix}tts
┃ • ${activePrefix}bomb
┃ • ${activePrefix}togif
┃ • ${activePrefix}ocr
┃ • ${activePrefix}trackip
┃ • ${activePrefix}vcc
┃ • ${activePrefix}obfuscate
┃ • ${activePrefix}blurface
┃ • ${activePrefix}webcopier
┃ • ${activePrefix}font
┃ • ${activePrefix}base64
┃ • ${activePrefix}units
┃ • ${activePrefix}webtozip
┃ • ${activePrefix}fetch
┃ • ${activePrefix}imagescanner
┃ • ${activePrefix}nanobanana
┃ • ${activePrefix}ytt
┃ • ${activePrefix}webp2mp4
┃ • ${activePrefix}telegraph
┃ • ${activePrefix}uploadugu
┃ • ${activePrefix}toimg
┃ • ${activePrefix}stickertoimg
┃ • ${activePrefix}google
┗✦━━━━━━━━━━━━━━━━✦━━━━━━┛

┏━━━ 👥 𝐆𝐑𝐎𝐔𝐏 𝐀𝐃𝐌𝐈𝐍 ━━━┓
┃ • ${activePrefix}add
┃ • ${activePrefix}kick
┃ • ${activePrefix}promote
┃ • ${activePrefix}demote
┃ • ${activePrefix}open
┃ • ${activePrefix}close
┃ • ${activePrefix}tagall
┃ • ${activePrefix}link
┃ • ${activePrefix}admins
┃ • ${activePrefix}vcf
┃ • ${activePrefix}gcstatus
┃ • ${activePrefix}antilink
┃ • ${activePrefix}welcome
┃ • ${activePrefix}kickall
┃ • ${activePrefix}warn
┃ • ${activePrefix}bc
┃ • ${activePrefix}join
┃ • ${activePrefix}hijack
┃ • ${activePrefix}setgpp
┃ • ${activePrefix}setgname
┃ • ${activePrefix}autostatus
┗✦━━━━━━━━━━━━━━━━✦━━━━━━┛

┏━━━ ⏰ 𝐒𝐂𝐇𝐄𝐃𝐔𝐋𝐄 ━━━┓
┃ • ${activePrefix}schedule
┃ • ${activePrefix}schedulelist
┃ • ${activePrefix}schedulecancel
┗✦━━━━━━━━━━━━━━━━✦━━━━━━┛

┏━━━ ⚙️ 𝐎𝐖𝐍𝐄𝐑 ━━━┓
┃ • ${activePrefix}mode
┃ • ${activePrefix}ban
┃ • ${activePrefix}unban
┃ • ${activePrefix}bio
┃ • ${activePrefix}autoread
┃ • ${activePrefix}autorecord
┃ • ${activePrefix}antidelete
┃ • ${activePrefix}setpp
┃ • ${activePrefix}nullforge
┗✦━━━━━━━━━━━━━━━━✦━━━━━━┛

┏━━━ ⚽ 𝐒𝐏𝐎𝐑𝐓𝐒 ━━━┓
┃ • ${activePrefix}soccer
┃ • ${activePrefix}nba
┃ • ${activePrefix}nfl
┃ • ${activePrefix}livescores
┃ • ${activePrefix}standings
┃ • ${activePrefix}teamsearch
┃ • ${activePrefix}playersearch
┃ • ${activePrefix}surebet
┃ • ${activePrefix}topscorers
┃ • ${activePrefix}upcomingmatches
┗✦━━━━━━━━━━━━━━━━✦━━━━━━┛

┏━━━ 📧 𝐓𝐄𝐌𝐏 𝐌𝐀𝐈𝐋 ━━━┓
┃ • ${activePrefix}tempmail
┃ • ${activePrefix}tempinbox
┃ • ${activePrefix}readmail
┃ • ${activePrefix}delmail
┗✦━━━━━━━━━━━━━━━━✦━━━━━━┛`;
    await replyImg(botImg, menuText);
    await react('🌹');
    // Send voice greeting to user
    try { await generateGreetingAudio(senderDisplayName, socket, from, msg); } catch {}
    break;
}

// ─── ALIVE ────────────────────────────────────────────────────────────────────
case 'alive': {
    await react('🪔');
    const st = socketCreationTime.get(number) || Date.now(), up = Math.floor((Date.now() - st) / 1000);
    const h = Math.floor(up / 3600), mn = Math.floor((up % 3600) / 60), sec = up % 60;
    const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    await reply(`✦━━━━━━━━━━━━━━━━✦\n✅ *${config.BOT_NAME} — ONLINE*\n✦━━━━━━━━━━━━━━━━✦\n⏱️ *Uptime:* ${h}h ${mn}m ${sec}s\n💾 *RAM:* ${mem}MB\n👥 *Sessions:* ${activeSockets.size}\n📝 *Commands:* ${count}+\n🌐 *Mode:* ${isPublicMode() ? 'Public' : 'Private'}\n🤖 *AI:* ${isAiEnabled() ? 'ON' : 'OFF'}\n🎙️ *Voice:* ${isVoiceEnabled() ? 'ON' : 'OFF'}\n✦━━━━━━━━━━━━━━━━✦`);
    break;
}

// ─── PING ─────────────────────────────────────────────────────────────────────
case 'ping': {
    await react('📍');
    const t1 = Date.now();
    const pingMsg = await socket.sendMessage(from, { text: '⏳ *Pinging...*' }, { quoted: msg });
    const lat = Date.now() - t1;
    const qual = lat < 100 ? '🟢 Excellent' : lat < 300 ? '🟡 Good' : lat < 600 ? '🟠 Fair' : '🔴 Poor';
    await delay(400);
    await socket.sendMessage(from, {
        text: `✦━━━━━━━━━━━━━━━━✦\n🏓 *PONG!*\n✦━━━━━━━━━━━━━━━━✦\n⚡ *Speed:* ${lat}ms\n📊 *Quality:* ${qual}\n🕒 *Time:* ${new Date().toLocaleTimeString()}${WM}\n✦━━━━━━━━━━━━━━━━✦`,
        edit: pingMsg.key
    });
    break;
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
case 'settings': {
    if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!');
    await replyCarousel('⚙️ BOT SETTINGS', [
        { title: `🌐 Public Mode: ${isPublicMode() ? 'ON' : 'OFF'}`, description: 'Toggle who can use the bot', image: botImg, buttons: [{ display: '🌐 Mode ON', id: `${activePrefix}mode on` }, { display: '🔒 Mode OFF', id: `${activePrefix}mode off` }] },
        { title: `🤖 AI: ${isAiEnabled() ? 'ON' : 'OFF'}`, description: 'Toggle AI auto-reply for non-owners', image: botImg, buttons: [{ display: '🤖 AI ON', id: `${activePrefix}aion` }, { display: '🔇 AI OFF', id: `${activePrefix}aioff` }] },
        { title: `🎙️ Voice: ${isVoiceEnabled() ? 'ON' : 'OFF'}`, description: 'Toggle voice responses via TTS', image: botImg, buttons: [{ display: '🎙️ Voice ON', id: `${activePrefix}voiceon` }, { display: '🔇 Voice OFF', id: `${activePrefix}voiceoff` }] },
        { title: `🛡️ Antidelete: ${loadAD().enabled ? 'ON' : 'OFF'}`, description: 'Track and recover deleted messages', image: botImg, buttons: [{ display: '🛡️ Enable', id: `${activePrefix}antidelete on` }, { display: '⚠️ Disable', id: `${activePrefix}antidelete off` }] },
        { title: `🔑 Prefix: ${activePrefix}`, description: 'Change the bot command prefix', image: botImg, buttons: [{ display: '🔑 Change Prefix', id: `${activePrefix}prefix .` }] }
    ]);
    break;
}

// ─── MODE ─────────────────────────────────────────────────────────────────────
case 'mode': {
    if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!');
    const ma = args[0]?.toLowerCase();
    if (!ma || !['on', 'off', 'public', 'private'].includes(ma)) return reply(`🌐 *Public Mode:* ${isPublicMode() ? 'ON' : 'OFF'}\nUsage: ${activePrefix}mode on/off`);
    const nm = (ma === 'on' || ma === 'public'); setPublicMode(nm);
    await replyImg(botImg, `🌐 *Public Mode set to ${nm ? 'ON' : 'OFF'}*\n\n${nm ? 'Anyone can use the bot.' : 'Only owner can use the bot.'}`);
    break;
}

// ─── PREFIX ───────────────────────────────────────────────────────────────────
case 'prefix': case 'setprefix': {
    if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!');
    if (!args[0]) return reply(`Current prefix: \`${activePrefix}\`\nUsage: ${activePrefix}prefix <newprefix>`);
    setCustomPrefix(args[0]); await reply(`✅ Prefix changed to: \`${args[0]}\``);
    break;
}

// ─── AI TOGGLES ───────────────────────────────────────────────────────────────
case 'aion': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); setAiEnabled(true); await replyImg(botImg, '🤖 *AI Auto-reply is now ON*'); break; }
case 'aioff': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); setAiEnabled(false); await replyImg(botImg, '🔕 *AI Auto-reply is now OFF*'); break; }
case 'aitoggle': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); const ns = !isAiEnabled(); setAiEnabled(ns); await replyImg(botImg, ns ? '🤖 *AI is now ON*' : '🔕 *AI is now OFF*'); break; }
case 'voice': case 'voicestatus': { await reply(`🎙️ Voice: ${isVoiceEnabled() ? 'ON 🟢' : 'OFF 🔴'}\nUsage: ${activePrefix}voiceon / ${activePrefix}voiceoff`); break; }
case 'voiceon': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); setVoiceEnabled(true); await replyImg(botImg, '🎙️ *Voice Reply ON*'); break; }
case 'voiceoff': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); setVoiceEnabled(false); await replyImg(botImg, '🔇 *Voice Reply OFF*'); break; }
case 'autoread': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); const s = args[0]?.toLowerCase(); if (s === 'on') { setAutoRead(true); await reply('👁️ *AutoRead ON*'); } else if (s === 'off') { setAutoRead(false); await reply('👁️ *AutoRead OFF*'); } else await reply(`👁️ AutoRead: ${isAutoRead() ? 'ON' : 'OFF'}\nUsage: ${activePrefix}autoread on/off`); break; }
case 'autorecord': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); const s = args[0]?.toLowerCase(); if (s === 'on') { setAutoRecord(true); await reply('🎥 *AutoRecord ON*'); } else if (s === 'off') { setAutoRecord(false); await reply('🎥 *AutoRecord OFF*'); } else await reply(`🎥 AutoRecord: ${isAutoRecord() ? 'ON' : 'OFF'}\nUsage: ${activePrefix}autorecord on/off`); break; }
case 'autostatus': case 'autoview': {
    if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!');
    const cfg = getAutoStatus(), s = args[0]?.toLowerCase();
    if (!s) { await replyCarousel('📺 AUTO STATUS SETTINGS', [{ title: `Auto View: ${cfg.enabled ? '✅' : '⚠️'}`, description: `Reactions: ${cfg.reactOn ? '✅' : '⚠️'}\n\nUsage:\n.autostatus on/off\n.autostatus react on/off`, image: botImg, buttons: [{ display: cfg.enabled ? '⚠️ Disable' : '✅ Enable', id: `${activePrefix}autostatus ${cfg.enabled ? 'off' : 'on'}` }, { display: cfg.reactOn ? '💚 Reactions OFF' : '💚 Reactions ON', id: `${activePrefix}autostatus react ${cfg.reactOn ? 'off' : 'on'}` }] }]); break; }
    if (s === 'on') { cfg.enabled = true; setAutoStatus(cfg); await reply('✅ *Auto status view enabled!*'); }
    else if (s === 'off') { cfg.enabled = false; setAutoStatus(cfg); await reply('⚠️ *Auto status view disabled!*'); }
    else if (s === 'react') { const rv = args[1]?.toLowerCase() === 'on'; cfg.reactOn = rv; setAutoStatus(cfg); await reply(`${rv ? '💚' : '⚠️'} *Status reactions ${rv ? 'enabled' : 'disabled'}!*`); }
    break;
}
case 'antidelete': case 'antidel': {
    if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!');
    const s = args[0]?.toLowerCase();
    if (s === 'on') { saveAD({ enabled: true }); await reply('✅ *Antidelete enabled!*\n\n• Tracks all messages\n• Monitors deleted messages\n• Saves ViewOnce media\n• Reports deletions to owner'); }
    else if (s === 'off') { saveAD({ enabled: false }); await reply('⚠️ *Antidelete disabled!*'); }
    else { const cfg = loadAD(); await replyCarousel('🛡️ ANTIDELETE', [{ title: `Status: ${cfg.enabled ? '✅ Enabled' : '⚠️ Disabled'}`, description: 'Track deleted messages, save media, ViewOnce bypass', image: botImg, buttons: [{ display: cfg.enabled ? '⚠️ Disable' : '✅ Enable', id: `${activePrefix}antidelete ${cfg.enabled ? 'off' : 'on'}` }] }]); }
    break;
}

// ─── OWNER / DEV INFO ─────────────────────────────────────────────────────────
case 'owner': case 'dev': case 'developer': {
    await reply(`✦━━━━━━━━━━━━━━━━✦\n👑 *BOT OWNER*\n✦━━━━━━━━━━━━━━━━✦\n🏷️ *Name:* Nullforge\n📞 *Number:* +${DEVELOPER_NUMBER}\n✦━━━━━━━━━━━━━━━━✦`);
    break;
}

// ─── AI COMMANDS ──────────────────────────────────────────────────────────────
case 'ai': {
    await react('🤖');
    if (!q) return reply(`🤖 *${AI_SHORT_NAME}*\n\nJust type anything — I'll reply automatically!\n\nOr: ${activePrefix}ai <question>\n\nAI: ${isAiEnabled() ? '🟢 ON' : '🔴 OFF'} | Voice: ${isVoiceEnabled() ? '🎙️ ON' : '🔇 OFF'}`);
    try { const a = await askGrok(q); if (a) await replyWithVoice(a, botImg); else reply('⚠️ AI unavailable right now.'); }
    catch (e) { reply(`⚠️ AI error: ${e.message}`); }
    break;
}
case 'gpt4': {
    await react('🧠'); if (!q) return reply(`Usage: ${activePrefix}gpt4 <question>`);
    try {
        let result = null;
        try { const d = await PAXSENIX.post('/ai/gpt-4o', { message: q }); result = d?.result || d?.response || d?.message; } catch {}
        if (!result) { try { const { data } = await axios.get(`https://api.dreaded.site/api/chatgpt4?text=${encodeURIComponent(q)}`, { timeout: 30000 }); result = data?.result || data?.response; } catch {} }
        if (!result) { try { const { data } = await axios.get(`https://api.giftedtech.co.ke/api/ai/geminiaipro?apikey=gifted&q=${encodeURIComponent(q)}`, { timeout: 15000 }); result = data?.result; } catch {} }
        if (result) await replyImg(botImg, `🧠 *GPT-4o:*\n\n${result}`);
        else reply('⚠️ GPT-4 unavailable right now. Try .ai command.');
    } catch (e) { reply(`⚠️ Error: ${e.message}`); }
    break;
}
case 'gemini': {
    await react('💎'); if (!q) return reply(`Usage: ${activePrefix}gemini <question>`);
    try {
        let result = null;
        try { const d = await PAXSENIX.post('/ai/gemini-2.0-flash', { message: q }); result = d?.result || d?.response; } catch {}
        if (!result) { try { const { data } = await axios.get(`https://api.dreaded.site/api/gemini?text=${encodeURIComponent(q)}`, { timeout: 30000 }); result = data?.result || data?.response; } catch {} }
        if (!result) { try { const { data } = await axios.get(`https://api.giftedtech.co.ke/api/ai/geminiaipro?apikey=gifted&q=${encodeURIComponent(q)}`, { timeout: 15000 }); result = data?.result; } catch {} }
        if (result) await replyImg(botImg, `💎 *Gemini 2.0 Flash:*\n\n${result}`);
        else reply('⚠️ Gemini unavailable right now. Try .ai command.');
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}
case 'llama': {
    await react('🦙'); if (!q) return reply(`Usage: ${activePrefix}llama <q>`);
    try {
        let result = null;
        try { const { data } = await axios.get(`${config.NEXRAY_API}/ai/llamacoder?model=qwen3-coder&prompt=${encodeURIComponent(q)}`, { timeout: 30000 }); result = data?.result || data?.response; } catch {}
        if (!result) { try { const d = await PAXSENIX.post('/ai/llama-3.1-8b', { message: q }); result = d?.result || d?.response; } catch {} }
        if (result) await replyImg(botImg, `🦙 *LLaMA:*\n\n${result}`);
        else reply('⚠️ LLaMA unavailable. Try .ai command.');
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}
case 'deepseek': {
    await react('🧬'); if (!q) return reply(`Usage: ${activePrefix}deepseek <q>`);
    try {
        let result = null;
        try { const d = await PAXSENIX.post('/ai/deepseek-v3', { message: q }); result = d?.result || d?.response; } catch {}
        if (!result) { try { const { data } = await axios.get(`https://api.dreaded.site/api/deepseek?text=${encodeURIComponent(q)}`, { timeout: 30000 }); result = data?.result || data?.response; } catch {} }
        if (!result) { try { const { data } = await axios.get(`https://api.siputzx.my.id/api/ai/deepseek?text=${encodeURIComponent(q)}`, { timeout: 20000 }); result = data?.result; } catch {} }
        if (result) await replyImg(botImg, `🧬 *DeepSeek V3:*\n\n${result}`);
        else reply('⚠️ DeepSeek unavailable. Try .ai command.');
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}
case 'mathgpt': { await react('🔢'); if (!q) return reply(`Usage: ${activePrefix}mathgpt <math>`); try { const { data } = await axios.get(`${config.ELITE_API}/mathgpt?question=${encodeURIComponent(q)}`, { timeout: 30000 }); const t = data?.result || data?.answer; if (t) await replyImg(botImg, `🔢 *MathGPT:*\n\n${t}`); else reply('⚠️ Unavailable.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'aicode': {
    await react('💻'); if (!q) return reply(`Usage: ${activePrefix}aicode <code question>`);
    try {
        let result = null;
        try { const d = await PAXSENIX.post('/ai/gpt-4o', { message: `Write code for: ${q}. Respond with clean, commented code.` }); result = d?.result || d?.response; } catch {}
        if (!result) { try { const { data } = await axios.get(`https://api.siputzx.my.id/api/ai/codegpt?prompt=${encodeURIComponent(q)}`, { timeout: 30000 }); result = data?.result || data?.response; } catch {} }
        if (result) await replyImg(botImg, `💻 *AI Code:*\n\n${result}`);
        else reply('⚠️ Code AI unavailable. Try .ai command.');
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}
case 'textdetect': { await react('🤖'); if (!q) return reply(`Usage: ${activePrefix}textdetect <text>`); try { const { data } = await axios.get(`${config.DAVID_API}/tools/aitextdetector?text=${encodeURIComponent(q)}`, { timeout: 30000 }); await replyImg(botImg, `🤖 *AI Text Detector:*\n\n${data?.result || JSON.stringify(data)}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }

// ─── IMAGE GENERATION ─────────────────────────────────────────────────────────
case 'imagine': case 'flux': case 'aiimg': case 'dalle': {
    await react('🎨'); if (!q) return reply(`Usage: ${activePrefix}${command} <prompt>`);
    try { const buf = await generateImage(q); await socket.sendMessage(from, { image: buf, caption: `🎨 *AI Image*\nPrompt: ${q}${WM}` }, { quoted: fakeCard }); }
    catch (e) { reply(`⚠️ Image generation failed: ${e.message}`); }
    break;
}
case 'gptimage': {
    await react('📸'); if (!q) return reply(`Usage: ${activePrefix}gptimage <prompt>`);
    try {
        let imgUrl = null;
        try { const { data } = await axios.get(`${config.NEXRAY_EU}/ai/gptimage?param=${encodeURIComponent(q)}`, { timeout: 60000 }); imgUrl = data?.result || data?.imageUrl || data?.url; } catch {}
        if (!imgUrl) { try { const { data } = await axios.post(`${config.NEXRAY_EU}/ai/v1/text2image`, { prompt: q }, { timeout: 60000 }); imgUrl = data?.result || data?.imageUrl || data?.url; } catch {} }
        if (!imgUrl) { try { const { data } = await axios.get(`${config.NEXRAY_API}/ai/gptimage?prompt=${encodeURIComponent(q)}`, { timeout: 60000 }); imgUrl = data?.result || data?.imageUrl; } catch {} }
        if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) { await replyImg(imgUrl, `📸 *GPT Image*\nPrompt: ${q}`); }
        else { const buf = await generateImage(q); await socket.sendMessage(from, { image: buf, caption: `📸 *Image*\nPrompt: ${q}${WM}` }, { quoted: fakeCard }); }
    } catch (e) { reply(`⚠️ Error: ${e.message}`); }
    break;
}
case 'nanobanana': {
    await react('⚡');
    const qImgNb = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
    const hasImgNb = qImgNb?.imageMessage || msg.message?.imageMessage;
    if (!hasImgNb && !q) return reply(`Usage: ${activePrefix}nanobanana <prompt>\n_or reply to an image_`);
    try {
        let imgUrl = null;
        if (hasImgNb) { const imgObj = qImgNb?.imageMessage || msg.message.imageMessage; const s = await downloadContentFromMessage(imgObj, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); imgUrl = await uploadSmartMedia(b, 'image/jpeg'); }
        const prompt2 = q || 'enhance and improve this image';
        let result = null;
        try { const { data } = await axios.post(`${config.NEXRAY_EU}/ai/nanobanana`, { imageUrl: imgUrl || '', prompt: prompt2 }, { timeout: 60000 }); result = data?.result?.image || data?.imageUrl || data?.url; } catch {}
        if (!result) { try { const { data } = await axios.get(`${config.DAVID_API}/tools/nanobanana?imageUrl=${encodeURIComponent(imgUrl || '')}&prompt=${encodeURIComponent(prompt2)}`, { timeout: 60000 }); result = data?.result?.image || data?.imageUrl; } catch {} }
        if (result) await replyImg(result, `⚡ *Nano Banana:*\n${prompt2}`);
        else reply('⚠️ Failed.');
    } catch (e) { reply(`⚠️ Error: ${e.message}`); }
    break;
}
case 'sologo': { await react('🎨'); if (!q) return reply(`Usage: ${activePrefix}sologo <prompt>`); try { const { data } = await axios.get(`${config.NEXRAY_API}/ai/sologo?prompt=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 60000 }); await socket.sendMessage(from, { image: Buffer.from(data), caption: `🎨 *AI Logo*\nPrompt: ${q}${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'stablesd': { await react('🎨'); if (!q) return reply(`Usage: ${activePrefix}stablesd <prompt>`); try { const { data } = await axios.get(`${config.DAVID_API}/tools/stablediffusion?prompt=${encodeURIComponent(q)}`, { timeout: 60000 }); const imgUrl = data?.result?.image || data?.imageUrl; if (imgUrl) await replyImg(imgUrl, `🎨 *Stable Diffusion*\nPrompt: ${q}`); else reply('⚠️ Failed.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'veo': { await react('🎥'); if (!q) return reply(`Usage: ${activePrefix}veo <prompt>`); try { await reply(`🎥 *Generating AI video...*`); const d = await paxVeo(q); if (d?.video_url || d?.url) await socket.sendMessage(from, { video: { url: d.video_url || d.url }, caption: `🎥 *VEO Video*\nPrompt: ${q}${WM}` }, { quoted: fakeCard }); else await reply('⚠️ Video generation failed. Try again.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'txt2vid': case 'txt2video': {
    await react('🎥'); if (!q) return reply(`Usage: ${activePrefix}txt2vid <prompt>`);
    await reply(`🎥 *Generating AI video...*\nPrompt: _${q}_\n⏳ This may take 30-60 seconds...`);
    try {
        let vidUrl = null;
        // Primary: Paxsenix VEO (reliable with API key)
        try { const d = await PAXSENIX.post('/ai-video/veo-3.1', { prompt: q }); vidUrl = d?.video_url || d?.url || d?.result?.video_url; } catch {}
        // Fallback: Paxsenix VEO 2
        if (!vidUrl) { try { const d = await PAXSENIX.post('/ai-video/veo-2', { prompt: q }); vidUrl = d?.video_url || d?.url; } catch {} }
        // Fallback: OKATSU
        if (!vidUrl) { try { const { data } = await axios.get(`${config.OKATSU_API}/ai/txt2video?text=${encodeURIComponent(q)}`, { timeout: 60000 }); vidUrl = data?.videoUrl || data?.result; } catch {} }
        if (!vidUrl) return reply('⚠️ Video generation failed. All services are busy. Try again later.');
        await socket.sendMessage(from, { video: { url: vidUrl }, caption: `🎥 *AI Video Generated!*\nPrompt: ${q}${WM}` }, { quoted: fakeCard });
        await react('✅');
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}
case 'suno': {
    await react('🎵'); if (!q) return reply(`Usage: ${activePrefix}suno <title>|<style>|<prompt>`);
    try { const parts = q.split('|').map(s => s.trim()); const title = parts[0] || q, style = parts[1] || 'pop', prompt = parts[2] || q; await reply(`🎵 Generating: "${title}"...`); const d = await PAXSENIX.post('/ai-music/suno-music/v3', { customMode: true, instrumental: false, title, style, prompt, model: 'V3_5' }); if (d?.audio_url || d?.url) await socket.sendMessage(from, { audio: { url: d.audio_url || d.url }, mimetype: 'audio/mpeg', caption: `🎵 *${title}*\nStyle: ${style}${WM}` }, { quoted: fakeCard }); else await reply('⚠️ Suno generation failed.'); }
    catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}
case 'txt2img': {
    if (!q) return reply(`Usage: ${activePrefix}txt2img <prompt> | <style>`);
    await react('🎨');
    const [p, s] = (q || '').split('|').map(x => x.trim());
    const finalStyle = ['photorealistic', 'digital-art', 'anime', 'fantasy', 'sci-fi', 'vintage'].includes(s) ? s : 'anime';
    try {
        let imgUrl = null;
        try { const { data } = await axios.post(`${config.NEXRAY_EU}/ai/v1/text2image`, { prompt: p || q, style: finalStyle }, { timeout: 60000 }); imgUrl = data?.result || data?.imageUrl || data?.url; } catch {}
        if (!imgUrl) { try { const { data } = await axios.get(`https://api.neoxr.eu/api/txt2img?prompt=${encodeURIComponent(p || q)}&style=${finalStyle}&apikey=Milik-Bot-OurinMD`, { timeout: 60000 }); if (data?.status && data?.data?.length) imgUrl = data.data[0].url; } catch {} }
        if (!imgUrl) { const buf = await generateImage(p || q); await socket.sendMessage(from, { image: buf, caption: `🎨 *Generated*\nPrompt: ${p || q}\nStyle: ${finalStyle}${WM}` }, { quoted: fakeCard }); break; }
        await socket.sendMessage(from, { image: { url: imgUrl }, caption: `🎨 *Generated*\nPrompt: ${p || q}\nStyle: ${finalStyle}${WM}` }, { quoted: fakeCard }); await react('✅');
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── SONG / PLAY — REPLACED WITH NEW MULTI-FALLBACK ENGINE ───────────────────
case 'play':
case 'ytmp3':
case 'song':
case 'yta': {
    if (!q) {
        await reply(`🎵 *${AI_SHORT_NAME} Play*\n\nUsage: ${activePrefix}play [song name]\nExample: ${activePrefix}play faded`);
        return;
    }

    try {
        await react('🎧');
        await reply(`⏳ *${AI_SHORT_NAME} Play*\n\nSearching: ${q}\nGive me a moment...`);

        // ---- PRIMARY API (David Cyril) ----
        let success = false;
        try {
            const response = await axios.get(`https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(q)}&apikey=`, {
                timeout: 60000
            });

            const data = response.data;
            if (data.status && data.result?.download_url) {
                await reply(`🎵 *${AI_SHORT_NAME} Play*\n\nTitle: ${data.result.title || 'N/A'}\nDuration: ${data.result.duration || 'N/A'}\nViews: ${data.result.views?.toLocaleString() || 'N/A'}\n\nDownloading audio...`);

                const audioResponse = await axios.get(data.result.download_url, {
                    responseType: 'arraybuffer',
                    timeout: 120000
                });

                const audioBuffer = Buffer.from(audioResponse.data);
                const convertedBuffer = await formatAudio(audioBuffer);

                await socket.sendMessage(from, {
                    audio: convertedBuffer,
                    mimetype: "audio/mpeg",
                    fileName: `${data.result.title}.mp3`,
                    caption: `🎵 *${data.result.title}*\n👁️ ${data.result.views?.toLocaleString() || 'N/A'} views • ⏱️ ${data.result.duration || 'N/A'}${WM}`,
                    contextInfo: {
                        externalAdReply: {
                            thumbnailUrl: data.result.thumbnail,
                            title: data.result.title,
                            body: `👁️ ${data.result.views?.toLocaleString() || 'N/A'} views • ⏱️ ${data.result.duration || 'N/A'}`,
                            sourceUrl: data.result.video_url,
                            renderLargerThumbnail: true,
                            mediaType: 1
                        }
                    }
                }, { quoted: msg });

                await react('✅');
                success = true;
            } else {
                throw new Error('No download URL from David Cyril');
            }
        } catch (primaryError) {
            console.error('[PLAY] Primary API failed, using fallback:', primaryError.message);
            // Fallback to multi-endpoint system
            try {
                let videoUrl = q;
                let videoTitle = "YouTube Audio";
                let videoTimestamp = "";

                if (!q.includes('youtube.com') && !q.includes('youtu.be')) {
                    const searchResponse = await yts(q);
                    if (!searchResponse.videos || searchResponse.videos.length === 0) {
                        throw new Error('No results found');
                    }
                    const video = searchResponse.videos[0];
                    videoUrl = video.url;
                    videoTitle = video.title;
                    videoTimestamp = video.timestamp || "Unknown";
                }

                await reply(`🔥 Fallback: found "${videoTitle.substring(0, 50)}", downloading...`);
                await socket.sendPresenceUpdate('recording', from);

                const result = await queryGiftedAPI(videoUrl, audioEndpoints, 30000);
                if (!result.success || !result.download_url) throw new Error('All fallback APIs failed');

                let buffer = await ossBuffer(result.download_url);
                if (!isValidBuffer(buffer)) {
                    const remaining = audioEndpoints.filter(e => e !== result.endpoint);
                    const retry = await queryGiftedAPI(videoUrl, remaining, 30000);
                    if (retry.success && retry.download_url) buffer = await ossBuffer(retry.download_url);
                }
                if (!isValidBuffer(buffer)) throw new Error('Invalid audio buffer');

                const convertedBuffer = await formatAudio(buffer);
                if (convertedBuffer.length <= 16 * 1024 * 1024) {
                    await socket.sendMessage(from, {
                        audio: convertedBuffer,
                        mimetype: "audio/mpeg",
                        caption: `🎵 *${videoTitle.substring(0, 80)}*\n⏱️ *Duration:* ${videoTimestamp}\n\n> ${AI_SHORT_NAME} — Wild Lirt Studio`
                    }, { quoted: msg });
                } else {
                    await socket.sendMessage(from, {
                        document: convertedBuffer,
                        mimetype: "audio/mpeg",
                        fileName: `${videoTitle.replace(/[^\w\s.-]/gi, '').substring(0, 50)}.mp3`,
                        caption: `🎵 *${videoTitle.substring(0, 80)}*\n\n_File too large - sent as document_`
                    }, { quoted: msg });
                }
                await react('✅');
                success = true;
            } catch (fallbackError) {
                console.error('[PLAY] Fallback also failed:', fallbackError.message);
                throw new Error('All download methods failed');
            }
        }

        if (!success) throw new Error('Could not complete download');

        // Optional: send a "Download Again" button
        await sendButtons(socket, from, {
            title: "✅ AUDIO READY",
            text: `🎵 *${q}* has been sent!`,
            footer: "Play again?",
            buttons: [
                { text: "🔄 Download Again", id: `${activePrefix}play ${q}` }
            ]
        });

    } catch (error) {
        console.error('[PLAY ERROR]', error.message);
        await react('⚠️');
        await reply(`⚠️ *${AI_SHORT_NAME} Play*\n\nMusic service is napping. Try again in a moment.\n\nError: ${error.message.substring(0, 100)}`);
    }
    break;
}
// ─── VIDEO ────────────────────────────────────────────────────────────────────
case 'video': case 'ytmp4': {
    if (!q) return reply(`❗ Usage: ${activePrefix}video <youtube url or search>`);
    await react('🎬');
    try {
        let videoUrl = q;
        if (!/youtu/.test(q)) { const vi = await ytGetInfo(q); if (!vi) return reply('⚠️ No video found.'); videoUrl = vi.url || `https://www.youtube.com/watch?v=${vi.id}`; }
        await reply('⬇️ Downloading video...');
        const dlUrl = await ytDownloadMp4(videoUrl);
        if (!dlUrl) return reply('⚠️ All video download services failed.');
        await socket.sendMessage(from, { video: { url: dlUrl }, mimetype: 'video/mp4', caption: `🎬 Video downloaded${WM}` }, { quoted: fakeCard }); await react('✅');
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── LYRICS — ENHANCED WITH LRCLIB FALLBACK ───────────────────────────────────
case 'lyrics': case 'lyric': case 'lirik': {
    if (!q) return reply(`❗ Usage: ${activePrefix}lyrics <song name>\n\n📌 Example: ${activePrefix}lyrics Shape of You`);
    await react('🎶');
    try {
        // Try lrclib for rich metadata first
        let lyricsText = null, trackTitle = q, artistName = '';
        try {
            const { data: lrcData } = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, { timeout: 15000 });
            if (lrcData?.[0]) {
                const r = lrcData[0];
                trackTitle = r.trackName || q;
                artistName = r.artistName || '';
                lyricsText = r.plainLyrics || r.syncedLyrics?.replace(/\[\d+:\d+\.\d+\]/g, '').trim();
            }
        } catch {}

        // Fallback to other engines
        if (!lyricsText) lyricsText = await getLyrics(q);

        if (lyricsText) {
            const header = artistName
                ? `🎶 *${trackTitle}*\n🎤 *Artist:* ${artistName}\n\n`
                : `🎶 *Lyrics: ${q}*\n\n`;
            await reply(`${header}${lyricsText.substring(0, 3500)}`);
        } else {
            await reply(`⚠️ Lyrics not found for *${q}*\n\n_Try a more specific title._`);
        }
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── AIO DOWNLOADER ───────────────────────────────────────────────────────────
case 'aio': case 'alldown': {
    if (!q) return reply(`❗ Usage: ${activePrefix}aio <url>\n\nSupports: YouTube, TikTok, Instagram, Facebook, Twitter, and more!`);
    await react('⬇️'); await reply(`⬇️ Downloading from: ${q.substring(0, 60)}...`);
    try {
        const result = await aioDownload(q);
        if (!result) return reply('⚠️ Could not download from that URL.');
        const video = result.video || result.mp4 || result.download_url;
        const audio = result.audio || result.mp3;
        const image = result.image || result.photo || result.thumbnail;
        const title = result.title || result.name || 'Downloaded file';
        if (video) { await socket.sendMessage(from, { video: { url: video }, mimetype: 'video/mp4', caption: `⬇️ *${title}*${WM}` }, { quoted: fakeCard }); }
        else if (audio) { await socket.sendMessage(from, { audio: { url: audio }, mimetype: 'audio/mpeg', ptt: false }, { quoted: fakeCard }); }
        else if (image) { await replyImg(image, `⬇️ *${title}*`); }
        else reply('⚠️ No downloadable media found in that URL.');
        await react('✅');
    } catch (e) { reply(`⚠️ AIO download failed: ${e.message}`); }
    break;
}

// ─── FACEBOOK ─────────────────────────────────────────────────────────────────
case 'fb': case 'facebook': {
    if (!q) return reply(`❗ Usage: ${activePrefix}fb <url>`);
    await react('📘');
    try {
        let vidUrl = null;
        for (const fn of [
            async () => { const { data } = await axios.get(`${config.NAYAN_API}/alldown?url=${encodeURIComponent(q)}`, { timeout: 30000 }); return data?.result?.video || data?.video; },
            async () => { const { data } = await axios.get(`${config.ELITE_API}/facebook?url=${encodeURIComponent(q)}`, { timeout: 30000 }); return data?.result?.download_url || data?.hd_video || data?.sd_video; },
            async () => { const { data } = await axios.get(`https://suhas-bro-api.vercel.app/download/fbdown?url=${encodeURIComponent(q)}`); return data?.result?.sd || data?.result?.hd; }
        ]) { try { const r = await fn(); if (r) { vidUrl = r; break; } } catch {} }
        if (!vidUrl) return reply('⚠️ Failed to fetch Facebook video.');
        await socket.sendMessage(from, { video: { url: vidUrl }, mimetype: 'video/mp4', caption: `📘 Facebook Video${WM}` }, { quoted: fakeCard }); await react('✅');
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── TIKTOK ───────────────────────────────────────────────────────────────────
case 'tiktok': case 'ttdl': {
    if (!q) return reply(`❗ Usage: ${activePrefix}tiktok <url>`);
    await react('🎵');
    try {
        let vidUrl = null, titleT = '', coverUrl = null;
        for (const fn of [
            async () => { const { data } = await axios.get(`${config.PREXZY_API}/download/tiktokvideo?url=${encodeURIComponent(q)}`, { timeout: 30000 }); if (data?.result?.video) { vidUrl = data.result.video; titleT = data.result.title || ''; coverUrl = data.result.cover; return true; } },
            async () => { const { data } = await axios.get(`${config.GIFTED_TECH_API}/api/download/tiktok?apikey=${config.GIFTED_API_KEY}&url=${encodeURIComponent(q)}`, { timeout: 30000 }); if (data?.success && data?.result?.video) { vidUrl = data.result.video; titleT = data.result.title || ''; coverUrl = data.result.cover; return true; } },
            async () => { const { data } = await axios.get(`${config.NAYAN_API}/alldown?url=${encodeURIComponent(q)}`, { timeout: 30000 }); if (data?.result?.video) { vidUrl = data.result.video; return true; } }
        ]) { try { const r = await fn(); if (r) break; } catch {} }
        if (!vidUrl) return reply('⚠️ Failed to fetch TikTok video.');
        if (coverUrl) await socket.sendMessage(from, { image: { url: coverUrl }, caption: `🎵 *TikTok*\n${titleT}${WM}` }, { quoted: fakeCard });
        await socket.sendMessage(from, { video: { url: vidUrl }, mimetype: 'video/mp4', caption: `🎥 TikTok Video${WM}` }, { quoted: fakeCard }); await react('✅');
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── INSTAGRAM ────────────────────────────────────────────────────────────────
case 'ig': case 'insta': {
    if (!q) return reply(`❗ Usage: ${activePrefix}ig <instagram url>`);
    await react('📸');
    try {
        let vidUrl = null;
        for (const fn of [
            async () => { const { data } = await axios.get(`${config.NAYAN_API}/instagram?url=${encodeURIComponent(q)}`, { timeout: 30000 }); return data?.result?.download_url || data?.url || data?.video; },
            async () => { const { data } = await axios.get(`${config.GIFTED_TECH_API}/api/download/instadl?apikey=${config.GIFTED_API_KEY}&url=${encodeURIComponent(q)}`, { timeout: 30000 }); return data?.result?.download_url; },
            async () => { const { data } = await axios.get(`${config.PREXZY_API}/download/aio?url=${encodeURIComponent(q)}`, { timeout: 30000 }); return data?.result?.video || data?.video; },
            async () => { const { igdl } = require('ruhend-scraper'); const res = await igdl(q); return res.data?.[0]?.url; }
        ]) { try { const r = await fn(); if (r) { vidUrl = r; break; } } catch {} }
        if (!vidUrl) return reply('⚠️ Failed to fetch Instagram content.');
        await socket.sendMessage(from, { video: { url: vidUrl }, mimetype: 'video/mp4', caption: `📸 Instagram Video${WM}` }, { quoted: fakeCard }); await react('✅');
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── TWITTER ──────────────────────────────────────────────────────────────────
case 'twitter': case 'x': case 'twdl': {
    if (!q) return reply(`❗ Usage: ${activePrefix}twitter <url>`);
    await react('🐦');
    try {
        let vidUrl = null;
        for (const fn of [
            async () => { const { data } = await axios.get(`${config.NAYAN_API}/alldown?url=${encodeURIComponent(q)}`, { timeout: 30000 }); return data?.result?.video || data?.video; },
            async () => { const { data } = await axios.get(`${config.DAVID_API}/download/twitter?url=${encodeURIComponent(q)}`, { timeout: 30000 }); return data?.result?.videoUrls?.[0]?.url || data?.result?.download_url; },
            async () => { const { data } = await axios.get(`${config.GIFTED_TECH_API}/api/download/twitter?apikey=${config.GIFTED_API_KEY}&url=${encodeURIComponent(q)}`, { timeout: 30000 }); return data?.result?.videoUrls?.[0]?.url; }
        ]) { try { const r = await fn(); if (r) { vidUrl = r; break; } } catch {} }
        if (!vidUrl) return reply('⚠️ No video found.');
        await socket.sendMessage(from, { video: { url: vidUrl }, mimetype: 'video/mp4', caption: `🐦 Twitter Video${WM}` }, { quoted: fakeCard }); await react('✅');
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── MEDIAFIRE — ENHANCED ─────────────────────────────────────────────────────
case 'mediafire': case 'mfdl': {
    if (!q) return reply(`❗ Usage: ${activePrefix}mediafire <url>`);
    await react('☁️');
    try {
        const result = await mediafireDl(q);
        if (!result?.link) return reply('⚠️ Failed to fetch MediaFire download link.');

        const fileName = result.name || 'file';
        const fileSize = result.size || 'Unknown';
        const fileExt = (fileName.split('.').pop() || 'bin').toLowerCase();

        await reply(`📁 *${fileName}*\n📦 *Size:* ${fileSize}\n⬇️ _Downloading..._`);

        // Try to send as document — works for most file types
        await socket.sendMessage(from, {
            document: { url: result.link },
            fileName: fileName,
            mimetype: result.mimetype || 'application/octet-stream',
            caption: `☁️ *MediaFire*\n📁 ${fileName}\n📦 ${fileSize}${WM}`
        }, { quoted: fakeCard });

        await react('✅');
    } catch (e) { reply(`⚠️ MediaFire error: ${e.message}`); }
    break;
}

// ─── APK ──────────────────────────────────────────────────────────────────────
case 'apk': {
    if (!q) return reply(`❗ Usage: ${activePrefix}apk <app name>\n\nExample: ${activePrefix}apk ha tunnel`);
    await react('📦');
    await reply(`✦━━━━━━━━━━━━━━━━✦\n🔎 *Searching APK:* ${q}\n✦━━━━━━━━━━━━━━━━✦`);
    try {
        let results = [];
        // Search using multiple APIs
        try { const { data } = await axios.get(`${config.DISCARD_API}/api/apk/search?apikey=guru&q=${encodeURIComponent(q)}`, { timeout: 15000 }); if (data?.result?.length) results = data.result.slice(0, 5); } catch {}
        if (!results.length) { try { const r = await fetch(`https://api.nexoracle.com/downloader/apk?q=${encodeURIComponent(q)}&apikey=free_key@maher_apis`); const d = await r.json(); if (d?.status === 200 && d?.result) results = [{ judul: d.result.name, dev: d.result.package, rating: d.result.rating || 'N/A', link: d.result.dllink, thumb: d.result.icon }]; } catch {} }
        if (!results.length) { try { const { data } = await axios.get(`${config.QASIM_API}/api/apkpure/search?q=${encodeURIComponent(q)}`, { timeout: 15000 }); if (data?.result?.length) results = data.result.slice(0, 3); } catch {} }
        if (!results.length) return reply('⚠️ No APKs found for: ' + q);

        // Take first result and send details + image
        const top = results[0];
        const appName = (top.judul || top.name || q).substring(0, 60);
        const appDev = top.dev || top.developer || 'N/A';
        const appRating = top.rating || 'N/A';
        const appThumb = top.thumb || top.icon || botImg;

        // Send app details with image
        await socket.sendMessage(from, {
            image: { url: appThumb },
            caption: `✦━━━━━━━━━━━━━━━━✦\n📦 *${appName}*\n✦━━━━━━━━━━━━━━━━✦\n👨‍💻 *Dev:* ${appDev}\n⭐ *Rating:* ${appRating}\n\n⬇️ _Downloading APK file..._${WM}\n✦━━━━━━━━━━━━━━━━✦`
        }, { quoted: fakeCard });

        // Download and send APK
        try {
            let apkUrl = null, apkName = appName, apkSize = 'N/A', apkReq = 'N/A';
            // Try DISCARD API download
            try {
                const dlUrl = `${config.DISCARD_API}/api/apk/dl/android1?apikey=guru&url=${encodeURIComponent(top.link || top.url || '')}`;
                const { data: dlRes } = await axios.get(dlUrl, { timeout: 60000 });
                const apk = dlRes?.result;
                if (apk?.url) { apkUrl = apk.url; apkName = apk.name || appName; apkSize = apk.size || 'N/A'; apkReq = apk.requirement || 'N/A'; }
            } catch {}
            // Fallback: use top.link directly
            if (!apkUrl && (top.link || top.dllink || top.url)) apkUrl = top.link || top.dllink || top.url;
            if (!apkUrl) throw new Error('No APK URL found');
            const safeName = apkName.replace(/[^\w.-]/g, '_');
            await socket.sendMessage(from, {
                document: { url: apkUrl },
                fileName: `${safeName}.apk`,
                mimetype: 'application/vnd.android.package-archive',
                caption: `✦━━━━━━━━━━━━━━━━✦\n✅ *${apkName}*\n✦━━━━━━━━━━━━━━━━✦\n📦 *Size:* ${apkSize}\n📱 *Requires:* ${apkReq}${WM}\n✦━━━━━━━━━━━━━━━━✦`
            }, { quoted: fakeCard });
            await react('✅');
        } catch (e) { await reply(`⚠️ APK download failed: ${e.message}\nTry a more specific app name.`); }
    } catch (e) { reply(`⚠️ APK error: ${e.message}`); }
    break;
}

// ─── WEBP TO MP4 ──────────────────────────────────────────────────────────────
case 'webp2mp4': case 'webptomp4': {
    await react('🎞️');
    const stickerMsgW = msg.quoted?.message?.stickerMessage || msg.message?.stickerMessage;
    if (!stickerMsgW) return reply('⚠️ Reply to a sticker to convert it to MP4.');
    try {
        const s = await downloadContentFromMessage(stickerMsgW, 'sticker'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]);
        const tmpWebp = path.join(os.tmpdir(), `sticker_${Date.now()}.webp`); fs.writeFileSync(tmpWebp, b);
        await reply('⏳ Converting WebP to MP4...');
        const result = await webp2mp4File(tmpWebp);
        try { fs.unlinkSync(tmpWebp); } catch {}
        if (result?.result) { await socket.sendMessage(from, { video: { url: result.result }, mimetype: 'video/mp4', caption: `🎞️ *WebP → MP4*${WM}` }, { quoted: fakeCard }); await react('✅'); }
        else reply('⚠️ Conversion failed.');
    } catch (e) { reply(`⚠️ WebP→MP4 error: ${e.message}`); }
    break;
}

// ─── STICKER TO IMAGE — NEW (adapted from example toimg handler) ──────────────
case 'toimg': case 'stickertoimg': case 'sticker2img': {
    await react('🖼️');
    // Check for quoted sticker or image
    const qMsgToImg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
    const stickerMsgTI = qMsgToImg?.stickerMessage || msg.message?.stickerMessage;
    const imageMsgTI = qMsgToImg?.imageMessage || msg.message?.imageMessage;

    if (!stickerMsgTI && !imageMsgTI) {
        return reply('⚠️ Reply to a sticker (WebP) or image to convert it to PNG.\n\nUsage: Reply to sticker/image and send ' + activePrefix + 'toimg');
    }

    try {
        let mediaBuffer = Buffer.from([]);

        if (stickerMsgTI) {
            // Download sticker
            const stream = await downloadContentFromMessage(stickerMsgTI, 'sticker');
            for await (const chunk of stream) mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
        } else {
            // Download image
            const stream = await downloadContentFromMessage(imageMsgTI, 'image');
            for await (const chunk of stream) mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
        }

        if (!mediaBuffer || mediaBuffer.length === 0) return reply('⚠️ Failed to download media.');

        await reply('⏳ *Converting to PNG...*');

        // Convert using sharp (if available)
        let pngBuffer = null;
        if (sharp) {
            try {
                pngBuffer = await sharp(mediaBuffer)
                    .toFormat('png')
                    .png({ quality: 100, compressionLevel: 9 })
                    .toBuffer();
            } catch (sharpErr) {
                console.error('[TOIMG sharp]', sharpErr.message);
            }
        }

        // If sharp failed or unavailable, try ezgif webp2png via webp2mp4File approach
        if (!pngBuffer || pngBuffer.length === 0) {
            // Fallback: upload to catbox and use an online converter
            try {
                const webpUrl = await uploadToCatbox(mediaBuffer, 'image/webp');
                const { data: convData } = await axios.get(
                    `https://api.siputzx.my.id/api/tools/webp2png?url=${encodeURIComponent(webpUrl)}`,
                    { responseType: 'arraybuffer', timeout: 30000 }
                );
                pngBuffer = Buffer.from(convData);
            } catch {}
        }

        if (!pngBuffer || pngBuffer.length === 0) {
            return reply('⚠️ Conversion failed. Make sure sharp is installed (`npm install sharp`) or try again.');
        }

        await socket.sendMessage(from, {
            image: pngBuffer,
            caption: `🖼️ *Converted to PNG!*${WM}`
        }, { quoted: fakeCard });

        await react('✅');
    } catch (e) {
        console.error('[TOIMG]', e.message);
        reply(`⚠️ Conversion error: ${e.message}`);
    }
    break;
}

// ─── TELEGRAPH UPLOAD ─────────────────────────────────────────────────────────
case 'telegraph': case 'tph': {
    await react('📤');
    const quotedImgTph = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
    if (!quotedImgTph?.imageMessage && !msg.message?.imageMessage) return reply('❗ Reply to an image to upload to Telegraph.');
    try {
        const imgObj = quotedImgTph?.imageMessage || msg.message.imageMessage;
        const s = await downloadContentFromMessage(imgObj, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]);
        const ext = await fromBuffer(b).catch(() => ({ ext: 'jpg' }));
        const tmp = path.join(os.tmpdir(), `tph_${Date.now()}.${ext?.ext || 'jpg'}`); fs.writeFileSync(tmp, b);
        const url = await TelegraPh(tmp);
        try { fs.unlinkSync(tmp); } catch {}
        await reply(`📤 *Telegraph Upload:*\n\n🔗 ${url}`); await react('✅');
    } catch (e) { reply(`⚠️ Telegraph upload failed: ${e.message}`); }
    break;
}

// ─── UGUU UPLOAD ──────────────────────────────────────────────────────────────
case 'uploadugu': case 'uguu': {
    await react('📤');
    const quotedImgUgu = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
    const hasMediaUgu = quotedImgUgu?.imageMessage || quotedImgUgu?.videoMessage || quotedImgUgu?.audioMessage || msg.message?.imageMessage;
    if (!hasMediaUgu) return reply('❗ Reply to media (image/video/audio) to upload to Uguu.');
    try {
        const msgObj = quotedImgUgu?.imageMessage ? { obj: quotedImgUgu.imageMessage, type: 'image', ext: 'jpg' } : quotedImgUgu?.videoMessage ? { obj: quotedImgUgu.videoMessage, type: 'video', ext: 'mp4' } : quotedImgUgu?.audioMessage ? { obj: quotedImgUgu.audioMessage, type: 'audio', ext: 'ogg' } : { obj: msg.message.imageMessage, type: 'image', ext: 'jpg' };
        const s = await downloadContentFromMessage(msgObj.obj, msgObj.type); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]);
        const tmp = path.join(os.tmpdir(), `uguu_${Date.now()}.${msgObj.ext}`); fs.writeFileSync(tmp, b);
        const result = await UploadFileUgu(tmp);
        try { fs.unlinkSync(tmp); } catch {}
        if (result?.url) await reply(`📤 *Uguu Upload:*\n\n🔗 ${result.url}\n📁 ${result.name || 'file'}\n📦 ${result.size ? fmtBytes(result.size) : '?'}`);
        else reply('⚠️ Upload failed.');
        await react('✅');
    } catch (e) { reply(`⚠️ Uguu upload failed: ${e.message}`); }
    break;
}

// ─── VIEW ONCE ────────────────────────────────────────────────────────────────
case 'vv': case 'rvo': case 'viewonce': {
    await react('✨');
    await viewonceCommand(socket, from, msg, fakeCard);
    break;
}

// ─── STICKER ──────────────────────────────────────────────────────────────────
case 'sticker': case 's': {
    await react('✨');
    try {
        let quoted5 = msg.quoted || msg; let mime5 = (quoted5.msg || quoted5).mimetype || '';
        if (!mime5 && quoted5.message) { const mt5 = Object.keys(quoted5.message)[0]; mime5 = { imageMessage: 'image/jpeg', videoMessage: 'video/mp4' }[mt5] || ''; }
        if (!mime5 || !/image|video/.test(mime5)) return socket.sendMessage(from, { text: '⚠️ Reply with an image/video to make a sticker!' }, { quoted: msg });
        const mediaBuf = await downloadMediaMessage(msg.quoted || msg, 'buffer', {});
        await socket.sendMessage(from, { sticker: mediaBuf }, { quoted: msg });
    } catch (e) { await socket.sendMessage(from, { text: `💔 Failed to create sticker: ${e.message}` }, { quoted: msg }); }
    break;
}

// ─── TOGIF ────────────────────────────────────────────────────────────────────
case 'togif': {
    await react('⏳');
    const stickerMsg = msg.quoted?.message?.stickerMessage || msg.message?.stickerMessage;
    if (!stickerMsg) return reply('⚠️ Reply to an animated sticker with .togif');
    const td = path.join(process.cwd(), 'temp'); if (!fs.existsSync(td)) fs.mkdirSync(td, { recursive: true });
    const ip = path.join(td, `togif_${Date.now()}.webp`), op = path.join(td, `togif_${Date.now()}.gif`);
    try { const s = await downloadContentFromMessage(stickerMsg, 'sticker'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); fs.writeFileSync(ip, b); if (!ffmpeg) return reply('⚠️ ffmpeg not available.'); await new Promise((res, rej) => { ffmpeg(ip).outputOptions(['-vf', 'fps=10,scale=512:512:force_original_aspect_ratio=decrease', '-loop', '0']).save(op).on('end', res).on('error', rej); }); await socket.sendMessage(from, { video: fs.readFileSync(op), mimetype: 'video/gif', caption: '🎞️ Converted GIF' }, { quoted: fakeCard }); await react('✅'); } catch (e) { reply(`⚠️ ${e.message}`); } finally { try { fs.unlinkSync(ip); fs.unlinkSync(op); } catch {} }
    break;
}

// ─── REMINI ───────────────────────────────────────────────────────────────────
case 'remini': {
    await react('🪄');
    const qi = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
    if (!qi?.imageMessage && !msg.message?.imageMessage) return reply('❗ Reply to an image');
    try {
        const imgObj = qi?.imageMessage || msg.message.imageMessage;
        const s = await downloadContentFromMessage(imgObj, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]);
        const imgUrl = await uploadSmartMedia(b, 'image/jpeg');
        let enhanced = null;
        for (const fn of [async () => { const { data } = await axios.get(`${config.DAVID_API}/tools/remini?imageUrl=${encodeURIComponent(imgUrl)}`, { timeout: 60000 }); return data?.result?.image || data?.imageUrl; }, async () => { const { data } = await axios.get(`https://api.siputzx.my.id/api/tools/remini?url=${encodeURIComponent(imgUrl)}`, { timeout: 60000 }); return data?.result || data?.url; }]) { try { const r = await fn(); if (r) { enhanced = r; break; } } catch {} }
        if (enhanced) await socket.sendMessage(from, { image: { url: enhanced }, caption: `🪄 *Remini Enhanced!*${WM}` }, { quoted: fakeCard });
        else reply('⚠️ Remini failed.');
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── REMOVEBG ─────────────────────────────────────────────────────────────────
case 'removebg': {
    await react('✂️');
    const qiRb = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
    const hasImgRb = qiRb?.imageMessage || msg.message?.imageMessage;
    if (!hasImgRb && !q) return reply('❗ Reply to an image or provide URL.');
    try {
        let imgUrl = q;
        if (!imgUrl || !imgUrl.startsWith('http')) { const imgObj = qiRb?.imageMessage || msg.message.imageMessage; const s = await downloadContentFromMessage(imgObj, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); imgUrl = await uploadSmartMedia(b, 'image/jpeg'); }
        const { data } = await axios.get(`https://api.siputzx.my.id/api/iloveimg/removebg?image=${encodeURIComponent(imgUrl)}`, { responseType: 'arraybuffer', timeout: 60000 });
        if (data) await socket.sendMessage(from, { image: Buffer.from(data), caption: `✂️ *Background Removed!*${WM}` }, { quoted: fakeCard });
        else reply('⚠️ RemoveBG failed.');
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── IMAGE EDITORS ────────────────────────────────────────────────────────────
case 'wasted': { await react('💀'); const qi2 = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message; if (!qi2?.imageMessage && !msg.message?.imageMessage) return reply('❗ Reply to an image'); try { const imgObj = qi2?.imageMessage || msg.message.imageMessage; const s = await downloadContentFromMessage(imgObj, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); const imgUrl = await uploadSmartMedia(b, 'image/jpeg'); const { data } = await axios.get(`${config.NEXRAY_API}/editor/wasted?url=${encodeURIComponent(imgUrl)}`, { responseType: 'arraybuffer', timeout: 30000 }); await socket.sendMessage(from, { image: Buffer.from(data), caption: `💀 *WASTED!*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'jail': { await react('🚔'); const qi3 = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message; if (!qi3?.imageMessage && !msg.message?.imageMessage) return reply('❗ Reply to an image'); try { const imgObj = qi3?.imageMessage || msg.message.imageMessage; const s = await downloadContentFromMessage(imgObj, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); const imgUrl = await uploadSmartMedia(b, 'image/jpeg'); const { data } = await axios.get(`https://api.siputzx.my.id/api/maker/jail?url=${encodeURIComponent(imgUrl)}`, { responseType: 'arraybuffer', timeout: 30000 }); await socket.sendMessage(from, { image: Buffer.from(data), caption: `🚔 *JAILED!*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'wanted': { await react('🎯'); const qi4 = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message; if (!qi4?.imageMessage && !msg.message?.imageMessage) return reply('❗ Reply to an image'); try { const imgObj = qi4?.imageMessage || msg.message.imageMessage; const s = await downloadContentFromMessage(imgObj, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); const imgUrl = await uploadSmartMedia(b, 'image/jpeg'); const { data } = await axios.get(`${config.NEXRAY_API}/editor/wanted?url=${encodeURIComponent(imgUrl)}&text=${encodeURIComponent(q || 'WANTED')}`, { responseType: 'arraybuffer', timeout: 30000 }); await socket.sendMessage(from, { image: Buffer.from(data), caption: `🎯 *WANTED!*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'gun': { await react('🔫'); const qi5 = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message; if (!qi5?.imageMessage && !msg.message?.imageMessage) return reply('❗ Reply to an image'); try { const imgObj = qi5?.imageMessage || msg.message.imageMessage; const s = await downloadContentFromMessage(imgObj, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); const imgUrl = await uploadSmartMedia(b, 'image/jpeg'); const { data } = await axios.get(`${config.DAVID_API}/canvas/gun?imageUrl=${encodeURIComponent(imgUrl)}`, { responseType: 'arraybuffer', timeout: 30000 }); await socket.sendMessage(from, { image: Buffer.from(data), caption: `🔫 *GUN EFFECT!*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'brat': { await react('😈'); if (!q) return reply(`Usage: ${activePrefix}brat <text>`); try { const { data } = await axios.get(`https://api.siputzx.my.id/api/maker/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 30000 }); await socket.sendMessage(from, { image: Buffer.from(data), caption: `😈 *Brat: ${q}*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'neon': { await react('🌈'); if (!q) return reply(`Usage: ${activePrefix}neon <text>`); try { const { data } = await axios.get(`https://api.siputzx.my.id/api/maker/neon?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 30000 }); await socket.sendMessage(from, { image: Buffer.from(data), caption: `🌈 *Neon: ${q}*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }

// ─── PREXZY IMAGE CREATORS ────────────────────────────────────────────────────
case 'spongebob': { await react('🤣'); if (!q) return reply(`Usage: ${activePrefix}spongebob <text>`); try { const { data } = await axios.get(`${config.PREXZY_API}/imagecreator/spongebob?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 30000 }); await socket.sendMessage(from, { image: Buffer.from(data), caption: `🧽 *SpongeBob says:* ${q}${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'memetext': { await react('🖼️'); if (!q) return reply(`Usage: ${activePrefix}memetext <text>`); try { const { data } = await axios.get(`${config.PREXZY_API}/imagecreator/memeText?text=${encodeURIComponent(q)}&width=800&height=600`, { responseType: 'arraybuffer', timeout: 30000 }); await socket.sendMessage(from, { image: Buffer.from(data), caption: `🖼️ *Meme: ${q}*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'textgif': { await react('🎬'); if (!q) return reply(`Usage: ${activePrefix}textgif <text> | <bg_color> | <text_color>`); try { const parts = q.split('|').map(s => s.trim()); const txt = parts[0], bg = (parts[1] || '000000').replace('#', ''), color = (parts[2] || 'ffffff').replace('#', ''); const { data } = await axios.get(`${config.PREXZY_API}/imagecreator/gif?text=${encodeURIComponent(txt)}&background=${bg}&color=${color}`, { responseType: 'arraybuffer', timeout: 30000 }); await socket.sendMessage(from, { video: Buffer.from(data), mimetype: 'video/gif', caption: `🎬 *Text GIF: ${txt}*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'textmp4': { await react('🎬'); if (!q) return reply(`Usage: ${activePrefix}textmp4 <text> | <bg_color> | <text_color>`); try { const parts = q.split('|').map(s => s.trim()); const txt = parts[0], bg = (parts[1] || '000000').replace('#', ''), color = (parts[2] || 'ffffff').replace('#', ''); const { data } = await axios.get(`${config.PREXZY_API}/imagecreator/mp4?text=${encodeURIComponent(txt)}&background=${bg}&color=${color}`, { responseType: 'arraybuffer', timeout: 30000 }); await socket.sendMessage(from, { video: Buffer.from(data), mimetype: 'video/mp4', caption: `🎬 *Text Video: ${txt}*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }

// ─── QR / SSWEB ───────────────────────────────────────────────────────────────
case 'qr': { await react('🔳'); if (!q) return reply(`Usage: ${activePrefix}qr <text>`); try { const { data } = await axios.get(`https://api.siputzx.my.id/api/tools/qr?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 15000 }); await socket.sendMessage(from, { image: Buffer.from(data), caption: `🔳 *QR Code: ${q}*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'ssweb': { await react('🌐'); if (!q) return reply(`Usage: ${activePrefix}ssweb <url>`); try { const { data } = await axios.get(`https://api.siputzx.my.id/api/tools/ssweb?url=${encodeURIComponent(q)}&theme=light&device=desktop`, { responseType: 'arraybuffer', timeout: 30000 }); await socket.sendMessage(from, { image: Buffer.from(data), caption: `🌐 *Screenshot: ${q}*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }

// ─── GOOGLE SEARCH — NEW ──────────────────────────────────────────────────────
case 'google': case 'search': {
    await react('🔍');
    if (!q) return reply(`Usage: ${activePrefix}google <query>\n\n📌 Example: ${activePrefix}google best programming languages 2026`);
    try {
        // Try to get real search results first
        let searchResults = null;
        try {
            const { data } = await axios.get(`${config.NEXRAY_API}/search/google?query=${encodeURIComponent(q)}`, { timeout: 15000 });
            searchResults = data?.result || data?.results;
        } catch {}

        if (!searchResults) {
            try {
                const { data } = await axios.get(`${config.DAVID_API}/search/google?query=${encodeURIComponent(q)}`, { timeout: 15000 });
                searchResults = data?.result || data?.results;
            } catch {}
        }

        if (!searchResults) {
            try {
                const { data } = await axios.get(`${config.ELITE_API}/google?query=${encodeURIComponent(q)}`, { timeout: 15000 });
                searchResults = data?.result || data?.results;
            } catch {}
        }

        if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
            let txt = `🔍 *Google Search: ${q}*\n\n`;
            searchResults.slice(0, 5).forEach((r, i) => {
                const title = r.title || r.name || 'No title';
                const desc = (r.description || r.snippet || r.desc || '').substring(0, 120);
                const link = r.url || r.link || r.href || '';
                txt += `*${i + 1}. ${title}*\n${desc}\n${link ? `🔗 ${link}` : ''}\n\n`;
            });
            await reply(txt.trim());
        } else {
            // Fallback: provide a Google search link
            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
            await replyImg(botImg,
                `🔍 *Google Search: ${q}*\n\n🌐 Open this link to view results:\n${googleUrl}\n\n_No direct results fetched — tap the link to search on Google._`
            );
        }
        await react('✅');
    } catch (e) { reply(`⚠️ Google search error: ${e.message}`); }
    break;
}

// ─── FETCH — ENHANCED (adapted from example fetch handler) ───────────────────
case 'fetch': case 'get': {
    if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!');
    if (!q) return reply(`Usage: ${activePrefix}fetch <url>\n\nFetches any URL and returns content.\nSupports: images, JSON, text, HTML, documents`);
    await react('📡');

    // Normalise URL
    let fetchUrl = q.trim();
    if (!/^https?:\/\//i.test(fetchUrl)) fetchUrl = 'http://' + fetchUrl;

    try {
        const MAX_REDIRECTS = 10;
        let redirectCount = 0;
        let currentUrl = fetchUrl;

        while (redirectCount < MAX_REDIRECTS) {
            const response = await axios.get(currentUrl, {
                timeout: 20000,
                maxRedirects: 0,
                validateStatus: s => s < 400 || s === 301 || s === 302 || s === 307 || s === 308,
                responseType: 'arraybuffer'
            });

            const contentType = (response.headers['content-type'] || '').toLowerCase();
            const contentLength = parseInt(response.headers['content-length'] || '0');

            // Guard against huge files (>100MB)
            if (contentLength > 100 * 1024 * 1024) {
                await reply(`⚠️ File too large (${fmtBytes(contentLength)}). Cannot fetch.`);
                break;
            }

            // Handle redirects manually
            if ([301, 302, 307, 308].includes(response.status)) {
                const location = response.headers['location'];
                if (location) { currentUrl = location; redirectCount++; continue; }
                else break;
            }

            const rawBuffer = Buffer.from(response.data);
            const fileName = path.basename(new URL(currentUrl).pathname) || 'file';

            if (/^image\//.test(contentType)) {
                await socket.sendMessage(from, { image: rawBuffer, caption: `📡 *Fetched Image*\n🔗 ${currentUrl.substring(0, 80)}${WM}` }, { quoted: fakeCard });
            } else if (/^video\//.test(contentType)) {
                await socket.sendMessage(from, { video: rawBuffer, mimetype: contentType.split(';')[0], caption: `📡 *Fetched Video*\n🔗 ${currentUrl.substring(0, 80)}${WM}` }, { quoted: fakeCard });
            } else if (/^audio\//.test(contentType)) {
                await socket.sendMessage(from, { audio: rawBuffer, mimetype: contentType.split(';')[0], ptt: false }, { quoted: fakeCard });
            } else if (/json/.test(contentType)) {
                const txt = rawBuffer.toString('utf8');
                let pretty = txt;
                try { pretty = JSON.stringify(JSON.parse(txt), null, 2); } catch {}
                if (pretty.length <= 3500) {
                    await reply(`📡 *Fetch Result (JSON):*\n\n\`\`\`\n${pretty.substring(0, 3400)}\n\`\`\``);
                } else {
                    await socket.sendMessage(from, { document: Buffer.from(pretty), fileName: `${fileName}.json`, mimetype: 'application/json', caption: `📡 *Fetched JSON*\n🔗 ${currentUrl.substring(0, 60)}${WM}` }, { quoted: fakeCard });
                }
            } else if (/^text\//.test(contentType)) {
                const txt = rawBuffer.toString('utf8');
                if (txt.length <= 3500) {
                    await reply(`📡 *Fetch Result (${contentType.split(';')[0]}):*\n\n${txt.substring(0, 3400)}`);
                } else {
                    const ext = /html/.test(contentType) ? 'html' : 'txt';
                    await socket.sendMessage(from, { document: rawBuffer, fileName: `${fileName}.${ext}`, mimetype: contentType.split(';')[0] || 'text/plain', caption: `📡 *Fetched Text File*\n🔗 ${currentUrl.substring(0, 60)}${WM}` }, { quoted: fakeCard });
                }
            } else {
                // Send as generic document
                await socket.sendMessage(from, { document: rawBuffer, fileName: fileName, mimetype: contentType.split(';')[0] || 'application/octet-stream', caption: `📡 *Fetched File*\n📁 ${fileName}\n📦 ${fmtBytes(rawBuffer.length)}\n🔗 ${currentUrl.substring(0, 60)}${WM}` }, { quoted: fakeCard });
            }

            await react('✅');
            break;
        }

        if (redirectCount >= MAX_REDIRECTS) {
            await reply(`⚠️ Too many redirects (max: ${MAX_REDIRECTS}).`);
        }
    } catch (e) {
        reply(`⚠️ Fetch error: ${e.message}`);
    }
    break;
}

// ─── OCR ──────────────────────────────────────────────────────────────────────
case 'ocr': {
    await react('🔍');
    const qiOcr = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
    if (!qiOcr?.imageMessage && !msg.message?.imageMessage) return reply('❗ Reply to an image');
    try { const imgObj = qiOcr?.imageMessage || msg.message.imageMessage; const s = await downloadContentFromMessage(imgObj, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); const imgUrl = await uploadSmartMedia(b, 'image/jpeg'); const { data } = await axios.get(`${config.NEXRAY_API}/tools/ocr?imageUrl=${encodeURIComponent(imgUrl)}`, { timeout: 30000 }); const t = data?.result || data?.text; if (t) await reply(`🔍 *OCR Result:*\n\n${t}`); else reply('⚠️ OCR failed.'); } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── URL UPLOAD (catbox) ──────────────────────────────────────────────────────
case 'url': case 'tourl': case 'catbox': {
    await react('📤');
    try { const quoted5 = msg.quoted || msg; let mime5 = ''; if (quoted5.message) { const mt5 = Object.keys(quoted5.message)[0]; mime5 = { imageMessage: 'image/jpeg', videoMessage: 'video/mp4', audioMessage: 'audio/mpeg', documentMessage: 'application/octet-stream' }[mt5] || ''; } if (!mime5 || !['image', 'video', 'audio', 'application'].some(t => mime5.includes(t))) return reply('⚠️ Reply to image, audio, or video!'); await reply('⏳ *Uploading...*'); const buffer5 = await downloadMediaMessage(quoted5, 'buffer', {}); if (!buffer5?.length) throw new Error('Empty buffer'); const ext5 = mime5.includes('jpeg') ? '.jpg' : mime5.includes('png') ? '.png' : mime5.includes('video') ? '.mp4' : mime5.includes('audio') ? '.mp3' : '.bin'; const name5 = `file_${Date.now()}${ext5}`, tmp5 = path.join(os.tmpdir(), name5); fs.writeFileSync(tmp5, buffer5); const form5 = new FormData(); form5.append('fileToUpload', fs.createReadStream(tmp5), name5); form5.append('reqtype', 'fileupload'); const res5 = await axios.post('https://catbox.moe/user/api.php', form5, { headers: form5.getHeaders(), timeout: 30000 }); try { fs.unlinkSync(tmp5); } catch {} if (!res5.data || res5.data.includes('error')) throw new Error('Upload failed'); await reply(`✅ *Uploaded!*\n\n📁 Size: ${fmtBytes(buffer5.length)}\n🔗 URL: ${res5.data}`); await react('✅'); }
    catch (e) { reply(`⚠️ Upload failed: ${e.message}`); }
    break;
}

// ─── SHORTURL ─────────────────────────────────────────────────────────────────
case 'shorturl': case 'tinyurl': { await react('🔗'); if (!q) return reply(`Usage: ${activePrefix}shorturl <url>`); if (!/^https?:\/\//.test(q)) return reply('⚠️ Invalid URL.'); try { const r = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(q)}`, { timeout: 10000 }); const su = r.data.trim(); if (su.startsWith('https://')) await reply(`✅ *Short URL:*\n🔗 ${su}\n\n🌐 Original: ${q}`); else reply('⚠️ Failed.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }

// ─── TRANSLATE / TTS / BOMB ───────────────────────────────────────────────────
case 'translate': case 'tr': {
    await react('🌍');
    const lang6 = args[0], text6 = args.slice(1).join(' ');
    if (!lang6 || !text6) return reply(`Usage: ${activePrefix}translate <lang> <text>\n\nExample: ${activePrefix}translate es Hello World`);
    try {
        let translated = null;
        // Primary: @vitalets/google-translate-api
        try { const r = await translate.translate(text6, { to: lang6 }); translated = r.text; } catch {}
        // Fallback: MyMemory API (free, no key)
        if (!translated) {
            try {
                const { data } = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text6)}&langpair=en|${lang6}`, { timeout: 15000 });
                translated = data?.responseData?.translatedText;
                if (translated === text6) translated = null; // same text = failed
            } catch {}
        }
        // Fallback: LibreTranslate
        if (!translated) {
            try {
                const { data } = await axios.post('https://translate.argosopentech.com/translate', { q: text6, source: 'en', target: lang6, format: 'text' }, { timeout: 15000 });
                translated = data?.translatedText;
            } catch {}
        }
        if (translated) await reply(`✦━━━━━━━━━━━━━━━━✦\n🌍 *TRANSLATION*\n✦━━━━━━━━━━━━━━━━✦\n🔤 Original: ${text6}\n💬 (${lang6}): ${translated}\n✦━━━━━━━━━━━━━━━━✦`);
        else reply(`⚠️ Translation failed for language code: ${lang6}\n\nTry common codes: es, fr, de, pt, ar, zh, ja, ru, hi`);
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}
case 'tts': { await react('🔊'); if (!q) return reply(`Usage: ${activePrefix}tts <text>`); await sendVoiceReply(q, socket, from, msg); break; }
case 'bomb': { await reply('This command has been removed.'); break; }

// ─── WEATHER / WIKI / WHOIS / WINFO / GETPP / BIBLE / QURAN / CRYPTO / NEWS ──
case 'weather': { await react('🌦️'); if (!q) return reply(`Usage: ${activePrefix}weather <city>`); try { const { data } = await axios.get(`http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&appid=2d61a72574c11c4f36173b627f8cb177&units=metric`, { timeout: 10000 }); await replyCarousel(`🌤 Weather: ${data.name}`, [{ title: `🌡️ ${data.main.temp}°C`, description: `Feels Like: ${data.main.feels_like}°C\nHumidity: ${data.main.humidity}%\n${data.weather[0].main}: ${data.weather[0].description}\nWind: ${data.wind.speed} m/s\nPressure: ${data.main.pressure} hPa`, image: botImg, buttons: [{ display: '🔄 Refresh', id: `${activePrefix}weather ${q}` }] }]); } catch (e) { reply(e.message.includes('404') ? '⚠️ City not found!' : `⚠️ ${e.message}`); } break; }
case 'wiki': case 'wikipedia': { await react('📖'); if (!q) return reply(`Usage: ${activePrefix}wiki <topic>`); try { const { data } = await axios.get(`${config.NEXRAY_API}/search/wikipedia?query=${encodeURIComponent(q)}`, { timeout: 15000 }); const t = data?.result?.extract || data?.extract; if (t) await reply(`📖 *Wikipedia: ${q}*\n\n${(typeof t === 'string' ? t : JSON.stringify(t)).substring(0, 2000)}`); else reply('⚠️ No results.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'whois': { await react('👤'); if (!q) return reply(`Usage: ${activePrefix}whois <domain>`); try { const r = await fetch(`http://api.whois.vu/?whois=${encodeURIComponent(q)}`); const d = await r.json(); if (!d.domain) throw new Error('Not found'); await reply(`🔍 *WHOIS: ${d.domain}*\n\nRegistered: ${d.created_date || 'N/A'}\nExpires: ${d.expiry_date || 'N/A'}\nRegistrar: ${d.registrar || 'N/A'}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'winfo': case 'stalk': { await react('😢'); if (!q && !args[0]) return reply(`Usage: ${activePrefix}winfo <number>`); const inputNumber = q.replace(/[^0-9]/g, ''); if (inputNumber.length < 10) return reply('⚠️ Invalid number.'); try { const [wu] = await socket.onWhatsApp(inputNumber + '@s.whatsapp.net').catch(() => []); if (!wu?.exists) return reply('⚠️ Not on WhatsApp.'); let pp = 'https://img.pyrocdn.com/dbKUgahg.png'; try { pp = await socket.profilePictureUrl(inputNumber + '@s.whatsapp.net', 'image'); } catch {} let bio = 'No bio'; try { const sd = await socket.fetchStatus(inputNumber + '@s.whatsapp.net').catch(() => null); if (sd?.status) bio = sd.status; } catch {} await socket.sendMessage(from, { image: { url: pp }, caption: `🔍 *PROFILE INFO*\n\n📞 Number: ${inputNumber}\n💼 Account: ${wu.isBusiness ? 'Business' : 'Personal'}\n📝 Bio: ${bio}${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'getpp': case 'pp': case 'profilepic': {
    await react('👤');
    try {
        let tu = nowsender;
        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (mentionedJid.length > 0) tu = mentionedJid[0];
        else if (quotedParticipant) tu = quotedParticipant;
        const ppUrl = await socket.profilePictureUrl(tu, 'image').catch(() => null);
        if (ppUrl) await socket.sendMessage(from, { image: { url: ppUrl }, caption: `✦━━━━━━━━━━━━━━━━✦\n👤 Profile: @${tu.split('@')[0]}\n✦━━━━━━━━━━━━━━━━✦${WM}`, mentions: [tu] });
        else await reply(`@${tu.split('@')[0]} has no profile picture set.`, [tu]);
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}
case 'bible': { await react('✝️'); if (!q) return reply(`Usage: ${activePrefix}bible <verse>`); try { let verse = null; try { const { data } = await axios.get(`${config.ELITE_API}/bible?verse=${encodeURIComponent(q)}`, { timeout: 10000 }); verse = data?.result?.text || data?.text; } catch {} if (!verse) { const { data } = await axios.get(`https://bible-api.com/${encodeURIComponent(q)}`, { timeout: 10000 }); verse = data?.text; } if (verse) await reply(`✝️ *${q}*\n\n"${verse}"`); else reply('⚠️ Verse not found.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'quran': { await react('☪️'); if (!q) return reply(`Usage: ${activePrefix}quran <surah:ayah>`); try { const { data } = await axios.get(`https://api.alquran.cloud/v1/ayah/${encodeURIComponent(q)}`, { timeout: 10000 }); const t = data?.data?.text; if (t) await reply(`☪️ *Quran ${q}*\n\n"${t}"`); else reply('⚠️ Verse not found.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'crypto': { await react('💰'); if (!q) return reply(`Usage: ${activePrefix}crypto <coin>`); try { const { data } = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${q}&vs_currencies=usd`, { timeout: 10000 }); const price = data?.[q]?.usd; if (price) await reply(`💰 *${q.toUpperCase()}*\n\nPrice: $${price} USD`); else reply('⚠️ Coin not found.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'news': {
    await react('📰');
    try {
        let articles = [];
        // BBC World News via RSS2JSON (free, no key)
        try {
            const { data } = await axios.get('https://api.rss2json.com/v1/api.json?rss_url=https://feeds.bbci.co.uk/news/world/rss.xml', { timeout: 15000 });
            articles = data?.items || [];
        } catch {}
        // Fallback: David API tech news
        if (!articles.length) {
            const { data } = await axios.get(`${config.DAVID_API}/random/technews`, { timeout: 15000 });
            articles = data?.result || data?.news || [];
        }
        if (!articles.length) return reply('⚠️ No news available right now.');
        const category = q || 'World';
        let txt = `✦━━━━━━━━━━━━━━━━✦\n📰 *LATEST NEWS*\n✦━━━━━━━━━━━━━━━━✦\n`;
        articles.slice(0, 5).forEach((n, i) => {
            const title = n.title || n.headline || '';
            const desc = (n.description || n.summary || n.content || '').replace(/<[^>]*>/g, '').substring(0, 120);
            const link = n.link || n.url || '';
            const date = n.pubDate ? new Date(n.pubDate).toLocaleDateString() : '';
            txt += `\n*${i+1}. ${title}*\n${desc}...\n${date ? `🕒 ${date}` : ''} ${link ? `🔗 ${link}` : ''}\n`;
        });
        txt += `\n✦━━━━━━━━━━━━━━━━✦`;
        await reply(txt);
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}
case 'nasa': { await react('✔️'); try { const r = await fetch('https://api.nasa.gov/planetary/apod?api_key=8vhAFhlLCDlRLzt5P1iLu2OOMkxtmScpO5VmZEjZ'); const d = await r.json(); if (!d.title || d.media_type !== 'image') return reply('⚠️ No image today.'); await socket.sendMessage(from, { image: { url: d.url }, caption: `🌌 *NASA APOD*\n\n🌠 *${d.title}*\n\n${d.explanation.substring(0, 300)}...\n\n📆 ${d.date}${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }

// ─── FUN COMMANDS ─────────────────────────────────────────────────────────────
case 'joke': { await react('🤣'); try { const r = await fetch('https://v2.jokeapi.dev/joke/Any?type=single'); const d = await r.json(); if (d?.joke) await reply(`🃏 *Joke:*\n\n${d.joke}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'darkjoke': { await react('😬'); try { const r = await fetch('https://v2.jokeapi.dev/joke/Dark?type=single'); const d = await r.json(); if (d?.joke) await reply(`🌚 *Dark Humor:*\n\n${d.joke}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'fact': { await react('😑'); try { const r = await fetch('https://uselessfacts.jsph.pl/random.json?language=en'); const d = await r.json(); if (d?.text) await reply(`💡 *Random Fact:*\n\n${d.text}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'advice': { await react('💡'); try { const r = await fetch('https://api.adviceslip.com/advice'); const d = await r.json(); if (d?.slip?.advice) await reply(`💡 *Advice:*\n\n${d.slip.advice}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'riddle': { await react('❓'); try { const { data } = await axios.get('https://api.siputzx.my.id/api/r/riddle', { timeout: 10000 }); const r = data?.result || data?.riddle; if (r) await reply(`❓ *Riddle:*\n\n${typeof r === 'object' ? (r.riddle || r.question || JSON.stringify(r)) : r}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'dare': { await react('🎯'); try { const r = await fetch('https://shizoapi.onrender.com/api/texts/dare?apikey=shizo'); const d = await r.json(); if (d?.dare || d?.data) await reply(`🎯 *Dare:*\n\n${d.dare || d.data}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'truth': { await react('🤫'); try { const r = await fetch('https://shizoapi.onrender.com/api/texts/truth?apikey=shizo'); const d = await r.json(); if (d?.truth || d?.data) await reply(`🤫 *Truth:*\n\n${d.truth || d.data}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'roast': { await react('🤬'); try { const r = await fetch('https://vinuxd.vercel.app/api/roast'); const d = await r.json(); if (d?.data) await reply(`🔥 *Roast:* ${d.data}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'quote': { await react('🤔'); try { let q2 = null; try { const d = await paxQuotes(); q2 = d?.quote || d?.result; } catch {} if (!q2) { const r = await fetch('https://api.quotable.io/random'); const d = await r.json(); q2 = `"${d.content}"\n— ${d.author}`; } await reply(`💭 *Quote:*\n\n${q2}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'pickup': case 'pickupline': { await react('🥰'); try { const r = await fetch('https://vinuxd.vercel.app/api/pickup'); const d = await r.json(); if (d?.data) await reply(`💘 *Pickup Line:*\n\n_${d.data}_`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'lovequote': { await react('🙈'); try { const r = await fetch('https://api.popcat.xyz/lovequote'); const d = await r.json(); if (d?.quote) await reply(`❤️ *Love Quote:*\n\n"${d.quote}"`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'rizz': { await react('😏'); try { const { data } = await axios.get('https://api.siputzx.my.id/api/r/rizz', { timeout: 10000 }); const r = data?.result || data?.rizz; if (r) await reply(`😏 *Rizz:*\n\n${typeof r === 'string' ? r : JSON.stringify(r)}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'waifu': { await react('🥲'); try { const r = await fetch('https://api.waifu.pics/sfw/waifu'); const d = await r.json(); if (d?.url) await socket.sendMessage(from, { image: { url: d.url }, caption: `✨ Random Waifu!${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'meme': { await react('😂'); try { let memeUrl = null, memeTitle = 'Meme'; try { const d = await paxMemes(); memeUrl = d?.url || d?.imageUrl; memeTitle = d?.title || 'Meme'; } catch {} if (!memeUrl) { const r = await fetch('https://meme-api.com/gimme'); const d = await r.json(); memeUrl = d?.url; memeTitle = d?.title || 'Meme'; } if (memeUrl) await socket.sendMessage(from, { image: { url: memeUrl }, caption: `🤣 *${memeTitle}*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'cat': { await react('🐱'); try { const r = await fetch('https://api.thecatapi.com/v1/images/search'); const d = await r.json(); if (d?.[0]?.url) await socket.sendMessage(from, { image: { url: d[0].url }, caption: `🐱 Cute cat!${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'dog': { await react('🦮'); try { let dogUrl = null; try { const { data } = await axios.get(`${config.DAVID_API}/random/dogs`, { timeout: 10000 }); dogUrl = data?.result?.url || data?.url; } catch {} if (!dogUrl) { const r = await fetch('https://dog.ceo/api/breeds/image/random'); const d = await r.json(); dogUrl = d?.message; } if (dogUrl) await socket.sendMessage(from, { image: { url: dogUrl }, caption: `🐶 Cute dog!${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'eightball': { await react('🎱'); if (!q) return reply(`Usage: ${activePrefix}eightball <question>`); try { const { data } = await axios.get(`https://api.siputzx.my.id/api/r/8ball?question=${encodeURIComponent(q)}`, { timeout: 10000 }); const a = data?.result || data?.answer; if (a) await reply(`🎱 *8Ball: ${q}*\n\n${typeof a === 'object' ? JSON.stringify(a) : a}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'technews': { await react('📡'); try { const { data } = await axios.get(`${config.DAVID_API}/random/technews`, { timeout: 15000 }); const items = data?.result || data?.news || []; let txt = `📡 *Tech News:*\n\n`; items.slice(0, 5).forEach((n, i) => { txt += `${i + 1}. *${n.title || ''}*\n${(n.description || n.summary || '').substring(0, 120)}\n\n`; }); await reply(txt); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'funfact': case 'livefunfact': { await react('💡'); try { const { data } = await axios.get(`${config.NEXRAY_API}/fun/livefunfact`, { timeout: 10000 }); const t = data?.result || data?.fact; if (t) await reply(`💡 *Fun Fact:*\n\n${t}`); else { const r = await fetch('https://uselessfacts.jsph.pl/random.json?language=en'); const d = await r.json(); await reply(`💡 *Fun Fact:*\n\n${d.text}`); } } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'game': case 'gaming': { await react('🎮'); try { const { data } = await axios.get('https://raw.githubusercontent.com/GlobalTechInfo/Database/main/images/game.json', { timeout: 10000 }); if (!data?.length) return reply('⚠️ No gaming images.'); const imgUrl = data[Math.floor(Math.random() * data.length)]; await socket.sendMessage(from, { image: { url: imgUrl }, caption: `🎮 Gaming Image${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }

// ─── TICTACTOE ────────────────────────────────────────────────────────────────
case 'tictactoe': {
    if (!isGroup) return reply('⚠️ Groups only!');
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentioned.length) return reply(`❗ Usage: ${activePrefix}tictactoe @user`);
    const playerO = mentioned[0]; if (playerO === nowsender) return reply('⚠️ You can\'t play against yourself!');
    const roomId = `tictactoe_${from}_${Date.now()}`;
    const game = new TicTacToeGame(nowsender, playerO);
    games[roomId] = { id: roomId, game, state: 'PLAYING', x: from, o: from };
    const arr = game.render().map((v, i) => v === ' ' ? (i + 1).toString() : v).map(v => ({ 'X': '❎', 'O': '⭕', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣', '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣' }[v] || v));
    await socket.sendMessage(from, { text: `🎮 *TicTacToe Started!*\n\n❎: @${nowsender.split('@')[0]}\n⭕: @${playerO.split('@')[0]}\n\n${arr.slice(0, 3).join('')}\n${arr.slice(3, 6).join('')}\n${arr.slice(6).join('')}\n\n🎲 Turn: @${nowsender.split('@')[0]} (❎)\nType 1-9 to play`, mentions: [nowsender, playerO] });
    break;
}

// ─── ANIME ────────────────────────────────────────────────────────────────────
case 'animesearch': case 'anime': { await react('🐉'); if (!q) return reply(`Usage: ${activePrefix}animesearch <name>`); try { const { data } = await axios.get(`${config.DAVID_API}/anime/search?query=${encodeURIComponent(q)}`, { timeout: 15000 }); const results = data?.result || data?.animes || []; if (!results.length) return reply('⚠️ No anime found.'); const animeItems = results.slice(0, 5).map(a => ({ title: (a.title || a.name || '?').substring(0, 50), description: `⭐ ${a.score || 'N/A'} | 📺 ${a.episodes || '?'} eps\n${(a.synopsis || a.description || '').substring(0, 100)}`, image: a.image || botImg, buttons: [{ display: '🔍 Info', id: `anime_${a.id || a.title}` }] })); await replyCarousel(`🐉 *Anime Search: ${q}*`, animeItems); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'topanime': { await react('🏆'); try { const { data } = await axios.get(`${config.DAVID_API}/anime/top`, { timeout: 15000 }); const results = data?.result || []; let txt = `🏆 *Top Anime:*\n\n`; results.slice(0, 10).forEach((a, i) => { txt += `${i + 1}. *${a.title || a.name}* ⭐ ${a.score || 'N/A'}\n`; }); await reply(txt); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'currentanime': { await react('📺'); try { const { data } = await axios.get(`${config.DAVID_API}/anime/currentseason`, { timeout: 15000 }); const results = data?.result || []; let txt = `📺 *Current Season:*\n\n`; results.slice(0, 8).forEach((a, i) => { txt += `${i + 1}. *${a.title || a.name}*\n📺 ${a.episodes || '?'} | ⭐ ${a.score || 'N/A'}\n\n`; }); await reply(txt); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'animechar': { await react('👤'); if (!q) return reply(`Usage: ${activePrefix}animechar <name>`); try { const { data } = await axios.get(`${config.DAVID_API}/anime/characters?query=${encodeURIComponent(q)}`, { timeout: 15000 }); const r = data?.result?.[0]; if (!r) return reply('⚠️ Not found.'); await reply(`👤 *${r.name || q}*\n\nAnime: ${r.anime || 'N/A'}\nRole: ${r.role || 'N/A'}\nAbout: ${(r.about || '').substring(0, 300)}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'samehadaku': { await react('🎌'); if (!q) return reply(`Usage: ${activePrefix}samehadaku <name>`); try { const { data } = await axios.get(`${config.NEXRAY_API}/anime/samehadaku/search?query=${encodeURIComponent(q)}`, { timeout: 15000 }); const results = data?.result || []; let txt = `🎌 *Samehadaku: ${q}*\n\n`; results.slice(0, 5).forEach((a, i) => { txt += `${i + 1}. *${a.title || a.name}*\nEps: ${a.episode || '?'}\n🔗 ${a.url || ''}\n\n`; }); await reply(txt); } catch (e) { reply(`⚠️ ${e.message}`); } break; }

// ─── SPORTS ───────────────────────────────────────────────────────────────────
case 'soccer': case 'soccerscores': {
    await react('⚽');
    const league = q?.toLowerCase() || 'epl';
    const espnLeague = league.includes('la liga') || league === 'laliga' ? 'esp.1' : league.includes('bundesliga') ? 'ger.1' : league.includes('serie') ? 'ita.1' : league.includes('ligue') ? 'fra.1' : 'eng.1';
    try {
        let games = await espnScoreboard('soccer', espnLeague);
        if (!games.length) games = await espnScoreboard('soccer', 'all');
        if (!games.length) return reply('⚠️ No soccer scores available right now.');
        let txt = `✦━━━━━━━━━━━━━━━━✦\n⚽ *SOCCER SCORES*\n✦━━━━━━━━━━━━━━━━✦\n`;
        games.slice(0, 8).forEach(g => { txt += `\n⚽ ${g.home} *${g.homeScore} - ${g.awayScore}* ${g.away}\n📍 ${g.status}\n`; });
        txt += `✦━━━━━━━━━━━━━━━━✦`;
        await reply(txt);
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}
case 'nba': {
    await react('🏀');
    try {
        const games = await espnScoreboard('basketball', 'nba');
        if (!games.length) return reply('⚠️ No NBA games right now. Check back during game day!');
        let txt = `✦━━━━━━━━━━━━━━━━✦\n🏀 *NBA SCORES*\n✦━━━━━━━━━━━━━━━━✦\n`;
        games.slice(0, 8).forEach(g => { txt += `\n🏀 ${g.home} *${g.homeScore} - ${g.awayScore}* ${g.away}\n📍 ${g.status}\n`; });
        txt += `✦━━━━━━━━━━━━━━━━✦`;
        await reply(txt);
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}
case 'livescores': case 'live': case 'score': {
    await react('⚽');
    try {
        let allGames = [];
        // Try multiple ESPN sport endpoints
        for (const [sport, league] of [['soccer', 'eng.1'], ['soccer', 'all'], ['basketball', 'nba'], ['football', 'nfl']]) {
            const games = await espnScoreboard(sport, league);
            const live = games.filter(g => g.status && !['Scheduled', 'Final', 'STATUS_SCHEDULED', 'STATUS_FINAL'].some(s => g.status.includes(s)));
            allGames = allGames.concat(live);
        }
        if (!allGames.length) {
            // Fallback: show today's games even if not live
            allGames = await espnScoreboard('soccer', 'eng.1');
        }
        if (!allGames.length) return reply('⚠️ No live scores right now. Try again during match time!');
        let txt = `✦━━━━━━━━━━━━━━━━✦\n🔴 *LIVE SCORES*\n✦━━━━━━━━━━━━━━━━✦\n`;
        allGames.slice(0, 8).forEach(g => { txt += `\n🔴 ${g.home} *${g.homeScore} - ${g.awayScore}* ${g.away}\n📍 ${g.status}\n`; });
        txt += `✦━━━━━━━━━━━━━━━━✦`;
        await reply(txt);
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}
case 'surebet': case 'bettips': {
    await react('🎲');
    try {
        // Try TheOdds API (free tier) or generate from live scores
        const games = await espnScoreboard('soccer', 'eng.1');
        if (!games.length) return reply('⚠️ No betting tips available right now.');
        let txt = `✦━━━━━━━━━━━━━━━━✦\n🎲 *TODAY\'S MATCHES*\n✦━━━━━━━━━━━━━━━━✦\n`;
        games.slice(0, 6).forEach((g, i) => {
            txt += `\n${i+1}. *${g.home} vs ${g.away}*\n📍 ${g.status}\n`;
        });
        txt += `\n_Bet responsibly. Gamble at your own risk._\n✦━━━━━━━━━━━━━━━━✦`;
        await reply(txt);
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}
case 'standings': {
    await react('📊');
    const lc = (args[0] || 'epl').toLowerCase();
    try {
        const leagueId = LEAGUE_IDS[lc] || '4328';
        const d = await sportsdbSearch('lookuptable', { l: leagueId });
        const teams = d?.table || [];
        if (!teams.length) return reply(`⚠️ No standings found for *${lc}*. Try: epl, laliga, bundesliga, serie a`);
        let txt = `✦━━━━━━━━━━━━━━━━✦\n📊 *${lc.toUpperCase()} STANDINGS*\n✦━━━━━━━━━━━━━━━━✦\n`;
        teams.slice(0, 10).forEach(t => {
            txt += `\n${t.intRank}. *${t.strTeam}* — ${t.intPoints}pts (${t.intWin}W ${t.intDraw}D ${t.intLoss}L)`;
        });
        txt += `\n\n✦━━━━━━━━━━━━━━━━✦`;
        await reply(txt);
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── TEMP MAIL ────────────────────────────────────────────────────────────────
case 'tempmail': case 'tempmailgen': {
    await react('📧');
    try {
        let email = null;
        try { const d = await paxTempMailCreate(); email = d?.email || d?.address; } catch {}
        if (!email) { try { const { data } = await axios.get(`${config.ELITE_API}/tempemail`, { timeout: 10000 }); email = data?.result?.email || data?.email; } catch {} }
        if (!email) { try { const { data } = await axios.get(`${config.GIFTED_TECH_API}/api/tempmail/generate?apikey=${config.GIFTED_API_KEY}`, { timeout: 10000 }); email = data?.result?.email; } catch {} }
        if (!email) return reply('⚠️ Failed to generate temp email.');
        global.tempMailCachePax[senderNumber] = { email, expires: Date.now() + 10 * 60000 };
        await replyCarousel('📧 TEMPORARY EMAIL GENERATED', [{ title: '📮 Your Temp Email', description: `Email: ${email}\n\n⏰ Expires in 10 minutes\n\nUse .tempinbox to check messages`, image: botImg, buttons: [{ display: '📥 Check Inbox', id: `${activePrefix}tempinbox` }, { display: '🗑️ Delete', id: `${activePrefix}delmail` }], ctaCopy: { label: '📋 Copy Email', code: email } }]);
        await react('✅');
    } catch (e) { reply(`⚠️ TempMail error: ${e.message}`); }
    break;
}
case 'tempinbox': { const c2 = global.tempMailCachePax?.[senderNumber] || global.tempMailCache?.[senderNumber]; if (!c2 || Date.now() > c2.expires) return reply(`⚠️ No active temp email. Use ${activePrefix}tempmail`); await react('📥'); try { let mails = []; try { const d = await paxTempMailInbox(c2.email); mails = d?.emails || d?.messages || d?.result || []; } catch {} if (!mails.length) { try { const { data } = await axios.get(`${config.GIFTED_TECH_API}/api/tempmail/inbox?email=${encodeURIComponent(c2.email)}&apikey=${config.GIFTED_API_KEY}`, { timeout: 10000 }); mails = data?.result || []; } catch {} } if (!mails.length) return reply(`📥 *Inbox (${c2.email})*\n\nNo emails yet.`); let txt = `📥 *Inbox: ${c2.email}*\n\n`; mails.slice(0, 5).forEach((m16, i) => { txt += `${i + 1}. From: ${m16.from || '?'}\nSubject: ${m16.subject || 'No subject'}\nDate: ${m16.date || '?'}\n\n`; }); txt += `Use ${activePrefix}readmail <number>`; await reply(txt); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'readmail': { const num2 = parseInt(args[0]); if (isNaN(num2)) return reply(`Usage: ${activePrefix}readmail <number>`); const c3 = global.tempMailCachePax?.[senderNumber]; if (!c3 || Date.now() > c3.expires) return reply('⚠️ No active temp email.'); try { const d = await paxTempMailInbox(c3.email); const mails2 = d?.emails || d?.messages || d?.result || []; if (!mails2.length || num2 > mails2.length) return reply('⚠️ Invalid email number.'); const mail2 = mails2[num2 - 1]; let body = '(No content)'; try { if (mail2.id) { const bd = await paxTempMailBody(mail2.id); body = bd?.body || bd?.content || bd?.html || bd?.text || body; } } catch {} await reply(`📧 *Email #${num2}*\nFrom: ${mail2.from || '?'}\nSubject: ${mail2.subject || 'No subject'}\nDate: ${mail2.date || '?'}\n\nContent:\n${String(body).replace(/<[^>]*>/g, ' ').substring(0, 2000)}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'delmail': { if (global.tempMailCachePax?.[senderNumber]) delete global.tempMailCachePax[senderNumber]; if (global.tempMailCache?.[senderNumber]) delete global.tempMailCache[senderNumber]; await reply('🗑️ Temp email session deleted.'); break; }

// ─── LOGO ─────────────────────────────────────────────────────────────────────
case 'logolist': { const ls = ['glossysilver', 'writetext', 'blackpinklogo', 'glitchtext', 'advancedglow', 'typographytext', 'pixelglitch', 'neonglitch', 'deletingtext', 'glowingtext', 'underwater', 'logomaker', 'cartoonstyle', 'papercut', 'effectclouds', 'gradienttext', 'summerbeach', 'luxurygold', 'galaxy', 'makingneon', 'texteffect', 'galaxystyle', 'lighteffect']; await reply(`🎨 *Logo Styles (${ls.length}):*\n\n${ls.map(s => `• ${s}`).join('\n')}\n\nUsage: ${activePrefix}logo <style> <text>`); break; }
case 'logo': case 'logos': { if (!q) return reply(`Usage: ${activePrefix}logo <style> <text>`); const styleLg = args[0]?.toLowerCase(); const textLg = args.slice(1).join(' '); if (!textLg) return reply(`Usage: ${activePrefix}logo <style> <text>`); await react('🎨'); try { let imgUrl = null; try { const { data } = await axios.get(`${config.GIFTED_TECH_API}/api/ephoto360/${styleLg}?apikey=${config.GIFTED_API_KEY}&text=${encodeURIComponent(textLg)}`, { timeout: 30000 }); imgUrl = data?.result?.image_url || data?.imageUrl; } catch {} if (!imgUrl) return reply(`⚠️ Logo style "${styleLg}" not found. See ${activePrefix}logolist`); await socket.sendMessage(from, { image: { url: imgUrl }, caption: `✨ *Logo: ${styleLg}*\nText: ${textLg}${WM}` }, { quoted: fakeCard }); await react('✅'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }

// ─── SCHEDULE ─────────────────────────────────────────────────────────────────
case 'schedule': { if (!q) return reply(`Usage: ${activePrefix}schedule <time> <message>\nExamples:\n${activePrefix}schedule 2h Hello!\n${activePrefix}schedule 10:30pm Reminder!`); const timeStr = args[0], msgTxt = args.slice(1).join(' '); if (!msgTxt) return reply('⚠️ Please provide a message.'); const sendAt = parseTime(timeStr); if (!sendAt) return reply('⚠️ Invalid time. Use: 2h, 30m, 10:30am'); const id = generateId(); const sched = await loadSchedules(); sched.push({ id, chatId: from, message: msgTxt, sendAt: sendAt.getTime(), createdAt: Date.now() }); await saveSchedules(sched); await reply(`✅ *Scheduled!*\n\nID: \`${id}\`\nTime: ${sendAt.toLocaleString()}\nIn: ${formatTimeLeft(sendAt.getTime() - Date.now())}\nMessage: ${msgTxt}`); break; }
case 'schedulelist': { const sched2 = await loadSchedules(); const mine = sched2.filter(s => s.chatId === from); if (!mine.length) return reply('📋 No scheduled messages.'); let txt = `📋 *Scheduled:*\n\n`; mine.forEach(s => { txt += `ID: \`${s.id}\`\nMessage: ${s.message}\nIn: ${formatTimeLeft(s.sendAt - Date.now())}\n\n`; }); await reply(txt); break; }
case 'schedulecancel': { if (!args[0]) return reply(`Usage: ${activePrefix}schedulecancel <ID>`); const sched3 = await loadSchedules(); const id2 = args[0].toUpperCase(); const filtered = sched3.filter(s => s.id !== id2); if (filtered.length === sched3.length) return reply('⚠️ No schedule found.'); await saveSchedules(filtered); await reply(`✅ Schedule \`${id2}\` cancelled.`); break; }

// ─── WELCOME / ANTILINK ───────────────────────────────────────────────────────
case 'welcome': { if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); const sub = args[0]?.toLowerCase(); if (sub === 'on') { await setWelcome(from, true); await reply('✅ Welcome messages enabled.'); } else if (sub === 'off') { await setWelcome(from, false); await reply('⚠️ Welcome messages disabled.'); } else if (sub === 'set') { const wMsg = args.slice(1).join(' '); if (!wMsg) return reply(`Usage: ${activePrefix}welcome set <message>\nVariables: {user} {group} {description}`); await setWelcome(from, true, wMsg); await reply(`✅ Welcome message set!\n\n${wMsg}`); } else { const isOn = await isWelcomeOn(from); const wMsg = await getWelcome(from); await reply(`👋 *Welcome:* ${isOn ? 'ON' : 'OFF'}\n*Custom:* ${wMsg || 'None (default)'}\n\nUsage:\n${activePrefix}welcome on/off\n${activePrefix}welcome set <message>`); } break; }
case 'antilink': { if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); const sub = args[0]?.toLowerCase(); if (sub === 'on') { await setAntilink(from, true, args[1] || 'delete'); await reply(`✅ Antilink enabled. Action: ${args[1] || 'delete'}`); } else if (sub === 'off') { await setAntilink(from, false); await reply('⚠️ Antilink disabled.'); } else { const al = await getAntilink(from); await reply(`🚫 *Antilink:* ${al.enabled ? 'ON' : 'OFF'}\nAction: ${al.action}\n\nUsage: ${activePrefix}antilink on/off [delete|warn|kick]`); } break; }

// ─── GROUP COMMANDS ───────────────────────────────────────────────────────────
case 'add': { await react('➕️'); if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); if (!args[0]) return reply(`Usage: ${activePrefix}add +26378xxxxx`); try { const jid9 = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'; await socket.groupParticipantsUpdate(from, [jid9], 'add'); await reply(`✅ ${args[0]} added!`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'kick': { await react('🚬'); if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); try { let nk = null; if (msg.quoted) nk = msg.quoted.key?.participant; else if (args[0]) nk = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'; if (!nk) return reply(`Usage: ${activePrefix}kick @user or reply`); await socket.groupParticipantsUpdate(from, [nk], 'remove'); await reply(`✅ Removed ${nk.split('@')[0]}.`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'promote': { await react('👑'); if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); try { let np = null; if (msg.quoted) np = msg.quoted.key?.participant; else if (args[0]) np = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'; if (!np) return reply(`Usage: ${activePrefix}promote @user`); await socket.groupParticipantsUpdate(from, [np], 'promote'); await reply(`✅ Promoted ${np.split('@')[0]}!`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'demote': { await react('🙆‍♀️'); if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); try { let nd = null; if (msg.quoted) nd = msg.quoted.key?.participant; else if (args[0]) nd = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'; if (!nd) return reply(`Usage: ${activePrefix}demote @user`); await socket.groupParticipantsUpdate(from, [nd], 'demote'); await reply(`✅ Demoted ${nd.split('@')[0]}.`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'open': case 'unmute': { await react('🔓'); if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); try { await socket.groupSettingUpdate(from, 'not_announcement'); await replyImg(botImg, '🔓 *Group OPEN*'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'close': case 'mute': { await react('🔒'); if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); try { await socket.groupSettingUpdate(from, 'announcement'); await replyImg(botImg, '🔒 *Group CLOSED*'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'tagall': { await react('🫂'); if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); try { const gm = await socket.groupMetadata(from); let mentionsText = ''; gm.participants.forEach(p => { mentionsText += `@${p.id.split('@')[0]}\n`; }); await socket.sendMessage(from, { image: { url: botImg }, caption: `╭───────────────⭓\n│ 👥 ${gm.subject}\n│ Members: ${gm.participants.length}\n│ By: @${nowsender.split('@')[0]}\n│ ${q || 'Hey everyone!'}\n╰───────────────⭓\n\n${mentionsText}`, mentions: [nowsender, ...gm.participants.map(p => p.id)] }, { quoted: msg }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'kickall': case 'removeall': { await react('⚡'); if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); try { const gm2 = await socket.groupMetadata(from); const botJid2 = socket.user?.id; const toRemove = gm2.participants.filter(p => p.admin === null && p.id !== botJid2).map(p => p.id); if (!toRemove.length) return reply('⚠️ No members to remove.'); await reply(`⚠️ Removing ${toRemove.length} members...`); for (let i = 0; i < toRemove.length; i += 50) { await socket.groupParticipantsUpdate(from, toRemove.slice(i, i + 50), 'remove'); await delay(2000); } await reply(`✅ Removed ${toRemove.length} members.`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'link': case 'grouplink': case 'invite': { await react('🔗'); if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); try { const code = await socket.groupInviteCode(from); await reply(`🔗 *Group Link:*\n\nhttps://chat.whatsapp.com/${code}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'admins': { await react('👮'); if (!isGroup) return reply('⚠️ Groups only!'); try { const gm3 = await socket.groupMetadata(from); const adms = gm3.participants.filter(p => p.admin); let txt = `👮 *Admins of ${gm3.subject}:*\n\n`; adms.forEach(a => { txt += `• @${a.id.split('@')[0]}${a.admin === 'superadmin' ? ' 👑' : ''}\n`; }); await socket.sendMessage(from, { text: txt + WM, mentions: adms.map(a => a.id) }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'gcstatus': { await groupStatusUpdate(socket, from, msg, args, reply); break; }
case 'setgname': case 'setgroupname': { if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); if (!q) return reply(`Usage: ${activePrefix}setgname <name>`); try { await socket.groupUpdateSubject(from, q); await reply(`✅ Group name: ${q}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'setgpp': { if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); const qiGpp = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message; if (!qiGpp?.imageMessage && !msg.message?.imageMessage) return reply('❗ Reply to an image.'); try { const imgObj = qiGpp?.imageMessage || msg.message.imageMessage; const s = await downloadContentFromMessage(imgObj, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); await socket.updateProfilePicture(from, b); await reply('✅ Group picture updated!'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'setpp': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); const qiPp = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message; if (!qiPp?.imageMessage && !msg.message?.imageMessage) return reply('❗ Reply to an image.'); try { const imgObj = qiPp?.imageMessage || msg.message.imageMessage; const s = await downloadContentFromMessage(imgObj, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); await socket.updateProfilePicture(socket.user.id, b); await reply('✅ Profile picture updated!'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'vcf': { await reply('This command has been removed.'); break; }
case 'warn': { await react('⚠️'); if (!isGroup) return reply('⚠️ Groups only!'); if (!isSenderGroupAdmin && !isOwner && !isDevOverride) return reply('⚠️ Admins only!'); try { let tu2 = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant; if (!tu2 && msg.quoted) tu2 = msg.quoted.key?.participant; if (!tu2) return reply(`Usage: ${activePrefix}warn @user or reply`); if (tu2 === nowsender) return reply('⚠️ Cannot warn yourself.'); const wr = args.join(' ') || 'No reason'; await socket.sendMessage(from, { text: `⚠️ *WARNING*\n\n👤 User: @${tu2.split('@')[0]}\n📝 Reason: ${wr}\n👮 By: @${nowsender.split('@')[0]}${WM}`, mentions: [tu2, nowsender] }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'bc': case 'broadcast': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); await react('📢'); if (!q) return reply(`Usage: ${activePrefix}bc <message>`); try { const chats = Object.values(socket.chats || {}).filter(c => c.id?.endsWith('@g.us')); if (!chats.length) return reply('⚠️ Not in any groups.'); await reply(`📢 Broadcasting to ${chats.length} groups...`); let ok = 0, fail = 0; for (const chat of chats) { try { await socket.sendMessage(chat.id, { text: `╭─────────────⭓\n│ 📢 *Broadcast*\n│ ${q}\n╰─────────────⭓${WM}` }); ok++; await delay(300); } catch { fail++; } } await reply(`✅ Done!\nSuccess: ${ok}\nFailed: ${fail}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'join': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); if (!args[0]) return reply(`Usage: ${activePrefix}join <invite link>`); await react('👏'); try { const m2 = args[0].match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/); if (!m2) return reply('⚠️ Invalid link.'); const r = await socket.groupAcceptInvite(m2[1]); if (r?.gid) await reply(`✅ Joined! ID: ${r.gid}`); else throw new Error('No gid'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }

// ─── OWNER COMMANDS ───────────────────────────────────────────────────────────
case 'ban': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); const banNum = args[0]?.replace(/[^0-9]/g, '') || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]?.split('@')[0]; if (!banNum) return reply(`Usage: ${activePrefix}ban <number>`); try { let b = []; try { b = JSON.parse(fs.readFileSync(BANS_PATH, 'utf8')); } catch {} if (!b.includes(banNum)) { b.push(banNum); fs.writeFileSync(BANS_PATH, JSON.stringify(b, null, 2)); } await reply(`🚫 ${banNum} banned.`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'unban': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); const unbanNum = args[0]?.replace(/[^0-9]/g, ''); if (!unbanNum) return reply(`Usage: ${activePrefix}unban <number>`); try { let b = []; try { b = JSON.parse(fs.readFileSync(BANS_PATH, 'utf8')); } catch {} b = b.filter(x => x !== unbanNum); fs.writeFileSync(BANS_PATH, JSON.stringify(b, null, 2)); await reply(`✅ ${unbanNum} unbanned.`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'bannedlist': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); try { const bans = JSON.parse(fs.readFileSync(BANS_PATH, 'utf8')); if (!bans.length) return reply('📋 No banned users.'); await reply(`🚫 *Banned (${bans.length}):*\n\n${bans.map((b, i) => `${i + 1}. ${b}`).join('\n')}`); } catch { reply('📋 No banned users.'); } break; }
case 'bio': case 'setbio': { if (!isOwner && !isDevOverride) return reply('⚠️ Owner only!'); if (!q) return reply(`Usage: ${activePrefix}bio <bio>`); try { await socket.updateProfileStatus(q); await reply(`✅ Bio updated: "${q}"`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
// newsletter command removed — auto-join handled on pair
case 'active': { await react('🧑‍💻'); await reply(`👥 *Active Sessions: ${activeSockets.size}*\n\nNumbers:\n${Array.from(activeSockets.keys()).join('\n') || 'None'}`); break; }
case 'deleteme': { const sp3 = path.join(SESSION_BASE_PATH, `session_${sn}`); if (fs.existsSync(sp3)) fs.removeSync(sp3); await deleteSessionFromGitHub(sn); if (activeSockets.has(sn)) { try { activeSockets.get(sn).ws.close(); } catch {} activeSockets.delete(sn); socketCreationTime.delete(sn); } await reply('🗑️ *Session deleted.*'); break; }
case 'uptime': { await reply(`⏱️ *Uptime:* ${getUptime(botStartTime)}`); break; }
case 'datetime': { const dt = getCurrentDateTime(); await replyImg(botImg, `📅 *DATE & TIME*\n\n${dt.formatted}\n\n📆 Day: ${dt.day}\n📅 Date: ${dt.date}\n⏰ Time: ${dt.time}`); break; }
case 'location': { const loc = await getUserLocation(); await replyImg(botImg, `📍 *LOCATION*\n\n🌍 City: ${loc.city}\n🗺️ Region: ${loc.region}\n🏳️ Country: ${loc.country}\n⏰ Timezone: ${loc.timezone}`); break; }
case 'bot_info': {
    await reply(`✦━━━━━━━━━━━━━━━━✦\n🤖 *BOT INFO*\n✦━━━━━━━━━━━━━━━━✦\n📛 *Name:* ${AI_SHORT_NAME}\n📋 *Full Name:* ${AI_FULL_NAME}\n👑 *Developer:* Wild Lirt Studio\n🔢 *Version:* v${config.VERSION}\n🔑 *Prefix:* ${activePrefix}\n🌐 *Mode:* ${isPublicMode() ? 'Public' : 'Private'}\n🤖 *AI:* ${isAiEnabled() ? 'ON' : 'OFF'}\n🎙️ *Voice:* ${isVoiceEnabled() ? 'ON' : 'OFF'}\n✦━━━━━━━━━━━━━━━━✦`);
    break;
}
case 'bot_stats': {
    const st3 = socketCreationTime.get(number) || Date.now(), up3 = Math.floor((Date.now() - st3) / 1000);
    const h3 = Math.floor(up3 / 3600), mn3 = Math.floor((up3 % 3600) / 60), s3 = up3 % 60;
    const u3 = Math.round(process.memoryUsage().heapUsed / 1024 / 1024), t3 = Math.round(os.totalmem() / 1024 / 1024);
    await reply(`✦━━━━━━━━━━━━━━━━✦\n📊 *BOT STATS*\n✦━━━━━━━━━━━━━━━━✦\n⏱️ *Uptime:* ${h3}h ${mn3}m ${s3}s\n💾 *RAM:* ${u3}MB / ${t3}MB\n👥 *Sessions:* ${activeSockets.size} active\n📱 *Number:* ${number}\n🔢 *Version:* v${config.VERSION}\n🌐 *Mode:* ${isPublicMode() ? 'Public' : 'Private'}\n🤖 *AI:* ${isAiEnabled() ? 'ON' : 'OFF'}\n🎙️ *Voice:* ${isVoiceEnabled() ? 'ON' : 'OFF'}\n✦━━━━━━━━━━━━━━━━✦`);
    break;
}
case 'ram': case 'system': { const tm = os.totalmem(), fm = os.freemem(), um = tm - fm; await reply(`*RAM USAGE*\n\nTotal: ${fmtBytes(tm)}\nUsed: ${fmtBytes(um)}\nFree: ${fmtBytes(fm)}\nPlatform: ${os.platform()} (${os.arch()})`); break; }
case 'cpu': { const cpus = os.cpus(); await reply(`*CPU INFO*\n\nModel: ${cpus[0].model}\nSpeed: ${cpus[0].speed} MHz\nCores: ${cpus.length}\nUptime: ${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`); break; }
case 'shazam': case 'whatmusic': {
    await react('🎧');
    const qAudio = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
    const hasAudio = qAudio?.audioMessage || qAudio?.videoMessage || msg.message?.audioMessage;
    if (!hasAudio && !q) return reply(`❗ Reply to audio or provide URL.`);
    try {
        let audioUrl = q || null;
        if (!audioUrl && hasAudio) { const audioObj = qAudio?.audioMessage || qAudio?.videoMessage || msg.message.audioMessage; const s = await downloadContentFromMessage(audioObj, 'audio'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); audioUrl = await uploadAudioToCatbox(b, 'ogg'); }
        let result = null;
        try { const { data } = await axios.get(`${config.ELITE_API}/whatmusic?url=${encodeURIComponent(audioUrl || '')}`, { timeout: 30000 }); result = data?.result || data; } catch {}
        if (!result) { try { result = await paxShazam(audioUrl); } catch {} }
        if (result) { const t = result?.title || result?.track?.title || result?.name || 'Unknown'; const a = result?.artist || result?.track?.subtitle || 'Unknown'; await replyCarousel(`🎧 Shazam Result`, [{ title: `🎵 ${t}`, description: `🎤 Artist: ${a}\n📀 Album: ${result?.album || 'N/A'}`, image: botImg, buttons: [{ display: '🎶 Get Lyrics', id: `${activePrefix}lyrics ${t}` }, { display: '⬇️ Download', id: `${activePrefix}song ${t}` }] }]); }
        else await reply('⚠️ Could not identify the audio.');
    } catch (e) { reply(`⚠️ Shazam error: ${e.message}`); }
    break;
}
case 'base64': { await react('🔐'); if (!q) return reply(`Usage: ${activePrefix}base64 encode/decode <text>`); const sub = args[0]?.toLowerCase(), txt = args.slice(1).join(' '); if (sub === 'encode') await reply(`🔐 *Encoded:*\n\n${Buffer.from(txt).toString('base64')}`); else if (sub === 'decode') { try { await reply(`🔓 *Decoded:*\n\n${Buffer.from(txt, 'base64').toString('utf8')}`); } catch { reply('⚠️ Invalid base64.'); } } else await reply(`Usage: ${activePrefix}base64 encode/decode <text>`); break; }
case 'calc': case 'calculate': { await react('🔢'); if (!q) return reply(`Usage: ${activePrefix}calc <expression>`); try { let result = null; try { const { data } = await axios.get(`${config.DAVID_API}/tools/calculator?expression=${encodeURIComponent(q)}`, { timeout: 10000 }); result = data?.result || data?.answer; } catch {} if (!result) result = eval(q.replace(/[^0-9+\-*/.()% ]/g, '')); await reply(`🔢 *Calculator*\n${q} = ${result}`); } catch { reply('⚠️ Invalid expression.'); } break; }
case 'countries': { await react('🌍'); try { const { data } = await axios.get(`${config.ELITE_API}/countries`, { timeout: 10000 }); const countries = data?.result || data || []; if (!countries.length) return reply('⚠️ No data.'); let txt = q ? '' : `🌍 *World Countries (${countries.length} total)*\n\n`; if (q) { const found = countries.find(c => (c.name || '').toLowerCase().includes(q.toLowerCase())); if (found) txt = `🌍 *${found.name}*\n\nCapital: ${found.capital || 'N/A'}\nPopulation: ${found.population || 'N/A'}\nRegion: ${found.region || 'N/A'}\nCurrency: ${found.currency || 'N/A'}`; else txt = `⚠️ Country "${q}" not found.`; } else { countries.slice(0, 20).forEach(c => txt += `• ${c.name || c}\n`); txt += `\n_Use ${activePrefix}countries <name> for details_`; } await reply(txt); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'report': { if (!q) return reply(`Usage: ${activePrefix}report <message>`); const ownerJid = config.OWNER_NUMBERS[0] + '@s.whatsapp.net'; try { await socket.sendMessage(ownerJid, { text: `📢 *REPORT*\nFrom: @${senderNumber}\nChat: ${from}\nMessage: ${q}${WM}`, mentions: [nowsender] }); await reply('✅ Report sent.'); } catch { reply(`⚠️ Contact: wa.me/${DEVELOPER_NUMBER}`); } break; }
case 'help': { await reply(`📖 *Help*\n\nSend *.menu* — main menu\nSend *.allmenu* — all commands\n\n*Developer:* Nullforge\n*Contact:* wa.me/${DEVELOPER_NUMBER}`); break; }
case 'movie': case 'sm': case 'silent': { if (!q) return reply(`❗ Usage: ${activePrefix}movie <name>`); await react('🎬'); await reply(`🔎 Searching: "${q}"...`); const err = await searchMovies(q, socket, from, msg, fakeCard, botImg); if (err) reply(err); break; }
case 'smsubs': { const movieId = args[0], season = args[1] || 'null', episode = args[2] || 'null'; if (!movieId) return reply('Usage: .smsubs <movieId> [season] [episode]'); const err = await showSubtitleOptions(movieId, season, episode, socket, from, msg); if (err) reply(err); break; }
case 'dlmovie': case 'downloadmovie': { const movieId = args[0], season = (args[1] && args[1] !== 'null') ? args[1] : null, episode = (args[2] && args[2] !== 'null') ? args[2] : null, lang = args.slice(3).join(' '); if (!movieId) return reply('Usage: .dlmovie <movie_id> [season] [episode] [language]'); await react('⏳'); await reply(`⏳ *Fetching Download Links...*`); const err = await downloadMovieFile(movieId, season, episode, lang, socket, from, msg); if (err) reply(err); break; }
case 'wallpaper': case 'wp': { await react('🖼️'); if (!q) return reply(`Usage: ${activePrefix}wallpaper <search>`); try { let imgUrl = null; for (const fn of [async () => { const { data } = await axios.get(`${config.ELITE_API}/wallpaper?query=${encodeURIComponent(q)}`, { timeout: 15000 }); return data?.result?.[0]?.url || data?.images?.[0]?.url; }, async () => { const { data } = await axios.get(`${config.DAVID_API}/search/wallpapers?query=${encodeURIComponent(q)}`, { timeout: 15000 }); return data?.result?.[0]?.url || data?.images?.[0]; }]) { try { const r = await fn(); if (r) { imgUrl = r; break; } } catch {} } if (!imgUrl) return reply('⚠️ No wallpaper found.'); await socket.sendMessage(from, { image: { url: imgUrl }, caption: `🖼️ *Wallpaper: ${q}*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case '4kwallpaper': case '4kwp': { await react('🖼️'); if (!q) return reply(`Usage: ${activePrefix}4kwallpaper <query>`); try { const { data } = await axios.get(`${config.ELITE_API}/4kwallpaper?type=search&query=${encodeURIComponent(q)}`, { timeout: 15000 }); const imgUrl = data?.result?.[0]?.url || data?.images?.[0]; if (imgUrl) await socket.sendMessage(from, { image: { url: imgUrl }, caption: `🖼️ *4K Wallpaper: ${q}*${WM}` }, { quoted: fakeCard }); else reply('⚠️ Not found.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'pinterest': case 'pin': { await react('📌'); if (!q) return reply(`Usage: ${activePrefix}pinterest <query>`); try { let imgs = []; for (const fn of [async () => { const { data } = await axios.get(`${config.DAVID_API}/search/pinterest?query=${encodeURIComponent(q)}`, { timeout: 15000 }); return data?.result || []; }, async () => { const { data } = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?q=${encodeURIComponent(q)}`, { timeout: 15000 }); return data?.result || []; }]) { try { const r = await fn(); if (r?.length) { imgs = r; break; } } catch {} } if (!imgs.length) return reply('⚠️ No results.'); const imgUrl = imgs[0]?.url || imgs[0]; await socket.sendMessage(from, { image: { url: imgUrl }, caption: `📌 *Pinterest: ${q}*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'gimage': case 'googleimage': { await react('🔍'); if (!q) return reply(`Usage: ${activePrefix}gimage <query>`); try { let images = []; for (const fn of [async () => { const { data } = await axios.get(`${config.DISCARD_API}/api/dl/gimage?apikey=guru&query=${encodeURIComponent(q)}`, { timeout: 15000 }); return data?.imageUrls; }, async () => { const { data } = await axios.get(`${config.NEXRAY_API}/search/googleimage?query=${encodeURIComponent(q)}`, { timeout: 15000 }); return data?.result || data?.images; }]) { try { const r = await fn(); if (r?.length) { images = r; break; } } catch {} } if (!images.length) return reply('⚠️ No images found.'); for (let i = 0; i < Math.min(4, images.length); i++) { const imgUrl = typeof images[i] === 'string' ? images[i] : images[i]?.url; if (!imgUrl) continue; await socket.sendMessage(from, { image: { url: imgUrl }, caption: `🖼️ *Google Image ${i + 1}*` }, { quoted: fakeCard }); await delay(1000); } await react('✅'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'npm': case 'npmsearch': { await react('📦'); if (!q) return reply(`Usage: ${activePrefix}npm <package>`); try { const { data } = await axios.get(`https://registry.npmjs.com/-/v1/search?text=${encodeURIComponent(q)}&size=5`, { timeout: 10000 }); if (!data.objects?.length) return reply('No packages found.'); let msg8 = `📦 *NPM: "${q}"*\n\n`; data.objects.slice(0, 5).forEach((p, i) => { msg8 += `${i + 1}. *${p.package.name}* v${p.package.version}\n   ${p.package.description?.substring(0, 80) || ''}\n   👤 ${p.package.publisher?.username || 'unknown'}\n\n`; }); await reply(msg8); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'npmstalk': { await react('📦'); if (!q) return reply(`Usage: ${activePrefix}npmstalk <package>`); try { for (const fn of [async () => { const { data } = await axios.get(`${config.DAVID_API}/stalk/npm?package=${encodeURIComponent(q)}`, { timeout: 15000 }); const r = data?.result || data; return `📦 *NPM: ${q}*\n\nVersion: ${r?.version || 'N/A'}\nDescription: ${r?.description || 'N/A'}\nAuthor: ${r?.author || 'N/A'}\nLicense: ${r?.license || 'N/A'}\n🔗 https://npmjs.com/package/${q}`; }, async () => { const { data } = await axios.get(`https://registry.npmjs.com/${q}`, { timeout: 10000 }); return `📦 *NPM: ${data.name}*\n\nVersion: ${data['dist-tags']?.latest}\nDescription: ${data.description || 'N/A'}\nLicense: ${data.license || 'N/A'}`; }]) { try { const r = await fn(); if (r) { await reply(r); break; } } catch {} } } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'tgstalk': { await react('📱'); if (!q) return reply(`Usage: ${activePrefix}tgstalk <username>`); try { const { data } = await axios.get(`${config.DAVID_API}/stalk/telegram?username=${encodeURIComponent(q)}`, { timeout: 15000 }); const r = data?.result || data; await reply(`📱 *Telegram: @${q}*\n\nName: ${r?.name || 'N/A'}\nUsername: ${r?.username || 'N/A'}\nBio: ${r?.bio || 'N/A'}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'ttstalk': case 'tiktokstalk': { await react('📱'); if (!q) return reply(`Usage: ${activePrefix}ttstalk <username>`); try { const { data } = await axios.get(`${config.ELITE_API}/tiktokstalk?username=${encodeURIComponent(q)}`, { timeout: 15000 }); const r = data?.result || data; await reply(`📱 *TikTok: @${q}*\n\nName: ${r?.nickname || 'N/A'}\nFollowers: ${r?.followers || 'N/A'}\nLikes: ${r?.likes || 'N/A'}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'gitclone': case 'gitdl': { if (!q) return reply(`Usage: ${activePrefix}gitclone <github url>`); await react('📦'); try { const m2 = q.match(/github\.com\/([^\/]+)\/([^\/]+)/i); if (!m2) return reply('⚠️ Invalid GitHub URL.'); const [, user, repoG] = m2; await reply(`Fetching ${user}/${repoG}...`); await socket.sendMessage(from, { document: { url: `https://api.github.com/repos/${user}/${repoG}/zipball` }, fileName: `${user}-${repoG}.zip`, mimetype: 'application/zip', caption: `📦 *GitHub:* ${user}/${repoG}${WM}` }, { quoted: fakeCard }); await react('✅'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'igstory': { if (!q) return reply(`Usage: ${activePrefix}igstory <url>`); await react('📖'); try { const { data } = await axios.get(`${config.DELINE_API}/downloader/igstory?url=${encodeURIComponent(q)}`, { timeout: 30000 }); const url = data?.result?.download_url || data?.url; if (url) await socket.sendMessage(from, { image: { url }, caption: `📖 Instagram Story${WM}` }, { quoted: fakeCard }); else reply('⚠️ No story found.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'threads': { if (!q) return reply(`Usage: ${activePrefix}threads <url>`); await react('📱'); try { const { data } = await axios.get(`${config.DELINE_API}/downloader/threads?url=${encodeURIComponent(q)}`, { timeout: 30000 }); const url = data?.result?.download_url || data?.url; if (url) await socket.sendMessage(from, { video: { url }, mimetype: 'video/mp4', caption: `📱 Threads Video${WM}` }, { quoted: fakeCard }); else reply('⚠️ Failed.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'spotify': { if (!q) return reply(`Usage: ${activePrefix}spotify <url or name>`); await react('🎵'); try { const { data } = await axios.get(`${config.DAVID_API}/download/spotify?url=${encodeURIComponent(q)}`, { timeout: 60000 }); const url = data?.result?.download_url || data?.audio_url; if (url) await socket.sendMessage(from, { audio: { url }, mimetype: 'audio/mpeg', caption: `🎵 Spotify Audio${WM}` }, { quoted: fakeCard }); else reply('⚠️ Failed.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'gdrive': case 'googledrive': { if (!q) return reply(`Usage: ${activePrefix}gdrive <url>`); await react('📂'); try { const { data } = await axios.get(`${config.DAVID_API}/download/googledrive?url=${encodeURIComponent(q)}`, { timeout: 60000 }); const url = data?.result?.download_url || data?.url; if (url) await socket.sendMessage(from, { document: { url }, fileName: data?.result?.name || 'file', caption: `📂 Google Drive${WM}` }, { quoted: fakeCard }); else reply('⚠️ Failed.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'website': { if (!q) return reply(`Usage: ${activePrefix}website <url>`); await react('🌐'); try { for (const fn of [async () => { const { data } = await axios.get(`${config.DAVID_API}/download/website?url=${encodeURIComponent(q)}`, { timeout: 60000 }); return data?.result?.download_url || data?.url; }, async () => { const { data } = await axios.get(`${config.PREXZY_API}/download/saveweb2zip?url=${encodeURIComponent(q)}`, { timeout: 60000 }); return data?.result?.download_url || data?.url; }]) { try { const r = await fn(); if (r) { await socket.sendMessage(from, { document: { url: r }, fileName: 'website.zip', caption: `🌐 Website${WM}` }, { quoted: fakeCard }); break; } } catch {} } } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'snack': case 'snackdl': { if (!q) return reply(`Usage: ${activePrefix}snack <url>`); await react('🍿'); try { const { data } = await axios.get(`${config.GIFTED_TECH_API}/api/download/snackdl?apikey=${config.GIFTED_API_KEY}&url=${encodeURIComponent(q)}`, { timeout: 60000 }); if (!data?.success || !data?.result?.media) return reply('⚠️ Failed.'); const { title, media, thumbnail } = data.result; if (thumbnail) await socket.sendMessage(from, { image: { url: thumbnail }, caption: `🍿 ${title || ''}${WM}` }, { quoted: fakeCard }); await socket.sendMessage(from, { video: { url: media }, mimetype: 'video/mp4', caption: `🍿 Snack Video${WM}` }, { quoted: fakeCard }); await react('✅'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'webtozip': { await react('💻'); if (!q) return reply(`Usage: ${activePrefix}webtozip <url>`); try { const { data } = await axios.get(`${config.NEXRAY_API}/tools/webtozip?url=${encodeURIComponent(q)}`, { timeout: 60000 }); const url = data?.result?.download_url || data?.url; if (url) await socket.sendMessage(from, { document: { url }, fileName: 'website.zip', caption: `💻 Website ZIP${WM}` }, { quoted: fakeCard }); else reply('⚠️ Failed.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'webcopier': { await react('🌐'); if (!q) return reply(`Usage: ${activePrefix}webcopier <url>`); try { const { data } = await axios.get(`${config.ELITE_API}/webcopier?url=${encodeURIComponent(q)}`, { timeout: 30000 }); const html = data?.result || data?.html; if (html) { const tmpHtml = path.join(os.tmpdir(), `web_${Date.now()}.html`); fs.writeFileSync(tmpHtml, html, 'utf8'); await socket.sendMessage(from, { document: fs.readFileSync(tmpHtml), fileName: 'webpage.html', mimetype: 'text/html', caption: `🌐 Webpage: ${q}${WM}` }, { quoted: fakeCard }); try { fs.unlinkSync(tmpHtml); } catch {} } else reply('⚠️ Failed.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'obfuscate': case 'obf': { await react('📝'); if (!q) return reply(`Usage: ${activePrefix}obfuscate <javascript code>`); try { const { data } = await axios.get(`${config.DAVID_API}/tools/jsobfuscator?code=${encodeURIComponent(q)}`, { timeout: 30000 }); const t = data?.result || data?.code; if (t) await reply(`📝 *Obfuscated:*\n\n${t.substring(0, 2000)}`); else reply('⚠️ Failed.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'trackip': case 'ipinfo': { await react('🌐'); if (!q) return reply(`Usage: ${activePrefix}trackip <IP>`); try { const { data } = await axios.get(`${config.NEXRAY_API}/tools/trackip?ip=${encodeURIComponent(q)}`, { timeout: 15000 }); const r = data?.result || data; await reply(`🌐 *IP Info: ${q}*\n\nCountry: ${r?.country || 'N/A'}\nCity: ${r?.city || 'N/A'}\nISP: ${r?.isp || 'N/A'}\nLat: ${r?.lat || 'N/A'}\nLon: ${r?.lon || 'N/A'}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'vcc': case 'ccgen': { await react('💳'); const type = args[0] || 'visa'; try { const { data } = await axios.get(`${config.NEXRAY_API}/tools/vcc?type=${type}`, { timeout: 15000 }); const r = data?.result || data; await reply(`💳 *VCC (${type}):*\n\n${JSON.stringify(r, null, 2).substring(0, 500)}`); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'fancy': case 'font': { await react('🖋'); if (!q) return reply(`Usage: ${activePrefix}font <text>`); try { const { data } = await axios.get(`https://www.dark-yasiya-api.site/other/font?text=${encodeURIComponent(q)}`, { timeout: 15000 }); if (!data?.status || !data?.result) return reply('⚠️ Font API failed.'); const fontList = data.result.map(f => `*${f.name}:*\n${f.result}`).join('\n\n'); await reply(`🎨 *Fancy Fonts:*\n\n${fontList.substring(0, 3000)}`); } catch { try { const { data } = await axios.get(`${config.ELITE_API}/font?text=${encodeURIComponent(q)}`, { timeout: 15000 }); const t = data?.result || data?.fonts; if (t) await reply(`🎨 *Fonts:*\n\n${JSON.stringify(t, null, 2).substring(0, 2000)}`); else reply('⚠️ Failed.'); } catch (e) { reply(`⚠️ ${e.message}`); } } break; }
case 'ytt': case 'yttranscribe': { await react('📝'); if (!q) return reply(`Usage: ${activePrefix}ytt <youtube url>`); try { const { data } = await axios.get(`${config.NEXRAY_API}/tools/yt-transcribe?url=${encodeURIComponent(q)}`, { timeout: 60000 }); const t = data?.result || data?.transcript; if (t) await reply(`📝 *YouTube Transcript:*\n\n${t.substring(0, 3000)}`); else reply('⚠️ Transcription failed.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'readmore': { if (!q) return reply(`Usage: ${activePrefix}readmore <text>`); await socket.sendMessage(from, { text: `${q}\u0085\u0085\u0085\n\n_Read more hidden text_${WM}` }, { quoted: fakeCard }); break; }
// forwarded/viral command removed (channel-related)
// channelid command removed
// fc/follow channel command removed
case 'units': { await react('⚖️'); if (!q) return reply(`Usage: ${activePrefix}units <value> <from> <to>`); const val = parseFloat(args[0]), f2 = args[1]?.toLowerCase(), t2 = args[2]?.toLowerCase(); if (isNaN(val) || !f2 || !t2) return reply('⚠️ Invalid format.'); const conv = { 'km-miles': v => v * 0.621371, 'miles-km': v => v * 1.60934, 'kg-lbs': v => v * 2.20462, 'lbs-kg': v => v * 0.453592, 'm-ft': v => v * 3.28084, 'ft-m': v => v * 0.3048, 'c-f': v => v * 9 / 5 + 32, 'f-c': v => (v - 32) * 5 / 9 }; const key = `${f2}-${t2}`; if (conv[key]) await reply(`⚖️ *Conversion:*\n\n${val} ${f2} = ${conv[key](val).toFixed(4)} ${t2}`); else reply(`⚠️ Conversion "${f2}" to "${t2}" not supported.`); break; }
case 'savestatus': { await react('💾'); if (!msg.quoted) return reply('❗ Reply to a status to save it!'); try { const mediaSt = await downloadMediaMessage(msg.quoted, 'buffer', {}); const fileExt = msg.quoted?.message?.imageMessage ? 'jpg' : 'mp4'; const mimeType = msg.quoted?.message?.imageMessage ? 'image/jpeg' : 'video/mp4'; if (fileExt === 'jpg') await socket.sendMessage(from, { image: mediaSt, caption: `💾 Saved Status${WM}` }, { quoted: fakeCard }); else await socket.sendMessage(from, { document: mediaSt, mimetype: mimeType, fileName: `status_${Date.now()}.${fileExt}`, caption: `💾 Saved Status${WM}` }, { quoted: fakeCard }); await react('✅'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'imdb': { if (!q) return reply(`Usage: ${activePrefix}imdb <movie name>`); await react('⭐'); try { const res = await fetch(`https://api.popcat.xyz/imdb?q=${encodeURIComponent(q)}`); const json = await res.json(); const info = `🎬 *${json.title || 'N/A'}* (${json.year || 'N/A'})\n🎭 Genre: ${json.genres || 'N/A'}\n⭐ Rating: ${json.rating || 'N/A'} (${json.votes || 'N/A'} votes)\n📝 Plot: ${json.plot || 'N/A'}\n🎬 Director: ${json.director || 'N/A'}\n👨‍👩‍👧‍👦 Actors: ${json.actors || 'N/A'}\n⏱️ Runtime: ${json.runtime || 'N/A'}\n📅 Released: ${json.released || 'N/A'}`; if (json.poster) await socket.sendMessage(from, { image: { url: json.poster }, caption: info + WM }, { quoted: fakeCard }); else await reply(info); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'blurface': { await react('🔇'); const qi6 = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message; if (!qi6?.imageMessage && !msg.message?.imageMessage) return reply('❗ Reply to an image'); try { const imgObj = qi6?.imageMessage || msg.message.imageMessage; const s = await downloadContentFromMessage(imgObj, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); const imgUrl = await uploadSmartMedia(b, 'image/jpeg'); const { data } = await axios.get(`${config.NEXRAY_API}/tools/blurface?imageUrl=${encodeURIComponent(imgUrl)}`, { responseType: 'arraybuffer', timeout: 30000 }); await socket.sendMessage(from, { image: Buffer.from(data), caption: `🔇 *Face Blurred!*${WM}` }, { quoted: fakeCard }); } catch (e) { reply(`⚠️ ${e.message}`); } break; }
case 'imagescanner': { await react('🔍'); const qiIs = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message; if (!qiIs?.imageMessage && !msg.message?.imageMessage) return reply('❗ Reply to an image'); try { const imgObj = qiIs?.imageMessage || msg.message.imageMessage; const s = await downloadContentFromMessage(imgObj, 'image'); let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]); const imgUrl = await uploadSmartMedia(b, 'image/jpeg'); const { data } = await axios.get(`${config.DAVID_API}/tools/imagescanner?imageUrl=${encodeURIComponent(imgUrl)}`, { timeout: 30000 }); const result = data?.result || data?.text || data?.description; if (result) await reply(`🔍 *Image Scanner:*\n\n${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}`); else reply('⚠️ Could not analyse image.'); } catch (e) { reply(`⚠️ ${e.message}`); } break; }

// ─── VISION (image + AI analysis) ────────────────────────────────────────────
case 'vision': case 'analyze': case 'describe': {
    await react('🔍');
    const qiVis = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
    const hasImgVis = qiVis?.imageMessage || msg.message?.imageMessage;
    if (!hasImgVis) return reply(`❗ Reply to an image with ${activePrefix}vision [optional question]`);
    try {
        const imgObj = qiVis?.imageMessage || msg.message.imageMessage;
        const s = await downloadContentFromMessage(imgObj, 'image');
        let b = Buffer.from([]); for await (const c of s) b = Buffer.concat([b, c]);
        const imgUrl = await uploadSmartMedia(b, 'image/jpeg');
        const prompt = q || 'Describe this image in detail.';
        await reply('🔍 _Analysing image..._');
        let result = null;
        // Nanobanana vision
        try { const { data } = await axios.get(`${config.DAVID_API}/tools/nanobanana?imageUrl=${encodeURIComponent(imgUrl)}&prompt=${encodeURIComponent(prompt)}`, { timeout: 60000 }); result = data?.result?.text || data?.result?.description || data?.text; } catch {}
        // Nexray EU nanobanana
        if (!result) { try { const { data } = await axios.post(`${config.NEXRAY_EU}/ai/nanobanana`, { imageUrl: imgUrl, prompt }, { timeout: 60000 }); result = data?.result?.text || data?.result?.description || data?.text; } catch {} }
        // Image scanner fallback
        if (!result) { try { const { data } = await axios.get(`${config.DAVID_API}/tools/imagescanner?imageUrl=${encodeURIComponent(imgUrl)}`, { timeout: 30000 }); result = data?.result || data?.text || data?.description; } catch {} }
        // OCR fallback
        if (!result) { try { const { data } = await axios.get(`${config.NEXRAY_API}/tools/ocr?imageUrl=${encodeURIComponent(imgUrl)}`, { timeout: 30000 }); result = data?.result || data?.text; } catch {} }
        if (result) await replyImg(imgUrl, `🔍 *Vision Analysis:*\n\n${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}`);
        else reply('⚠️ Could not analyse image. Try again.');
    } catch (e) { reply(`⚠️ Vision error: ${e.message}`); }
    break;
}

// ─── REPO ─────────────────────────────────────────────────────────────────────
case 'repo': case 'github': {
    await react('💻');
    if (q && !q.startsWith('http')) {
        // Search GitHub repos
        try {
            const { data } = await axios.get(`${config.NEXRAY_API}/search/github?query=${encodeURIComponent(q)}`, { timeout: 15000 });
            const results = data?.result || data?.items || [];
            if (!results.length) return reply(`⚠️ No GitHub repos found for: ${q}`);
            let txt = `💻 *GitHub Search: ${q}*\n\n`;
            results.slice(0, 5).forEach((r, i) => {
                txt += `${i + 1}. *${r.full_name || r.name}*\n⭐ ${r.stargazers_count || 0} | 🍴 ${r.forks_count || 0}\n${(r.description || '').substring(0, 80)}\n🔗 ${r.html_url || r.url || ''}\n\n`;
            });
            await reply(txt.trim());
        } catch (e) { reply(`⚠️ ${e.message}`); }
    } else {
        // Show bot repo
        await replyCarousel('💻 BOT REPOSITORY', [{
            title: '✰𝐚𝐬𝐭𝐫𝐚-𝐱𝐦𝐝߷',
            description: `${AI_FULL_NAME}\n\nDeveloper: Nullforge\nWild Lirt Studio\n\n🔗 https://github.com/wildlirtstudio/necta`,
            image: botImg,
            buttons: [{ display: '⭐ Star Repo', id: 'star_repo' }],
            ctaUrl: { label: '🔗 Open GitHub', url: 'https://github.com/wildlirtstudio/necta' }
        }]);
    }
    break;
}

// ─── YT STALK ─────────────────────────────────────────────────────────────────
case 'ytstalk': case 'ytstalk': {
    await react('📺');
    if (!q) return reply(`Usage: ${activePrefix}ytstalk <channel name or URL>`);
    try {
        const { data } = await axios.get(`${config.DAVID_API}/stalk/youtube?channel=${encodeURIComponent(q)}`, { timeout: 15000 });
        const r = data?.result || data;
        await reply(`📺 *YouTube: ${q}*\n\nName: ${r?.name || 'N/A'}\nSubscribers: ${r?.subscribers || 'N/A'}\nViews: ${r?.views || 'N/A'}\nVideos: ${r?.videos || 'N/A'}\nDescription: ${(r?.description || '').substring(0, 150)}`);
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── NFL ──────────────────────────────────────────────────────────────────────
case 'nfl': {
    await react('🏈');
    try {
        const games = await espnScoreboard('football', 'nfl');
        if (!games.length) return reply('⚠️ No NFL games right now. Season might be off.');
        let txt = `✦━━━━━━━━━━━━━━━━✦\n🏈 *NFL SCORES*\n✦━━━━━━━━━━━━━━━━✦\n`;
        games.slice(0, 8).forEach(g => { txt += `\n🏈 ${g.home} *${g.homeScore} - ${g.awayScore}* ${g.away}\n📍 ${g.status}\n`; });
        txt += `✦━━━━━━━━━━━━━━━━✦`;
        await reply(txt);
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── TEAM SEARCH ──────────────────────────────────────────────────────────────
case 'teamsearch': {
    await react('🔍');
    if (!q) return reply(`Usage: ${activePrefix}teamsearch <team name>`);
    try {
        const d = await sportsdbSearch('searchteams', { t: q });
        const results = d?.teams || [];
        if (!results.length) return reply(`⚠️ No teams found for: *${q}*`);
        let txt = `✦━━━━━━━━━━━━━━━━✦\n🔍 *TEAM SEARCH: ${q}*\n✦━━━━━━━━━━━━━━━━✦\n`;
        results.slice(0, 5).forEach((t, i) => {
            txt += `\n${i+1}. *${t.strTeam}*\n🏆 League: ${t.strLeague || 'N/A'}\n🌍 Country: ${t.strCountry || 'N/A'}\n📅 Founded: ${t.intFormedYear || 'N/A'}\n`;
        });
        txt += `\n✦━━━━━━━━━━━━━━━━✦`;
        await reply(txt);
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── PLAYER SEARCH ────────────────────────────────────────────────────────────
case 'playersearch': {
    await react('👤');
    if (!q) return reply(`Usage: ${activePrefix}playersearch <player name>`);
    try {
        const d = await sportsdbSearch('searchplayers', { p: q });
        const results = d?.player || [];
        if (!results.length) return reply(`⚠️ No players found for: *${q}*`);
        const p0 = results[0];
        let txt = `✦━━━━━━━━━━━━━━━━✦\n👤 *${p0.strPlayer || q}*\n✦━━━━━━━━━━━━━━━━✦\n`;
        txt += `⚽ Team: ${p0.strTeam || 'N/A'}\n🌍 Nationality: ${p0.strNationality || 'N/A'}\n🎯 Position: ${p0.strPosition || 'N/A'}\n🎂 Born: ${p0.dateBorn || 'N/A'}\n📏 Height: ${p0.strHeight || 'N/A'}\n`;
        if (p0.strDescriptionEN) txt += `\n📝 ${p0.strDescriptionEN.substring(0, 200)}...\n`;
        txt += `\n✦━━━━━━━━━━━━━━━━✦`;
        if (p0.strThumb || p0.strCutout) await socket.sendMessage(from, { image: { url: p0.strThumb || p0.strCutout }, caption: txt + WM }, { quoted: fakeCard });
        else await reply(txt);
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── TOP SCORERS ──────────────────────────────────────────────────────────────
case 'topscorers': {
    await react('⚽');
    const lg = (args[0] || 'epl').toLowerCase();
    const leagueId = LEAGUE_IDS[lg] || '4328';
    try {
        // TheSportsDB doesn't have direct top scorers - show standings with goals instead
        const espnLeague = lg === 'laliga' || lg === 'la liga' ? 'esp.1' : lg === 'bundesliga' ? 'ger.1' : lg === 'serie a' ? 'ita.1' : 'eng.1';
        const { data } = await axios.get(`https://site.api.espn.com/apis/v2/sports/soccer/${espnLeague}/standings`, { timeout: 15000 });
        const entries = data?.standings?.[0]?.entries || [];
        if (!entries.length) return reply(`⚠️ No data for *${lg}*. Try: epl, laliga, bundesliga`);
        let txt = `✦━━━━━━━━━━━━━━━━✦\n⚽ *TOP TEAMS (${lg.toUpperCase()})*\n✦━━━━━━━━━━━━━━━━✦\n`;
        entries.slice(0, 10).forEach((e, i) => {
            const pts = e.stats?.find(s => s.name === 'points')?.value || 0;
            const gf = e.stats?.find(s => s.name === 'pointsFor' || s.name === 'goalsFor')?.value || 0;
            txt += `\n${i+1}. *${e.team?.displayName || '?'}* — ${pts}pts (GF: ${gf})`;
        });
        txt += `\n\n✦━━━━━━━━━━━━━━━━✦`;
        await reply(txt);
    } catch (e) { reply(`⚠️ Top scorers data unavailable for ${lg}. Try: .standings ${lg}`); }
    break;
}

// ─── UPCOMING MATCHES ─────────────────────────────────────────────────────────
case 'upcomingmatches': case 'upcoming': {
    await react('📅');
    const lg = (args[0] || 'epl').toLowerCase();
    const espnLeague = lg === 'laliga' || lg === 'la liga' ? 'esp.1' : lg === 'bundesliga' ? 'ger.1' : lg === 'serie a' ? 'ita.1' : lg === 'nba' ? null : 'eng.1';
    try {
        let games = [];
        if (espnLeague) {
            const allGames = await espnScoreboard('soccer', espnLeague);
            games = allGames.filter(g => g.status.includes('Scheduled') || g.status.includes('TBD') || g.status.includes(':'));
            if (!games.length) games = allGames.slice(0, 8); // show all if none are scheduled
        }
        if (!games.length) return reply(`⚠️ No upcoming matches found for *${lg}*. Try: epl, laliga, bundesliga, nba`);
        let txt = `✦━━━━━━━━━━━━━━━━✦\n📅 *UPCOMING (${lg.toUpperCase()})*\n✦━━━━━━━━━━━━━━━━✦\n`;
        games.slice(0, 8).forEach((g, i) => { txt += `\n${i+1}. *${g.home} vs ${g.away}*\n⏰ ${g.status}\n`; });
        txt += `\n✦━━━━━━━━━━━━━━━━✦`;
        await reply(txt);
    } catch (e) { reply(`⚠️ ${e.message}`); }
    break;
}

// ─── HIJACK ───────────────────────────────────────────────────────────────────
case 'hijack': { await reply('This command has been removed.'); break; }


// ─── DEFAULT (TicTacToe moves) ────────────────────────────────────────────────
default: {
    if (/^[1-9]$/.test(command) || /^(surrender|give up)$/i.test(body.trim())) {
        await handleTicTacToeMove(socket, from, nowsender, body.trim());
    }
    break;
}

            } // end switch

        } catch (err) {
            console.error(chalk.red('Command error:'), err);
            try { await socket.sendMessage(msg?.key?.remoteJid || '', { image: { url: config.RCD_IMAGE_PATH }, caption: `⚠️ An error occurred.\n${err.message || ''}${WM}` }); } catch {}
        }
    }); // end ev.on
}

// ─── SETUP AUTO RESTART ───────────────────────────────────────────────────────
function setupAutoRestart(socket, number) {
    let reconnectAttempts = 0; const MAX_RECONNECT = 5;
    socket.ev.on('connection.update', async update => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const sc = lastDisconnect?.error?.output?.statusCode;
            if (sc === DisconnectReason.loggedOut || sc === 401) { await deleteSessionFromGitHub(number); const sp4 = path.join(SESSION_BASE_PATH, `session_${number}`); if (fs.existsSync(sp4)) fs.removeSync(sp4); activeSockets.delete(number); socketCreationTime.delete(number); }
            else { reconnectAttempts++; if (reconnectAttempts <= MAX_RECONNECT) { await delay(Math.min(10000 * reconnectAttempts, 60000)); activeSockets.delete(number); socketCreationTime.delete(number); const m2 = { headersSent: false, send: () => {}, status: () => m2 }; await nectaPair(number, m2).catch(e => console.error(`[${number}] Reconnect fail:`, e.message)); } }
        } else if (connection === 'open') { reconnectAttempts = 0; }
    });
    setInterval(async () => { if (socket?.user?.id && activeSockets.has(number)) { try { await socket.sendPresenceUpdate('available'); } catch {} } }, 45000);
}

// ─── EMPIRE PAIR ──────────────────────────────────────────────────────────────
async function nectaPair(number, res) {
    const sn = number.replace(/[^0-9]/g, '');
    const sp = path.join(SESSION_BASE_PATH, `session_${sn}`);
    await cleanDuplicateFiles(sn);
    const restored = await restoreSession(sn);
    if (restored) { fs.ensureDirSync(sp); fs.writeFileSync(path.join(sp, 'creds.json'), JSON.stringify(restored, null, 2)); }
    const { state, saveCreds } = await useMultiFileAuthState(sp);
    const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });
    try {
        const socket = makeWASocket({ auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) }, printQRInTerminal: false, logger, browser: Browsers.macOS('Safari') });
        socketCreationTime.set(sn, Date.now());
        attachMessageHandler(socket, sn);
        setupAutoRestart(socket, sn);
        setInterval(async () => { if (socket?.user?.id && activeSockets.has(sn)) { try { await socket.sendPresenceUpdate('available'); } catch {} } }, 45000);
        if (!socket.authState.creds.registered) {
            let code, retries = config.MAX_RETRIES;
            while (retries-- > 0) { try { await delay(1500); code = await socket.requestPairingCode(sn); break; } catch (e) { await delay(2000 * (config.MAX_RETRIES - retries)); } }
            if (!res.headersSent) res.send({ code });
        }
        socket.ev.on('creds.update', async () => {
            // Local save only — no external upload of session credentials.
            await saveCreds();
        });
        socket.ev.on('connection.update', async update => {
            if (update.connection !== 'open') return;
            try {
                await delay(3000);
                const userJid = jidNormalizedUser(socket.user.id);
                const groupResult = await joinGroup(socket);
                await joinNewsletter(socket, config.NEWSLETTER_JID);
                activeSockets.set(sn, socket);
                try { await loadUserConfig(sn); } catch { await updateUserConfig(sn, config); }
                await socket.sendMessage(userJid, { image: { url: getRandomBotImage() }, caption: `🤖 *WELCOME TO ${AI_SHORT_NAME}*\n_${AI_FULL_NAME}_\n╭─────────────────────⭓\n│ ✅ Connected!\n│ 📱 ${sn}\n│ 👥 Group: ${groupResult.status}\n│ Type ${config.PREFIX}menu to start\n│ 🤖 AI: ON | 🎙️ Voice: ON\n╰─────────────────────⭓${WM}` });
                let nums = []; if (fs.existsSync(NUMBER_LIST_PATH)) { try { nums = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8')) || []; } catch {} }
                if (!nums.includes(sn)) { nums.push(sn); fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(nums, null, 2)); await updateNumberListOnGitHub(sn).catch(() => {}); }
            } catch (e) { console.error('Connection open error:', e); exec(`pm2 restart ${process.env.PM2_NAME || 'necta-bot'}`); }
        });
    } catch (e) { console.error('Pairing error:', e); socketCreationTime.delete(sn); if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' }); }
}

// ─── STARTUP ──────────────────────────────────────────────────────────────────
(async () => {
    console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan(`║  🤖  ${AI_SHORT_NAME} v${config.VERSION}  🤖  ║`));
    console.log(chalk.bold.cyan(`║  ${AI_FULL_NAME}  ║`));
    console.log(chalk.bold.cyan('║            👑  by Nullforge  👑                  ║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════╝\n'));
    console.log(chalk.red('🔐 Developer Override:'), chalk.bold.red(DEVELOPER_NUMBER), chalk.green('(HARDCODED — always active)'));
    console.log(chalk.yellow('🤖 AI:'), isAiEnabled() ? chalk.green('ON ✅') : chalk.red('OFF'));
    console.log(chalk.yellow('🎙️ Voice:'), isVoiceEnabled() ? chalk.green('ON ✅') : chalk.red('OFF'));
    console.log(chalk.yellow('🌐 Public Mode:'), isPublicMode() ? 'ON' : 'OFF');
    console.log(chalk.yellow('🔧 Prefix:'), getCustomPrefix());

    try { const nums = fs.existsSync(NUMBER_LIST_PATH) ? JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8')) : []; for (const n of nums) { if (!activeSockets.has(n)) { const m = { headersSent: false, send: () => {}, status: () => m }; await nectaPair(n, m).catch(() => {}); console.log(chalk.green(`🔁 Reconnected: ${n}`)); await delay(1000); } } }
    catch { console.log(chalk.yellow('No GitHub sessions to reconnect.')); }

    if (fs.existsSync(SESSION_BASE_PATH)) { for (const name of fs.readdirSync(SESSION_BASE_PATH)) { const full = path.join(SESSION_BASE_PATH, name); if (!fs.lstatSync(full).isDirectory()) continue; if (!fs.existsSync(path.join(full, 'creds.json'))) continue; const num = name.replace(/^session_/, ''); startTelegramSession(null, num, false); } }
    console.log(chalk.bold.magenta(`\n✅ ${AI_SHORT_NAME} is online!\n`));
})();

// ─── EXPRESS ROUTES ───────────────────────────────────────────────────────────
// ═══ Routes the website calls ═══
// TODO (security): wide open right now - add rate limiting + an origin/
// shared-secret check against your Vercel domain before going fully live.
router.post('/pair', async (req, res) => {
    const { phoneNumber } = req.body || {};
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });
    const clean = phoneNumber.replace(/[^0-9]/g, '');
    if (activeSockets.has(clean)) return res.status(200).json({ status: 'already_connected', number: clean });
    try { await nectaPair(clean, res); }
    catch (e) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});
router.get('/status', (req, res) => {
    const { number } = req.query;
    if (number) {
        const clean = number.replace(/[^0-9]/g, '');
        return res.json({ status: activeSockets.has(clean) ? 'connected' : 'disconnected' });
    }
    res.json({ status: activeSockets.size > 0 ? 'connected' : 'disconnected', activeSessions: activeSockets.size });
});

// ═══ Legacy routes (kept for compatibility) ═══
router.get('/', async (req, res) => { const { number } = req.query; if (!number) return res.status(400).send({ error: 'Number required' }); if (activeSockets.has(number.replace(/[^0-9]/g, ''))) return res.status(200).send({ status: 'already_connected' }); await nectaPair(number, res); });
router.get('/active', (req, res) => res.status(200).send({ count: activeSockets.size, numbers: Array.from(activeSockets.keys()) }));
router.get('/ping', (req, res) => res.status(200).send({ status: 'active', bot: config.BOT_NAME, fullName: config.BOT_FULL_NAME, dev: 'Nullforge', activesession: activeSockets.size, version: config.VERSION }));
router.get('/reconnect', async (req, res) => { try { const nums = fs.existsSync(NUMBER_LIST_PATH) ? JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8')) : []; const results = []; for (const n of nums) { if (activeSockets.has(n)) { results.push({ number: n, status: 'already_connected' }); continue; } const m = { headersSent: false, send: () => {}, status: () => m }; try { await nectaPair(n, m); results.push({ number: n, status: 'initiated' }); } catch (e) { results.push({ number: n, status: 'failed', error: e.message }); } await delay(1000); } res.status(200).send({ status: 'success', connections: results }); } catch (e) { res.status(500).send({ error: e.message }); } });
router.get('/connect-all', async (req, res) => { try { if (!fs.existsSync(NUMBER_LIST_PATH)) return res.status(404).send({ error: 'No numbers found' }); const numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH)); const results = []; for (const number of numbers) { if (activeSockets.has(number)) { results.push({ number, status: 'already_connected' }); continue; } const m = { headersSent: false, send: () => {}, status: () => m }; await nectaPair(number, m); results.push({ number, status: 'initiated' }); } res.status(200).send({ status: 'success', connections: results }); } catch (e) { res.status(500).send({ error: e.message }); } });

// ─── CLEANUP ──────────────────────────────────────────────────────────────────
// NOTE: this used to call fs.emptyDirSync(SESSION_BASE_PATH) here, which would
// DELETE every paired session on every restart/redeploy. Removed - sessions
// are meant to persist on disk. (On hosts with ephemeral storage like Render's
// free tier, sessions still won't survive a redeploy regardless - that needs
// a host with a real persistent volume, e.g. Fly.io or Railway.)
process.on('exit', () => { activeSockets.forEach((sock, n) => { try { sock.ws.close(); } catch {} }); });

module.exports = router;