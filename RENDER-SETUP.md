# ANGRY BALLOON — complete Render setup

This guide matches the updated source ZIP. Run two services: the game website (frontend) and the multiplayer server (backend). Players open the website; it connects to the backend for rooms, matchmaking, arrows and boxes. No database is needed for this version.

## 1. Update GitHub

Extract the ZIP and replace the corresponding files in your GitHub repository with the contents of its `angry-balloon` folder. Commit them to the branch you will deploy. Uploading the ZIP itself does not deploy its contents.

Check that `package.json`, `package-lock.json`, `game`, `server`, `app`, `public`, and `scripts` appear at the same level. The `server` folder must contain `index.ts`, `matchmaking.ts`, `package.json`, and `package-lock.json`. Include all root configuration files too.

If these files are at the repository's top level, leave Render's **Root Directory blank**. If you uploaded the outer folder too, set it to `angry-balloon` for both services. Never set it to `server`: the backend imports the shared `game` folder.

This update fixes arrowhead collisions and adds a 0.85-second bot repair delay for destroyed slots. Deploy the updated source to both services. Friendly arrows still pass through their own crew's boxes.

## 2. Create the website first

If your frontend already runs on Render or Vercel, keep it, deploy the updated source, copy its production HTTPS address, and continue to step 3.

