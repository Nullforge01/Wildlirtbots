import fs from 'fs'
import moment from 'moment'

const settings = JSON.parse(fs.readFileSync('./config/settings.json', 'utf8'))

// Check if sender is bot owner
export const isOwner = (num) => {
    const sender = num.replace(/[^0-9]/g, '')
    return sender === settings.ownerNum
}

// Check if sender is a group admin - needs a live socket to fetch group metadata
export const isAdmin = async (sock, groupId, participantJid) => {
    try {
        const metadata = await sock.groupMetadata(groupId)
        const participant = metadata.participants.find(p => p.id === participantJid)
        return participant?.admin === 'admin' || participant?.admin === 'superadmin'
    } catch {
        return false
    }
}

// Cooldown system - 3s default
const cooldowns = new Map()
export const checkCooldown = (userId) => {
    if (cooldowns.has(userId)) {
        const expiration = cooldowns.get(userId)
        if (Date.now() < expiration) {
            const timeLeft = ((expiration - Date.now()) / 1000).toFixed(1)
            return { onCooldown: true, timeLeft }
        }
    }
    cooldowns.set(userId, Date.now() + (settings.cooldown * 1000))
    return { onCooldown: false }
}

// Format uptime for menu: 4h 08m 12s
export const formatUptime = (seconds) => {
    const duration = moment.duration(seconds, 'seconds')
    const h = Math.floor(duration.asHours())
    const m = duration.minutes()
    const s = duration.seconds()
    return `${h}h ${m}m ${s}s`
}

// Random array picker for content.json
export const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)]

// Check if command is whitelisted
export const isWhitelisted = (cmd) => {
    return settings.whitelist.includes(cmd.toLowerCase())
}

// Save JSON files safely
export const saveJson = (path, data) => {
    fs.writeFileSync(path, JSON.stringify(data, null, 2))
}

// Load JSON files
export const loadJson = (path) => {
    return JSON.parse(fs.readFileSync(path, 'utf8'))
}

// Pull plain text out of a Baileys message, whatever type it is
export const getMessageText = (msg) => {
    const m = msg.message
    if (!m) return ''
    return m.conversation
        || m.extendedTextMessage?.text
        || m.imageMessage?.caption
        || m.videoMessage?.caption
        || ''
}

// Safe arithmetic evaluator for the calc command - digits, + - * / ( ) . and spaces only
export const safeCalc = (expr) => {
    const cleaned = expr.replace(/\s+/g, '')
    if (!/^[0-9+\-*/().]+$/.test(cleaned)) {
        throw new Error('Only numbers and + - * / ( ) are allowed')
    }
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${cleaned})`)()
    if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid expression')
    }
    return result
}
