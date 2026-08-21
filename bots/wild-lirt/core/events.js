import { loadJson, saveJson } from '../lib/utils.js'

// Short-lived in-memory cache of recent group text messages, used for antidelete
// (Baileys only tells us a message was revoked - it doesn't hand back the original content,
// so we have to have already seen and stored it ourselves)
const messageCache = new Map() // messageId -> { text, senderJid, timestamp }
const CACHE_LIMIT = 500

function cacheMessage(msg, text) {
    if (!text) return
    messageCache.set(msg.key.id, {
        text,
        senderJid: msg.key.participant || msg.key.remoteJid,
        timestamp: Date.now()
    })
    if (messageCache.size > CACHE_LIMIT) {
        const oldestKey = messageCache.keys().next().value
        messageCache.delete(oldestKey)
    }
}

const inviteLinkRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i

export default (sock) => {
    let groupsDB = loadJson('./data/groups.json')

    // 1. GROUP DISCOVERY - initialize a group in the DB the first time we see it
    // (fires when the bot is added to a group, and on startup for groups it's already in)
    sock.ev.on('groups.upsert', (groups) => {
        groupsDB = loadJson('./data/groups.json')
        let changed = false
        for (const g of groups) {
            if (!groupsDB.groups[g.id]) {
                groupsDB.groups[g.id] = {
                    name: g.subject || 'Unknown',
                    public: false,
                    antilink: false,
                    antidelete: false,
                    antiviewonce: false,
                    welcome: { enabled: false, message: 'Welcome @user to @group' },
                    goodbye: { enabled: false, message: 'Goodbye @user' },
                    banned: [],
                    muted: [],
                    added: Date.now()
                }
                changed = true
            }
        }
        if (changed) saveJson('./data/groups.json', groupsDB)
    })

    // 2. WELCOME & GOODBYE - fires on any participant add/remove/promote/demote
    sock.ev.on('group-participants.update', async (event) => {
        const { id: groupId, participants, action } = event
        groupsDB = loadJson('./data/groups.json')
        const groupData = groupsDB.groups[groupId]
        if (!groupData) return

        let groupName = groupData.name
        try {
            const meta = await sock.groupMetadata(groupId)
            groupName = meta.subject
        } catch { /* fall back to stored name */ }

        for (const participantJid of participants) {
            const userTag = `@${participantJid.split('@')[0]}`

            if (action === 'add' && groupData.welcome.enabled) {
                const text = groupData.welcome.message
                    .replace('@user', userTag)
                    .replace('@group', groupName)
                await sock.sendMessage(groupId, { text, mentions: [participantJid] })
            }

            if (action === 'remove' && groupData.goodbye.enabled) {
                const text = groupData.goodbye.message
                    .replace('@user', userTag)
                    .replace('@group', groupName)
                await sock.sendMessage(groupId, { text, mentions: [participantJid] })
            }
        }
    })

    // 3/4/5. ANTILINK, ANTIDELETE (via cache), ANTIVIEWONCE - all watch the same message stream
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return

        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue
            const groupId = msg.key.remoteJid
            if (!groupId?.endsWith('@g.us')) continue

            groupsDB = loadJson('./data/groups.json')
            const groupData = groupsDB.groups[groupId]
            if (!groupData) continue

            // ANTIDELETE - "delete for everyone" arrives as a protocolMessage of type REVOKE (0)
            if (msg.message.protocolMessage?.type === 0) {
                if (!groupData.antidelete) continue
                const originalId = msg.message.protocolMessage.key?.id
                const cached = originalId ? messageCache.get(originalId) : null

                let text = `*Antidelete Detected*\n\n`
                text += `*User:* @${(cached?.senderJid || msg.key.participant || '').split('@')[0]}\n`
                text += `*Deleted Message:*\n${cached?.text || '_Not cached, or it was media_'}`

                await sock.sendMessage(groupId, {
                    text,
                    mentions: cached ? [cached.senderJid] : []
                })
                continue
            }

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
            cacheMessage(msg, text)

            // ANTILINK
            if (groupData.antilink && inviteLinkRegex.test(text)) {
                const senderJid = msg.key.participant
                try {
                    const meta = await sock.groupMetadata(groupId)
                    const participant = meta.participants.find(p => p.id === senderJid)
                    if (participant?.admin) continue // never touch admins

                    await sock.sendMessage(groupId, { delete: msg.key })
                    await sock.groupParticipantsUpdate(groupId, [senderJid], 'remove')
                    await sock.sendMessage(groupId, {
                        text: `@${senderJid.split('@')[0]} removed for sending group links.`,
                        mentions: [senderJid]
                    })
                } catch (err) {
                    console.error('[ANTILINK ERROR]', err.message)
                }
            }

            // ANTIVIEWONCE
            const viewOnceMsg = msg.message.viewOnceMessage?.message || msg.message.viewOnceMessageV2?.message
            if (groupData.antiviewonce && viewOnceMsg) {
                try {
                    const senderJid = msg.key.participant
                    await sock.sendMessage(groupId, {
                        text: `*Antiviewonce*\nFrom: @${senderJid.split('@')[0]}`,
                        mentions: [senderJid]
                    })
                    await sock.sendMessage(groupId, { forward: { key: msg.key, message: viewOnceMsg } })
                } catch (err) {
                    console.error('[ANTIVIEWONCE ERROR]', err.message)
                }
            }
        }
    })
}
