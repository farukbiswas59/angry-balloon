# Angry Balloon — Android release and Play Store guide

Prepared 7 October 2026 for Faruk Biswas.

## Your files

| File in `outputs/` | Purpose |
| --- | --- |
| `angry-balloon-test.apk` | Install on phones for testing. Uses Google demo ads, never your live ad unit. |
| `angry-balloon-release.apk` | Signed installable release with your live AdMob configuration. |
| `angry-balloon-play-store.aab` | Signed bundle to upload to Google Play Console. An AAB is not directly installable. |
| `angry-balloon-android-source.zip` | Updated source, Android project, build scripts and guides. No signing secrets or SDK caches. |
| `angry-balloon-privacy-website.zip` | A small ready-to-host public developer website, privacy policy and app-ads.txt. |
| `angry-balloon-private-signing-backup.zip` | Private upload key and passwords. Keep off GitHub and out of shared folders. |

Package: `com.angryballoon.farukbiswas`. First release: version name `1.0.0`, version code `1`. Minimum Android 7 / API 24; target Android 16 / API 36. Phones start in landscape and immersive fullscreen. The screen can rotate to either landscape side. Android may control orientation on large or resizable displays.

Developer credit: **Faruk Biswas**. Public support/privacy email: **farukbiswas59@icloud.com**.

## 1. Test on Android phones first

Copy `angry-balloon-test.apk` to your phone and open it. Android may ask you to allow installation from that file manager or browser. Grant that permission only to the app you use to install this file. Use the test APK for development; do not click your own live ads.

Test the loading screen, age screen, landscape rotation, fullscreen button, controls, settings, sound, online Quick Play, private room, practice, ending a match and reconnecting. Ads are eligible when leaving results after at least three completed online matches, with at least three minutes between ads. They appear only if consent permits requests and an ad has loaded; no ad is guaranteed for every eligible exit. They do not appear during gameplay, at launch, or on a local-match exit.

Test APK and release APK use different signing certificates. You must uninstall the test APK before installing the release APK; uninstalling clears local preferences. A Play-installed app may also use a different certificate from the locally signed APK because Play App Signing signs delivered APKs. Use Play’s testing track to test the exact Play distribution.

The automated checks cover simulation, networking, matchmaking, LAN room rules, ad frequency, builds, signatures and phone-sized layouts. Two physical Android devices still need to verify native LAN connectivity and actual Google demo-ad presentation before publication.

## 2. Same-Wi-Fi / hotspot play

1. Install the APK on all participating Android phones.
2. Connect them to the same Wi-Fi network. Alternatively, one phone can turn on its hotspot and friends connect to it. The game does not create a hotspot or ask for its password.
3. On the host phone, tap **SAME WI-FI / HOTSPOT → HOST ON THIS PHONE**. Enter an invented nickname, keep bot Builders on, and tap **HOST LOCAL ROOM**.
4. The lobby shows the host’s private address, for example `192.168.43.1:3001`, and its five-character room code. If more than one address is shown, use the address belonging to the Wi-Fi/hotspot network your friends joined.
5. Friends open **Same Wi-Fi / Hotspot**. Available rooms appear automatically as **Faruk’s room · AB7K9**; tap **JOIN** beside the desired room. If discovery is blocked, choose **MANUAL**, enter the host address and room code, and join.
6. Choose crews. With bot Builders on, two humans plus two Builder bots satisfy the four-player minimum. Each crew needs two members. The host starts the battle.
7. Keep the host phone in the game with its screen on. Switching apps, closing the host, or turning off its network can interrupt or end the room. There is no host migration to another phone.

No internet is required for local gameplay. Startup may spend up to six seconds checking ad privacy information when offline, then continues without ads. LAN packets use private-IP sockets without transport encryption; use a trusted network. Guest Wi-Fi, client/AP isolation and some hotspots block communication between connected devices. If join fails, use a normal private router or another hotspot, check the host address and disable client isolation on your own router.

### Optional laptop host

The Android join screen also connects to the existing Node server on your laptop. With Node 24 installed, run from the source folder:

