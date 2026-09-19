# ANGRY BALLOON

A landscape-first, real-time team browser game. React + TypeScript renders the interface, a lightweight Canvas renderer runs the arena, and a separate persistent Node 24 WebSocket process authoritatively simulates all matches.

## Hosting and Android

Deploy the persistent multiplayer server in **Northflank Asia South Delhi** using [NORTHFLANK-SETUP.md](NORTHFLANK-SETUP.md). Keep the website on its existing Render/Vercel host and update its backend URL after deploying. Nothing in this source automatically creates a hosting service.

For Android packaging, AdMob integration and Play Store publication, follow [ANDROID-ADS-GUIDE.md](ANDROID-ADS-GUIDE.md). `npm run build:mobile` generates bundled assets for Capacitor when `NEXT_PUBLIC_GAME_SERVER_URL` contains your production HTTPS backend origin. Native SDK installation, ad integration and a signed Android build remain separate steps described in that guide.

## Run locally

Install Node.js 24, then:

```sh
npm install
npm run dev
```

Open the client URL printed in the terminal (normally `http://localhost:5173`). The multiplayer server listens on port 3001. No account is required. Use Create Room in one browser, share its code with three other browser sessions, choose at least two players per crew, then start. “Warm up with labeled bots” is an explicitly labeled practice mode; Bots are always labeled. New private rooms and Quick Play enable bot Builders by default; hosts can disable them. Quick Play offers a bot Builders switch and a Blue/Red/either preference before joining.

`npm run dev:client` and `npm run dev:server` run the processes separately. `npm run typecheck` validates TypeScript. `npm test` runs the authoritative rules and four-client WebSocket integration tests; the integration test opens its own temporary server on port 3099.

## How to play

The top-right battle controls include an enter/exit fullscreen button. Landscape phone layouts use the full viewport, with a side-column lobby and wider dialogs to fit common 19.5:9 sizes (780×360, 844×390 and 932×430). The complete 16:9 game world remains visible inside the wider screen; shared physics and aiming are unchanged. Browser fullscreen availability varies; an unavailable request displays guidance.

- Landscape orientation only. In portrait, controls stop and a rotation prompt covers the game. A shared online match continues for other players; rotating back restores local control.
- Left joystick moves every role. On desktop, use WASD or arrow keys.
- Shooters pull the bow backward and release to fire. The bow by the character and the large right-thumb bow both work. Independent pointer IDs allow moving and aiming together.
- Builders use the right-hand 3×6 selector or tap the actual wall grid. Placement is restricted to their crew's grid, with a server-enforced 500ms cooldown.
- Each Shooter starts with 30 arrows. Popping an enemy earns 1 point. Crates earn no points; marked enemy reward crates grant their destroying Shooter 3 arrows.
- Friendly arrows pass through teammates and friendly walls. Boxes float until destroyed. A shot consumes itself on the nearest valid target.
- Shooters respawn after 0.5s, Builders after 1.5s; each gets 0.5s protection. No automatic ammo regeneration.
- Highest score when time expires wins. A tie enters untimed sudden death. The first pop wins.

## Bot Builders and server matchmaking

Bot Builders default to on in both Quick Play and new private rooms. An explicit off selection is respected. Private-room hosts can toggle **BOT BUILDER** in each crew card before a match. A bot consumes one of that crew's five slots and one room slot. If a human has already chosen Builder, they must choose Shooter before a bot can be added. A host can remove a bot in the lobby; bot rosters are locked during matches. Bots rebuild the same wall grid under the same cooldown and never shoot. A destroyed slot has an additional 0.85-second bot reaction delay so a replacement cannot hide the destruction on the next frame. Human Builders retain their normal 500ms placement cooldown.

Quick Play is handled entirely by the server. It chooses the fullest available public lobby with the same bot preference and room for the requested crew, or creates a new lobby. **Either crew** chooses the smaller crew; an explicit Blue/Red preference is honored. Existing players are never shuffled. Players can change crews and roles while waiting. In bot Builder matches, both crews get one clearly labeled Builder bot; all human players are Shooters. Bots count toward the 4–10 total, so two human opponents plus two opted-in Builders can play 2v2.

The server starts an eight-second matchmaking countdown when both crews have at least two connected players and everyone has a crew. Roster or role changes restart the window; a disconnect or missing crew cancels it. Private rooms, active matches, practice rooms and incompatible bot preferences are excluded. The public-room host cannot change these shared matchmaking settings or bypass automatic start. This matchmaking directory is held by one persistent server process; multiple server instances require shared routing/state before horizontal scaling.

## Architecture and choices

The Canvas renderer is deliberately small instead of pulling in a second game framework alongside React. Its fixed 1280×720 world preserves mirrored geometry at every screen ratio. Client prediction handles movement, reconciles against authoritative positions, and interpolates remote players. Canvas reads each fresh network packet directly; React HUD updates are capped at 10Hz during play. Aim notifications are capped at 10Hz. The server runs a 60Hz fixed simulation and sends compact dynamic frames around 20Hz; lobby/wall changes use revision-triggered snapshots. Broadcasts use elapsed time rather than a simulation tick modulo, and room packets are encoded once for clients sharing a delivery position. A slow socket does not advance its delivery markers until a message is queued, preserving box changes on recovery. Swept collision tests include the visible arrowhead and prevent fast arrows tunneling through targets. Visual prediction stops at enemy walls while waiting for the server hit event. Arrow lifetimes, shot rate, and active arrow count are capped.

