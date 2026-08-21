# Necta — by Wild Lirt Studio

A WhatsApp bot built on Baileys, developed by **Nullforge**. Pairing happens
on the Wild Lirt Studio website, not in-chat.

## Folder structure

```
necta-bot/
├── index.js              — connection handling, message routing, and the
│                            command switch (289 commands)
├── config.js               — bot name, watermark, image path, API key
│                              loading, owner config (split out of index.js)
├── helpers.js               — small standalone utility functions (byte
│                              formatting, ID generation, time parsing, etc.)
├── package.json             — dependencies
├── .env.example              — copy to .env and fill in your own values
├── commands-list.txt          — plain list of all 289 commands
├── assets/
│   └── necta-logo.png          — used as the bot's image in messages
├── session/                    — empty at rest; per-user WhatsApp auth is
│                                  written here at runtime (session_<number>/)
├── data/                        — empty at rest; per-user settings/config
│                                  get written here at runtime
├── logs/                         — empty; for runtime logs if you add any
└── tmp/, temp/                    — scratch space used during media processing
```

`index.js` requires `config.js` and `helpers.js` at the top, so all three
files need to stay together in the same folder — they're not usable split
apart.

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set OWNER_NUMBER, and any optional API keys you have
npm start
```

On first run it needs `OWNER_NUMBER` (your WhatsApp number, digits only, no
"+") so owner-only commands know who you are — there's no hardcoded owner
baked into the code.

## Pairing

There's no pairing code shown in the terminal or requested in-chat. The
`.pair` command in WhatsApp now just replies telling the user to go to the
Wild Lirt Studio site (`wildlirtstudiobots.com`) to pair — the actual
pairing-code flow lives on your website's backend, same as the standalone
AI-chat script from earlier.

## What changed from the file you uploaded

- **Rebranded** — every reference to the old developer name and product name
  is replaced with **Nullforge** (developer credit) and **Wild Lirt
  Studio**/**Necta** (product). Verified with a full case-insensitive search
  across the codebase — zero hits remain.
- **No more GitHub session sync** — the original pushed every paired user's
  WhatsApp session credentials to a GitHub repo. That's removed entirely;
  sessions are local-only now (`./session/session_<number>/`).
- **No hardcoded owner override** — the original had a phone number baked
  into the code with standing admin access regardless of configuration.
  Owner access now comes only from `OWNER_NUMBER` in your `.env`.
- **No hardcoded API keys** — all third-party keys load from `.env`; none
  ship inside the file. Commands whose key you haven't set will just say
  they're not configured instead of failing oddly.
- **Removed 3 commands**: `vcf` (exported every group member's phone number
  to a downloadable file), `bomb` (mass-messaged a target number on repeat),
  and `hijack` (spammed a target group and overwrote its description) — all
  three enable harassment of people who haven't consented to it, so they're
  disabled rather than shipped under your brand.
- **Logo wired in** — `assets/necta-logo.png` is now the actual image the
  bot sends (welcome message, menu, alive, deleted-message alerts, errors),
  replacing an old external image URL.
- **Split into 3 files** — `config.js` and `helpers.js` pulled out of
  `index.js` for readability. The command switch itself stays in `index.js`
  since splitting that further would mean moving code that closes over
  shared runtime variables, which isn't safely verifiable without a live
  WhatsApp connection to test against.

## Command reference

See `commands-list.txt` for the plain list. Categories at a glance: AI
(`ai`, `gpt4`, `gemini`, `deepseek`, `dalle`, `flux`), media downloads
(`play`, `ytmp3`, `yta`, `ytt`), image tools (`sticker`, `toimg`, `gimage`),
group admin (`kick`, `ban`, `promote`, `demote`, `admins`, `antilink`,
`antidelete`), utility (`calc`, `weather`, `translate`, `tts`), bot info
(`menu`, `help`, `ping`, `alive`), and the owner panel (`nullforge`).

Most of these call third-party scraper/API services that may be slow, rate
limited, or occasionally offline — that's inherent to how they're built,
not something this rebrand changes.
