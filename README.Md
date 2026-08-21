# Wild Lirt Studio - Combined Server

Website + Necta + Wild Lirt, deployed as **one Render service**.
ProCoder X is NOT in here - it stays on its own separate Render deploy
(already live), untouched by this repo.

## How it works

```
wild-lirt-combined/
  public/index.html    ← the website, served statically
  bots/necta/           ← Necta, runs as its own child process
  bots/wild-lirt/       ← Wild Lirt, runs as its own child process
  server.js             ← the only thing Render actually starts
```

`server.js` does three things:
1. Serves `public/index.html` as the website
2. Spawns Necta and Wild Lirt as separate child processes (each keeps
   its own working directory, so all their existing `./session`,
   `./config`, etc. paths keep working exactly like they did standalone)
3. Reverse-proxies `/api/necta/*` and `/api/wild-lirt/*` to each bot's
   internal port

If either bot process crashes, `server.js` restarts just that one after
5 seconds - the website and the other bot keep running.

## ⚠️ Render setup - one setting you must change

Render's default build command is `npm install`, which only installs
the root dependencies (Express, the proxy). **Both bots have their own
`package.json` with their own dependencies that also need installing.**

In the Render dashboard, set the **Build Command** to:

```
npm run install-all
```

(defined in the root `package.json` - it runs `npm install` at the
root, then again inside `bots/necta` and `bots/wild-lirt`)

Leave the **Start Command** as the default (`npm start`, i.e. `node
server.js`).

## Environment variables

Set these once in Render's dashboard - they're shared across both bots
automatically, since child processes inherit the parent's environment:

- `OWNER_NUMBERS` (Necta)
- `BOT_PHONE_NUMBER` (Wild Lirt, if you want it to skip the interactive
  pairing prompt)
- `OPENAI_API_KEY` (optional, both bots use it if present)
- Anything else from `bots/necta/.env.example`

Do **not** set `PORT` yourself - Render sets it automatically for the
main server, and `server.js` assigns internal-only ports (4001, 4002)
to the two bots itself.

## Local testing

```
npm run install-all
npm start
```

Then open `http://localhost:3000`