```sh
npm run install:ci
ALLOWED_ORIGINS=https://localhost PORT=3001 node server/index.ts
```

Find the laptop’s private Wi-Fi IPv4 address in its network settings. Allow incoming port 3001 on your own laptop firewall. Start the laptop browser frontend in a second terminal with `NEXT_PUBLIC_GAME_SERVER_URL=http://127.0.0.1:3001 npm run dev:client` and use Create Room there. Add the printed browser origin to ALLOWED_ORIGINS when starting the server. Android phones choose **MANUAL** under **Same Wi-Fi / Hotspot** using the laptop address and code. Example origins: `https://localhost,http://192.168.1.10:5173,http://localhost:5173`. Do not expose this local service through router port forwarding.

## 3. Keep the online backend running

The app is bundled locally; it does not load the game UI from a remote website. Online matches connect to:

`https://p01--angry-balloon-realtime--r47759lh7q88.code.run`

Its health endpoint and WSS handshake were verified during preparation, including the Android origin `https://localhost`. Keep that exact origin in Northflank’s `ALLOWED_ORIGINS` alongside your web game’s origin. Keep one backend instance because rooms live in memory. Deploying or restarting the backend clears active rooms. See `NORTHFLANK-SETUP.md` for deploying to Delhi; the existing service was last verified in US Central.

## 4. Publish the privacy policy and developer website

The app includes **Settings → Privacy Policy**, which opens the bundled notice. Play Console also needs a public web URL that works without login.

**Use your existing game website:** upload the updated source and redeploy its frontend. `public/privacy.html` and `public/app-ads.txt` will be available at `/privacy.html` and `/app-ads.txt`. Use the website root as your Play developer website and `/privacy.html` as the privacy-policy URL. Do not use the Northflank realtime server URL: that service currently serves only its health endpoint and sockets.

**If you need a separate website:** unzip `angry-balloon-privacy-website.zip`. The files are ordinary static HTML and text. Host all three files at the root of one public HTTPS website using your preferred static host. A GitHub Pages user site can do this:

1. In your GitHub account, create a **public** repository named exactly `farukbiswas59.github.io`. If it already exists, preserve its existing website and add only the needed files.
2. Upload `index.html`, `privacy.html` and `app-ads.txt` to the repository root and commit them to `main`.
3. Open **Settings → Pages**, choose **Deploy from a branch → main → /(root)**, then save.
4. Wait for the Pages deployment and verify the following addresses in a browser:
   - Developer website: `https://farukbiswas59.github.io/`
   - Privacy policy: `https://farukbiswas59.github.io/privacy.html`
   - Ads authorization: `https://farukbiswas59.github.io/app-ads.txt`

