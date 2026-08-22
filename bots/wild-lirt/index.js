import pkg from '@whiskeysockets/baileys'
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, fetchLatestWaWebVersion } = pkg
// v7 may have renamed this function - fall back to whichever one actually exists
const getLatestVersion = fetchLatestWaWebVersion || fetchLatestBaileysVersion
import { Boom } from '@hapi/boom'
import pino from 'pino'
import readline from 'readline'
import express from 'express'
import handler from './handler.js'
import events from './core/events.js'

const SESSION_DIR = './session'
// Set BOT_PHONE_NUMBER as an env var to skip the interactive prompt
// (this is how the website backend will drive it once wired up)
const ENV_PHONE_NUMBER = process.env.BOT_PHONE_NUMBER || ''
const PORT = process.env.PORT || 3000

const startTime = Date.now()

// Shared state the /pair and /status routes read from - set once the socket exists
let currentSock = null
let connectionStatus = 'disconnected' // 'disconnected' | 'pairing' | 'connected'

function askQuestion(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    return new Promise((resolve) => rl.question(query, (ans) => { rl.close(); resolve(ans) }))
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
    const { version } = await getLatestVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        // v7 removed printQRInTerminal - we don't use QR anyway, pairing is
        // driven entirely by requestPairingCode() below
        logger: pino({ level: 'silent' }),
        browser: ['Wild Lirt', 'Chrome', '2.0.0']
    })

    currentSock = sock

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'open') {
            connectionStatus = 'connected'
            console.log('[WILD LIRT] Bot is ready!')
            console.log('[MODE] Private - Whitelist active')
            console.log('[PREFIX] None')
        }

        if (connection === 'close') {
            connectionStatus = 'disconnected'
            const statusCode = lastDisconnect?.error instanceof Boom
                ? lastDisconnect.error.output.statusCode
                : null
            const loggedOut = statusCode === DisconnectReason.loggedOut

            console.log('[DISCONNECT]', lastDisconnect?.error?.message || 'connection closed')

            if (loggedOut) {
                console.log('[AUTH] Session logged out. Delete the ./session folder and re-pair.')
            } else {
                console.log('[RECONNECT] Attempting to reconnect...')
                startBot()
            }
        }
    })

    // Group events - welcome/goodbye, antilink, antidelete, antiviewonce
    events(sock)

    // Command handler - all commands
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        for (const msg of messages) {
            if (!msg.message) continue
            if (msg.key.remoteJid === 'status@broadcast') continue
            if (msg.key.fromMe) continue
            try {
                await handler(sock, msg, startTime)
            } catch (err) {
                console.error('[HANDLER ERROR]', err)
            }
        }
    })

    // ===== CLI FALLBACK (local testing only) =====
    // If BOT_PHONE_NUMBER is set and this session isn't paired yet, pair automatically.
    // In production the website's /pair call (below) does this instead.
    if (!sock.authState.creds.registered && ENV_PHONE_NUMBER) {
        connectionStatus = 'pairing'
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(ENV_PHONE_NUMBER.replace(/[^0-9]/g, ''))
                console.log(`[PAIR] Pairing code: ${code}`)
            } catch (err) {
                console.error('[PAIR] Failed to generate pairing code:', err.message)
            }
        }, 3000)
    }
}

// ===== HTTP API - this is what the website's frontend calls =====
const app = express()
app.use(express.json())

// TODO (security): this is wide open right now - lock it down before going live.
// At minimum: rate-limit per IP, and check a shared-secret header or CORS origin
// matching your Vercel domain, so randoms can't trigger pairing codes for numbers
// they don't own.
app.post('/pair', async (req, res) => {
    const { phoneNumber } = req.body
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' })
    if (!currentSock) return res.status(503).json({ error: 'Bot not ready yet, try again shortly' })

    try {
        connectionStatus = 'pairing'
        const code = await currentSock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''))
        res.json({ code })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.get('/status', (req, res) => {
    res.json({ status: connectionStatus })
})

app.listen(PORT, () => {
    console.log(`[API] Pairing endpoint listening on port ${PORT}`)
})

console.log('[INIT] Starting WILD LIRT v2.0.0 (Baileys / pairing-code)...')
startBot()