The server owns team membership, roles, movement, shots, ammo, walls, collisions, respawns, timers, score and winners. It accepts normalized movement intent and aim vectors, never client-reported hits or scores. One Builder is assigned to any crew missing one at match start. Disconnected slots are retained for 20 seconds; a random secret session token restores role, team, ammo and stats. Permanent departure transfers host and Builder responsibilities.

Guest names are normalized, restricted to letters/numbers/spaces/underscore/hyphen, limited to 16 characters, and checked against a basic profanity list. This is a baseline filter, not comprehensive multilingual moderation. Join connections and messages are bounded; action-level cooldowns, payload size limits, origin checks and idle connection cleanup are enforced.

## Render deployment (alternative)

See [RENDER-SETUP.md](RENDER-SETUP.md) for the complete dashboard walkthrough, exact settings, connection checks and troubleshooting.

The frontend and realtime service are separate. The realtime server MUST run as a persistent Web Service, not a serverless function. `render.yaml` and `Dockerfile.server` are included.

1. Put this source in a Git repository accessible to your Render account.
2. Create a Render **Web Service** with Node 24.
3. Build command: `npm ci --prefix server`
4. Start command: `node server/index.ts`
5. Health check: `/health`
6. Set `NODE_ENV=production`, `TRUST_PROXY=1`, and `ALLOWED_ORIGINS` to the exact HTTPS frontend origin. Multiple origins are comma-separated. Wildcards and HTTP localhost are rejected in production; exact `https://localhost` can be explicitly allowed for a bundled Capacitor Android client. Render provides `PORT` automatically.
7. Set the frontend's `NEXT_PUBLIC_GAME_SERVER_URL` to the server's HTTPS origin, without `/socket`.

The frontend now uses standard Next.js production commands: `npm run build` and `npm start`. Its `/api/game-config` route reads the Node environment and does not require Cloudflare Workers. Local development infers the server from the client host if the variable is absent. See `.env.example` for development and production examples. Never commit actual secrets.

### Frontend on Vercel

Import the same GitHub repository as a Next.js project. Select the folder containing the main `package.json` as the Root Directory, choose Node 24.x, use `npm ci` for installation and `npm run build` for the build. Leave Output Directory at the Next.js default.

Deploy once to obtain the production frontend URL. Set the Render server's `ALLOWED_ORIGINS` to that exact HTTPS origin, without a trailing slash. Then set `NEXT_PUBLIC_GAME_SERVER_URL` in Vercel's Production environment to the Render server's HTTPS origin, without `/socket` or a trailing slash, and redeploy the frontend. Redeploy after changes to this public environment variable because Next.js embeds it in the client build.

### Frontend on Render instead

Create a second Node Web Service from the same repository and project root. Use Node 24, build command `npm ci && npm run build`, and start command `npm run start -- --hostname 0.0.0.0 --port $PORT`. Set `NEXT_PUBLIC_GAME_SERVER_URL` to the realtime server's HTTPS origin. Use this frontend service's HTTPS origin in the realtime server's `ALLOWED_ORIGINS`. Keep the frontend and realtime server as separate services.

The blueprint uses Render's free instance setting to avoid creating a paid subscription without approval. Free services can sleep when idle and take time to wake. For uninterrupted production sessions, choose an always-on paid instance yourself. This service stores active matches in memory: a process restart clears active matches. Run a **single instance** for this version. Scaling to several instances requires room routing and a shared session/room directory; do not enable horizontal autoscaling without that work.

## Phone testing

Keep the computer and phones on the same Wi-Fi. `npm run dev` binds the frontend and backend to the network. Open `http://YOUR-LAN-IP:5173` on each phone and rotate to landscape. Common 192.168.x.x and 10.x.x development origins are accepted. Other networks need an explicit `ALLOWED_ORIGINS` entry. Production mobile testing should use HTTPS. iOS fullscreen/orientation lock and haptics vary by browser; CSS orientation gating and touch controls work independently of those optional APIs.

## Tests and remaining release validation

The automated suite covers player/team limits, minimum counts, one Builder per crew, assignment and role locking, ammo, shot validation, speed normalization, build cooldown and slots, reward ownership, nearest-target collision, friendly walls/fire, one-hit scoring, respawn/protection timing, timed winners/sudden death, rematch, disconnect/return/expiry, floating boxes, and name sanitization. A four-independent-socket integration test covers room sharing, movement, authoritative ammo and reconnection.

The built-in browser preview was used to inspect the home screen, lobby and live practice arena. A real Android/iOS device matrix, real simultaneous touch hardware, 50–150ms network conditions, and sustained multi-room production load still require validation before a production-readiness claim. The preview browser did not reliably apply requested viewport overrides; do not interpret desktop visual checks as physical-device testing.

The optional read-only browser tool was verified with valid input. Its invalid-input browser check was blocked by automatic approval review after an account usage limit was reached.

## Assets and audio

The sky background and transparent 4×2 balloon sprite sheet were made using the built-in Image Generation tool for this game. Character expressions use original sprite variations. Music, effects and four short personality laughs are synthesized with Web Audio after user interaction; no third-party audio samples are included. Settings persist only on the current device. No Angry Birds artwork, sounds, characters, UI or layouts are used.

Full asset prompts are in `ASSET-CREDITS.md`. Runtime constants (including reward probability, gravity, speed, shot force, cooldowns and respawn timers) are in `game/engine.ts`.