A project Pages site under `/some-repository/` is insufficient for app-ads.txt unless you also place app-ads.txt at the hostname root. [GitHub Pages user-site instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

Review the notice against your actual hosting/log-retention settings before publishing it. Update it if you add chat, accounts, analytics, purchases or other data collection.

## 5. Finish AdMob setup

The release already contains:

- App ID: `ca-app-pub-2361597034032285~3738757342`
- Interstitial unit: `ca-app-pub-2361597034032285/1271631240`
- Native Google Mobile Ads SDK and UMP consent handling.
- A neutral age-range screen for the mixed audience. The range is stored only on the device.
- G-rated, non-personalized requests with child-directed and under-age treatment for every player.
- Advertising-ID and AdServices ad-ID/attribution/topics permissions removed from the merged manifest.

In AdMob, confirm the Android app and interstitial unit match this package. Configure and publish any applicable messages in **Privacy & messaging**. The app checks consent on startup; when UMP requires privacy options, Settings exposes the action. [Google UMP setup](https://developers.google.com/admob/android/privacy).

Host this line at your developer website’s root `/app-ads.txt`:

```text
google.com, pub-2361597034032285, DIRECT, f08c47fec0942fa0
```

Compare it with the personalized snippet in your own AdMob account. Put the developer website root in the Play listing, link the published Play listing to the existing AdMob app, and complete any AdMob app-readiness or ownership verification tasks shown in your account. New apps may have limited/no ad serving until Google’s checks complete. [AdMob app-ads.txt setup](https://support.google.com/admob/answer/9363762?hl=en).

Because you target children as well as teens/adults, complete Play’s Families declarations and use only compatible/self-certified mediation sources if you later add mediation. This build uses Google AdMob directly and treats all players conservatively; it does not personalize ads for adult players. [Families ads requirements](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en), [AdMob Families configuration](https://support.google.com/admob/answer/6223431?hl=en), [certified SDK list](https://support.google.com/googleplay/android-developer/answer/12955712?hl=en).

## 6. Create the Play Console app

1. Sign in to Google Play Console and complete the account’s developer/device verification requirements.
2. Choose **Create app**. Name: **Angry Balloon**. Select your language, **Game**, and your free/paid choice. This build has ads and no purchases.
3. Complete the main store listing: descriptions, public support email, developer website, app icon, feature graphic and actual-device screenshots. The package ID is established by your first uploaded bundle and should remain `com.angryballoon.farukbiswas`.
4. Complete **App content**: privacy-policy URL, **Contains ads: Yes**, app-access instructions (no login required), content-rating questionnaire and accurate target ages. Your primary ages 10–18 span Play’s 9–12, 13–15, 16–17 and 18+ ranges. Select younger ranges only if those children are genuinely part of your target audience; an “all ages” rating is not the same as targeting every age group.
5. Complete **Data safety** using both the game’s data handling and the advertising SDK disclosure. Do not select “no data collected” merely because there is no account. Consider nickname/room data, app interactions, diagnostics and IP-derived approximate location; review SDK identifiers with the restrictions in this build. No advertising-ID permission is present. Internet gameplay and Google SDK traffic are encrypted; the optional LAN mode is not, so do not claim all transmitted data is encrypted without accounting for that mode. [Google SDK disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure).
6. Set up Play App Signing. Let Google generate/manage the **app signing key**. The supplied private key is your separate **upload key**.
7. Open **Test and release → Testing → Internal testing → Create new release**. Upload `angry-balloon-play-store.aab`, enter release notes, review and roll out to your internal testers.
8. Install from the Play testing link, review the pre-launch report, and test online play, offline LAN and ads on real devices.

For personal developer accounts created after 13 November 2023, production access generally requires a closed test with at least **12 opted-in testers continuously for 14 days**, then an application for production access. Internal testing alone does not satisfy that requirement. Follow the exact tasks shown for your account. [Current testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

The bundle targets API 36, matching the current new-app target requirement. [Google Play target API requirement](https://support.google.com/googleplay/android-developer/answer/11926878).

## 7. Publish and update

After the account’s testing requirements are met and issues resolved, create a Production release using the signed AAB and submit for review. Google determines approval and ad availability; a successful build alone does not complete publication.

For every update, keep the package ID and upload key, increase `versionCode`, update `versionName` in `mobile/android-config.json`, and build a new AAB. If you change the backend URL, update `serverUrl` in that file and rebuild the app. Backend code can otherwise be deployed independently when the network protocol remains compatible.

## Rebuild from source

Install Node 24, JDK 21, Android SDK platform 36 and build-tools 35.0.0/36.0.0. Android Studio can supply the JDK and SDK. Set `JAVA_HOME` and `ANDROID_HOME` to the actual paths. On the original Mac, the scripts also detect the local tools in `work/`; these caches are not included in the source ZIP.

```sh
npm run install:ci
npm run build:android:debug
```

For a release, restore the private key outside your source repository and create ignored `android/signing.properties`:

```properties
storeFile=/absolute/private/path/angry-balloon-upload.jks
storePassword=YOUR_PRIVATE_STORE_PASSWORD
keyAlias=angryballoon-upload
keyPassword=YOUR_PRIVATE_KEY_PASSWORD
```

Then run:

```sh
npm run build:android:release
```

The release script validates configuration, builds the mobile assets, syncs Capacitor, signs the APK/AAB, runs Android release lint and copies the deliverables to `outputs/`. Debug builds force Google demo ad IDs in both the manifest and web bundle. Keep signing.properties, the keystore, SDK caches and signing backup private; they are excluded from the source archive.