Otherwise, in the [Render dashboard](https://dashboard.render.com/), choose **New → Web Service**, select your GitHub repository, and enter:

| Field | Value |
| --- | --- |
| Name | `angry-balloon-web` (or an available name) |
| Language / Runtime | Node |
| Branch | The branch with the updated files |
| Region | A region close to your players |
| Root Directory | Blank, unless your source is nested as explained above |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run start -- --hostname 0.0.0.0 --port $PORT` |
| Health Check Path | `/` |

Add these environment variables:

```text
NODE_VERSION=24
NODE_ENV=production
```

Choose your instance plan, then **Deploy Web Service** (sometimes labeled **Create Web Service**). Wait until it is live and copy the actual HTTPS website address displayed by Render. The homepage should open; online play will connect after step 4.

Use a Node Web Service for this frontend; this project is not configured as a static export. See [Render's Next.js deployment documentation](https://render.com/docs/deploy-nextjs-app).

## 3. Create the multiplayer server

Choose **New → Web Service** again and select the **same repository**. If you already created this game's backend, edit its settings instead.

| Field | Value |
| --- | --- |
| Name | `angry-balloon-realtime` (or an available name) |
| Language / Runtime | Node |
| Branch | The same updated branch |
| Region | A region close to your players |
| Root Directory | Same source root as the frontend; not `server` |
| Build Command | `npm ci --prefix server` |
| Start Command | `node server/index.ts` |
| Health Check Path | `/health` |
| Number of instances | `1` |

Add these environment variables as separate key/value rows:

| Key | Value |
| --- | --- |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` |
| `ALLOWED_ORIGINS` | Your actual frontend HTTPS origin |

For example, `ALLOWED_ORIGINS` might be `https://angry-balloon-web-xxxx.onrender.com`. Replace this example with your real **website** address, not your backend address. Include `https://`; omit trailing slashes, paths and quotes. Do not use `localhost` or `*`. Multiple exact origins can be comma-separated.

Leave `PORT` unset: Render supplies it, and this server listens on it at `0.0.0.0`. Choose your instance plan and deploy. These settings follow Render's [Web Service workflow](https://render.com/docs/web-services) and [Node version setting](https://render.com/docs/node-version).

Once live, copy the backend's public HTTPS address and open it with `/health` added. Expect:

```json
{"status":"ok","rooms":0}
```

The count can be higher if people are playing. The bare backend address returns a blank 404; this is expected. The game uses `/socket` automatically. Render supports [WebSockets](https://render.com/docs/websocket) on Web Services.

## 4. Connect the website to the backend

Open the **website service → Environment** and add:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_GAME_SERVER_URL` | Your actual backend HTTPS origin |

Example: `https://angry-balloon-realtime-xxxx.onrender.com`. Replace it with your real public backend address. Do not append `/socket`, `/health`, or a trailing slash. The client converts HTTPS to a secure WebSocket address itself.

Save and **rebuild/redeploy the website**. Restarting alone is insufficient: Next.js embeds this public variable during the build. Use **Manual Deploy → Deploy latest commit** if necessary. The backend's `ALLOWED_ORIGINS` must contain this website's exact origin.

For an existing Vercel frontend, add the same variable in **Settings → Environment Variables**, select **Production**, and redeploy the production deployment. Keep the backend on Render.

Open the website's `/api/game-config` page. The `url` should match your backend HTTPS origin. Refresh the homepage and play. Share the **website link** with players.

## 5. Test a match

1. Open the production website in two separate browsers or devices. Rotate phones to landscape.
2. Choose **Quick Play** with **bot Builders enabled** on both. Select Blue on one and Red on the other. With two human Shooters and two bot Builders, the same public room should start its eight-second matchmaking countdown.
3. Fire at an **enemy** wall. One arrow should break one box, show particles, and disappear. Bot repairs may begin after 0.85 seconds. Marked reward boxes grant the attacking Shooter three arrows. Boxes do not award points.
4. Confirm both screens show the removal. Your own crew's boxes intentionally ignore your arrows.
5. For a private match, create a room, join its code on the second device, enable one bot Builder for each crew, choose opposite crews and let the host start. Without bots, use at least four humans, two per crew.

Everyone must connect to the same backend to share rooms and matchmaking.

## 6. Troubleshooting

| Problem | Fix |
| --- | --- |
| `vite.config.ts` cannot find `./.openai/hosting.json` | Deploy the latest ZIP's `vite.config.ts`. The Sites metadata file is now optional; Render does not need it. Commit the fix to the connected branch, then deploy the latest commit. |
| Cannot find `server/index.ts`, `game/engine.ts`, or a lock file | Fix Root Directory and upload the extracted source, not only the ZIP. Keep both `server` and `game`. |
| Unknown `.ts` extension | Set backend `NODE_VERSION=24` and redeploy. Check the actual Node version in the deployment log. |
| Startup error about `ALLOWED_ORIGINS` | Set it to the exact production frontend origin on the backend, then redeploy. |
| `/health` works but the game reconnects / WebSocket 403 | Compare the browser's website origin to `ALLOWED_ORIGINS`. Remove trailing slashes. Custom domains and preview URLs need their own exact entries. |
| “Multiplayer server is not connected yet” | Set the frontend's `NEXT_PUBLIC_GAME_SERVER_URL` and rebuild it. Verify `/api/game-config`. |
| Backend URL shows 404 | Expected at `/`. Test `/health` and open the frontend to play. |
| Frontend build cannot find `next` | Use the frontend build command at the main source root, not the backend build command. |
| Frontend Turbopack compiler error | Try `npm ci --include=dev && npm run build -- --webpack` as the frontend build command. This archive was production-build tested with Webpack. |
| No open port | Use the exact start command for the correct service. Leave `PORT` to Render; do not use the development server. |
| First connection is slow | On a free service, open backend `/health`, wait for it to wake and respond, then retry the game. |
| Matchmaking keeps waiting | Both crews need two connected players. With bot Builders enabled, use two humans on opposite crews. Both clients must choose the same bot setting. |
| Boxes still seem unbreakable | Deploy the latest source to both services, refresh browsers, and aim at enemy-colored boxes. Bots rebuild after the reaction delay. |

## Plans, restarts and future updates

Free instances are suitable for trying the game. Render currently sleeps them after 15 minutes without inbound traffic, with wake-up taking about a minute. Its 750 monthly free instance hours are shared across the workspace: two continuously running free services would exceed that allowance. For dependable live play, choose an always-on paid instance. Review [Render's free-service limits](https://render.com/docs/free) before selecting a plan.

Rooms and guest sessions live in backend memory. Deploys, restarts and spin-downs clear them; players must join a new room. Keep **one backend instance**. A database or disk alone will not make multiple instances share live matches.

For future updates, commit source to the connected branch and deploy the latest commit on both services. Schedule backend deployments between matches. The included `render.yaml` defines only the backend and disables automatic deploys; the manual walkthrough above does not require using that Blueprint.
