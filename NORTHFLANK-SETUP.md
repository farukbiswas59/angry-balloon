# Move the multiplayer server to Northflank Delhi

The game is prepared for this move. Nothing has been deployed in your account. Your website can stay on Render or Vercel; only its backend address changes.

## 1. Upload this update

Extract the source ZIP, replace the corresponding files in your GitHub repository, and commit them. Include the new `server/broadcast.ts` and updated `Dockerfile.server`. Upload extracted source, not the ZIP itself.

## 2. Create the Delhi project

Sign in to [Northflank](https://app.northflank.com/), connect your GitHub account, and create a project named `angry-balloon-delhi`. Select **Asia South Delhi**, region ID **`asia-south-delhi`**. Project regions cannot be changed later, so an existing project in another region needs to be replaced by a new Delhi project. Confirm Delhi is offered to your account before proceeding. [Northflank region documentation](https://northflank.com/docs/v1/application/run/deploy-to-a-region).

## 3. Create a combined service

Inside that project, create a **combined service** that builds a Git repository and continuously deploys its image. Select your updated repository and branch. [Northflank build/deploy walkthrough](https://northflank.com/docs/v1/application/getting-started/build-and-deploy-your-code).

| Setting | Value for this game |
| --- | --- |
| Name | `angry-balloon-realtime` |
| Build method | Dockerfile |
| Dockerfile location | `/Dockerfile.server` at the source root |
| Build context | Repository/source root, containing both `game` and `server` |
| Runtime command | Leave the image's default command: `node server/index.ts` |
| Instances / replicas | **1** |
| Container port | **3001** |
| Public port protocol | **HTTP**, with public HTTPS exposure |
| Health check | HTTP GET `/health` on port 3001 |

If GitHub contains an outer `angry-balloon` folder, use that folder as the build context and select its `Dockerfile.server`. Do not use `server` as the context. The Dockerfile already installs Node 24 and the backend dependencies.

Choose an always-running compute plan with enough CPU and memory for your expected player count. Start small, monitor resource usage during real matches, and increase CPU/memory if needed. Review the price before confirming. Keep horizontal autoscaling and scale-to-zero disabled for this version.

## 4. Set runtime variables

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `TRUST_PROXY` | `1` when using Northflank's public HTTP proxy |
| `ALLOWED_ORIGINS` | Your exact public website origin, e.g. `https://your-game.vercel.app` |

Use your actual website origin, not that example. No trailing slash, paths, quotes or wildcard. Multiple allowed origins are comma-separated.

For the bundled Android client described in `ANDROID-ADS-GUIDE.md`, additionally allow `https://localhost`:

```text
ALLOWED_ORIGINS=https://your-game.vercel.app,https://localhost
```

This HTTPS localhost origin belongs to Capacitor's bundled WebView, not to the remote backend. Ordinary development HTTP localhost remains rejected in production. This allowlist is an origin check, not user authentication.

Expose the HTTP port publicly and copy the HTTPS hostname Northflank assigns to it. Open `https://YOUR-BACKEND-HOST/health`. Expect a response containing `"status":"ok"`. A 404 at the bare `/` path is normal. The game upgrades `/socket` to a secure WebSocket through the same public hostname. Do not use Northflank's internal service address in the browser.

## 5. Switch the website

On the existing frontend host, change:

```text
NEXT_PUBLIC_GAME_SERVER_URL=https://YOUR-BACKEND-HOST
```

Use the actual Northflank public origin with no `/socket`, `/health`, port suffix or trailing slash. **Rebuild and redeploy the frontend**, because Next.js embeds this public value at build time. `/api/game-config` on the website should then show the new backend origin.

Move between matches: active Render rooms do not transfer. Ask everyone to refresh the updated website and create/join a new room. Keep the old Render service available during your checks, then stop it once the Northflank version is verified. Keeping some players on each backend splits matchmaking into two independent groups.

## 6. Verify from actual devices

Open the website on two devices. Bot Builders are now enabled by default in Quick Play and new private rooms. Choose opposite crews in Quick Play; two humans and two Builders form a 2v2 room. Check movement, shots, box destruction, and reconnection.

Compare the in-game ping on the same devices and network before and after the move. Also compare Wi-Fi with mobile data and watch Northflank CPU/memory graphs. Delhi should shorten the network route for many Indian players, but geography alone does not guarantee a particular ping or frame rate.

If `/health` is unreachable, check deployment logs, public HTTP port 3001, and the health check. If health works but joining fails, compare the website origin to `ALLOWED_ORIGINS`; check the frontend was rebuilt with the new URL. If matchmaking separates friends, confirm all devices use the same backend and bot preference.

## What changed to reduce avoidable lag

- Server broadcasts follow a 50ms schedule, independently of the 60Hz simulation. The old tick-modulo gate could skip updates during catch-up.
- Clients in the same room reuse serialized packets instead of encoding the same state separately for every player.
- Slow connections skip stale updates without advancing their wall/event delivery markers. When the queue drains they receive current state, including box changes.
- The Canvas reads fresh network state directly. The surrounding React HUD refreshes at most ten times per second during play, with immediate phase/connection changes.
- Aim notifications are capped at ten per second; pointer tracking and drawing remain responsive.

The automated tests verify shared encoding and recovery from a congested send queue. They do not establish a measured production latency reduction. Packet loss, device rendering speed and hosting CPU still matter.

## Operating limits

Rooms and sessions are in one process's memory. A restart or deployment clears them. Use one replica; multiple replicas require shared room routing and state. Schedule deploys between matches. The service does not need a database or disk for its current rules.
