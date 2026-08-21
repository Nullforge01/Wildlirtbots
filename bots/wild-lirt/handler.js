import {
    isOwner, isAdmin, checkCooldown, isWhitelisted,
    loadJson, saveJson, pickRandom, formatUptime, safeCalc, getMessageText
} from './lib/utils.js'

export default async (sock, msg, startTime) => {
    const remoteJid = msg.key.remoteJid

    try {
        // Load DBs fresh every message
        const settings = loadJson('./config/settings.json')
        const content = loadJson('./config/content.json')
        let usersDB = loadJson('./data/users.json')
        let groupsDB = loadJson('./data/groups.json')

        const isGroup = remoteJid.endsWith('@g.us')
        const sender = isGroup ? msg.key.participant : remoteJid
        const senderNum = sender.replace(/[^0-9]/g, '')
        const groupId = isGroup ? remoteJid : null

        const body = getMessageText(msg)
        if (!body) return

        // No-prefix: check if first word is a command
        const args = body.trim().split(/ +/)
        const cmd = args.shift().toLowerCase()
        if (!cmd) return

        const reply = (text, mentions = []) =>
            sock.sendMessage(remoteJid, { text, mentions }, { quoted: msg })

        // Init user in DB
        if (!usersDB.users[sender]) {
            usersDB.users[sender] = {
                name: msg.pushName || 'User',
                xp: 0,
                level: 1,
                messages: 0,
                banned: false,
                warnings: 0,
                lastCommand: 0,
                joined: Date.now()
            }
        }

        const user = usersDB.users[sender]
        user.messages++
        user.xp += 1 // +1 XP per message

        // Ban check
        if (user.banned) return

        // Check if group is public or private mode
        let isPublicMode = settings.public
        if (isGroup && groupsDB.groups[groupId]) {
            isPublicMode = groupsDB.groups[groupId].public
        }

        // Whitelist check - only if not public mode
        if (!isPublicMode && !isWhitelisted(cmd) && !isOwner(senderNum)) {
            return // Silent ignore non-whitelist commands
        }

        // Cooldown check - 3s default
        const cooldown = checkCooldown(sender)
        if (cooldown.onCooldown && !isOwner(senderNum)) {
            return reply(`Slow down. Wait ${cooldown.timeLeft}s`)
        }

        user.xp += 5 // +5 XP per command
        user.level = Math.floor(user.xp / 100) + 1
        user.lastCommand = Date.now()

        // ===== 10 WHITELIST COMMANDS - Always work =====
        switch (cmd) {
            case 'ping':
            case 'p':
            case 'speed': {
                const latency = Date.now() - (msg.messageTimestamp * 1000)
                return reply(`*Pong!* ${latency}ms`)
            }

            case 'info':
                return reply(`*WILD LIRT v2.0.0*\n*Owner:* nullforge\n*Mode:* ${isPublicMode ? 'Public' : 'Private'}\n*Prefix:* None\n*Uptime:* ${formatUptime((Date.now() - startTime) / 1000)}`)

            case 'runtime':
                return reply(`*Uptime:* ${formatUptime((Date.now() - startTime) / 1000)}`)

            case 'owner':
                return reply(`*Owner:* wa.me/${settings.ownerNum}`)

            case 'donate':
                return reply(`*Support the bot:*\nPayPal: paypal.me/nullforge\nBTC: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa`)

            case 'help':
            case 'list':
            case 'menu': {
                const menu = `*WILD LIRT MENU*\n\n` +
                    `*Core* [Always On]\n` +
                    `• ping, info, runtime, owner, donate\n\n` +
                    `*Fun & Utility*\n` +
                    `• quote, joke, fact, roast, truth, dare\n` +
                    `• 8ball, coinflip, dice, reverse, calc\n\n` +
                    `*Mode:* ${isPublicMode ? 'Public - 105 Unlocked' : 'Private - 10 Whitelist'}\n` +
                    `*Uptime:* ${formatUptime((Date.now() - startTime) / 1000)}\n\n` +
                    `${!isPublicMode ? 'Type *public on* to unlock all commands' : 'All 105 commands active'}`
                return reply(menu)
            }
        }

        // ===== STOP HERE IF PRIVATE MODE =====
        if (!isPublicMode && !isOwner(senderNum)) {
            saveJson('./data/users.json', usersDB)
            return
        }

        // ===== 90+ LOCKED COMMANDS - Only work in public mode =====

        // OWNER COMMANDS
        if (isOwner(senderNum)) {
            switch (cmd) {
                case 'public':
                    if (args[0] === 'on') {
                        if (isGroup) {
                            groupsDB.groups[groupId].public = true
                            saveJson('./data/groups.json', groupsDB)
                            return reply('*Public mode activated for this group.* All 105 commands unlocked.')
                        } else {
                            settings.public = true
                            saveJson('./config/settings.json', settings)
                            return reply('*Global public mode activated.* All commands unlocked everywhere.')
                        }
                    }
                    if (args[0] === 'off') {
                        if (isGroup) {
                            groupsDB.groups[groupId].public = false
                            saveJson('./data/groups.json', groupsDB)
                            return reply('*Private mode activated.* Back to 10 whitelist commands.')
                        } else {
                            settings.public = false
                            saveJson('./config/settings.json', settings)
                            return reply('*Global private mode activated.*')
                        }
                    }
                    break

                case 'ban': {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
                    const banUser = mentioned[0] || (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
                    if (!banUser || !usersDB.users[banUser]) return reply('User not found.')
                    usersDB.users[banUser].banned = true
                    saveJson('./data/users.json', usersDB)
                    return reply(`*@${banUser.split('@')[0]} banned.*`, [banUser])
                }

                case 'unban': {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
                    const unbanUser = mentioned[0] || (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
                    if (!unbanUser || !usersDB.users[unbanUser]) return reply('User not found.')
                    usersDB.users[unbanUser].banned = false
                    saveJson('./data/users.json', usersDB)
                    return reply(`*@${unbanUser.split('@')[0]} unbanned.*`, [unbanUser])
                }
            }
        }

        // GROUP ADMIN COMMANDS
        if (isGroup && await isAdmin(sock, groupId, sender)) {
            switch (cmd) {
                case 'antilink':
                    groupsDB.groups[groupId].antilink = args[0] === 'on'
                    saveJson('./data/groups.json', groupsDB)
                    return reply(`*Antilink ${args[0]}*`)
                case 'antidelete':
                    groupsDB.groups[groupId].antidelete = args[0] === 'on'
                    saveJson('./data/groups.json', groupsDB)
                    return reply(`*Antidelete ${args[0]}*`)
                case 'welcome':
                    groupsDB.groups[groupId].welcome.enabled = args[0] === 'on'
                    saveJson('./data/groups.json', groupsDB)
                    return reply(`*Welcome ${args[0]}*`)
            }
        }

        // CONTENT COMMANDS - From content.json
        switch (cmd) {
            case 'quote':
                return reply(`*Quote*\n\n${pickRandom(content.quotes)}`)
            case 'joke':
                return reply(`*Joke*\n\n${pickRandom(content.jokes)}`)
            case 'fact':
                return reply(`*Fact*\n\n${pickRandom(content.facts)}`)
            case 'roast': {
                const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
                const target = mentioned[0] ? `@${mentioned[0].split('@')[0]}` : 'you'
                return reply(`${target} ${pickRandom(content.roasts)}`, mentioned)
            }
            case 'truth':
                return reply(`*Truth*\n\n${pickRandom(content.truths)}`)
            case 'dare':
                return reply(`*Dare*\n\n${pickRandom(content.dares)}`)
        }

        // NEW FUN & UTILITY COMMANDS
        switch (cmd) {
            case '8ball':
            case 'ask':
                if (!args.length) return reply('Ask a yes/no question. Usage: *8ball will it rain today*')
                return reply(`*🎱* ${pickRandom(content.eightball)}`)

            case 'coinflip':
            case 'flip':
                return reply(`*🪙* ${Math.random() < 0.5 ? 'Heads' : 'Tails'}`)

            case 'dice':
            case 'roll': {
                const sides = parseInt(args[0]) || 6
                if (sides < 2 || sides > 1000) return reply('Pick a number of sides between 2 and 1000.')
                return reply(`*🎲* Rolled a ${Math.floor(Math.random() * sides) + 1} (d${sides})`)
            }

            case 'reverse':
                if (!args.length) return reply('Give me text to reverse. Usage: *reverse hello world*')
                return reply(args.join(' ').split('').reverse().join(''))

            case 'calc':
            case 'math':
                if (!args.length) return reply('Usage: *calc (12 + 8) * 3*')
                try {
                    const result = safeCalc(args.join(' '))
                    return reply(`*=* ${result}`)
                } catch (err) {
                    return reply(`Couldn't calculate that: ${err.message}`)
                }
        }

        // USER COMMANDS
        switch (cmd) {
            case 'rank':
            case 'level':
                return reply(`*Level ${user.level}*\n*XP:* ${user.xp}/100\n*Messages:* ${user.messages}`)
            case 'lb':
            case 'leaderboard': {
                const top = Object.entries(usersDB.users)
                    .sort(([, a], [, b]) => b.xp - a.xp)
                    .slice(0, 5)
                    .map(([id, u], i) => `${i + 1}. @${id.split('@')[0]} - Lv${u.level} [${u.xp} XP]`)
                    .join('\n')
                return reply(`*Top 5*\n\n${top}`, Object.keys(usersDB.users).slice(0, 5))
            }
        }

        // Save DBs after every command
        saveJson('./data/users.json', usersDB)
        saveJson('./data/groups.json', groupsDB)

    } catch (e) {
        console.error(e)
        try {
            await sock.sendMessage(remoteJid, { text: 'Error occurred.' }, { quoted: msg })
        } catch { /* ignore secondary failure */ }
    }
}
