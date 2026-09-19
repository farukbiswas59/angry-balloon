# Angry Balloon: Android app, AdMob and Google Play

Guide checked September 19, 2026. This ZIP contains a working **mobile web bundle build** and an example Capacitor configuration. It does not contain a signed APK/AAB, an installed AdMob SDK, live ads, or your developer credentials. The following steps finish that work on your computer. The multiplayer backend remains online in Northflank Delhi.

## 1. Prepare accounts and tools

You need Node.js 24, Android Studio with its Android SDK and bundled JDK, a physical Android phone, a Google Play Console developer account, and an AdMob account. Complete the identity, payments and account verification requested in those dashboards yourself. Keep signing keys and account credentials private.

Choose a permanent package ID you control, for example `com.yourstudio.angryballoon`. Use exactly the same package ID in Capacitor, Play Console and AdMob. Replace examples before generating the Android project.

Use Capacitor 8 with the version-8 AdMob community plugin; they are a compatible major-version pair. The plugin includes the Google Mobile Ads SDK, so do not add a second copy manually. [Plugin installation and compatibility](https://github.com/capacitor-community/admob).

## 2. Build the bundled game

Open a terminal in the extracted project folder, where the main `package.json` is located:

```sh
npm ci
npm install @capacitor/core@8 @capacitor/android@8
npm install --save-dev @capacitor/cli@8
```

Create `.env.production.local` in that folder:

```text
NEXT_PUBLIC_GAME_SERVER_URL=https://YOUR-ACTUAL-NORTHFLANK-BACKEND
```

Use the actual HTTPS origin without a trailing slash. Run:

```sh
npm run build:mobile
```

This writes `mobile-dist`, including the game code, styling and artwork. It reuses the same game screen through `mobile/main.tsx`; no Next.js server is needed inside Android. It does not bundle the multiplayer backend. A network connection is still required to play.

Copy `mobile/capacitor.config.example.json` to **`capacitor.config.json` at the project root**. Change `appId` to your permanent package ID. Keep `webDir` as `mobile-dist`, hostname `localhost`, and Android scheme `https`. Do not set `server.url` to the hosted website: this build packages assets locally. [Capacitor configuration](https://capacitorjs.com/docs/config).

Then run:

```sh
npx cap add android
npx cap sync android
npx cap open android
```

Run `cap add` once. On subsequent updates, run `npm run build:mobile` and `npx cap sync android` before rebuilding the Android app. Commit the generated Android source and updated package lock after setup, excluding build output and signing secrets. [Capacitor Android workflow](https://capacitorjs.com/docs/android).

## 3. Connect and test the native app

In Northflank's runtime variables, allow both your website origin and the bundled Android origin:

```text
ALLOWED_ORIGINS=https://YOUR-WEBSITE,https://localhost
```

Deploy that backend update. `https://localhost` is the local WebView origin; the WebSocket destination is still the real Northflank HTTPS host converted to WSS.

In Android Studio, let Gradle sync, connect a USB-debugging-enabled phone, choose it as the target and click Run. Test two independent phones or one phone and a browser. Check touch movement while dragging the bow, safe areas, rotation, app background/foreground, mobile data, incoming interruptions, reconnect and room sharing. The bundled app copies the room code rather than a localhost invite link.

The game already asks portrait users to rotate. You can request `sensorLandscape` on the main activity in `android/app/src/main/AndroidManifest.xml`, while retaining its existing attributes. Keep the rotation overlay because larger screens and OS versions may handle orientation differently. Keep HTTPS/WSS and the generated Internet permission; do not enable cleartext traffic.

Set app icons, splash artwork and the displayed name before release. Check the chosen Capacitor/Android Studio versions' SDK and JDK requirements. As of this guide, new standard Android apps submitted to Play must target **Android 16 / API 36 or higher**. Check the current requirement again when submitting. [Google Play target API policy](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).

## 4. Set up AdMob

In AdMob, create an Android app using the same package ID. You can begin setup before it is listed in Google Play and link the store listing later. Create an **interstitial** ad unit for natural breaks after matches. Keep a separate record of the app ID (`ca-app-pub-…~…`) and ad unit ID (`ca-app-pub-…/…`); they are different values.

Install the native plugin:

```sh
npm install @capacitor-community/admob@8
npx cap sync android
```

Inside the manifest's existing `<application>` element, add:

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="@string/admob_app_id" />
```

Inside `android/app/src/main/res/values/strings.xml`'s `<resources>`, add your AdMob application ID:

```xml
<string name="admob_app_id">YOUR_ADMOB_APPLICATION_ID</string>
```

Use Google's demo ad units and/or registered test devices while developing. Never click your own live ads. Google provides Android test IDs in its [test-ad documentation](https://developers.google.com/admob/android/test-ads). No ad earnings should be expected from test ads.

## 5. Integrate ads at the end of matches

This is an implementation step, not a dashboard switch. The current game does not call AdMob yet. Add a native-only ad controller after installing the packages above. A practical first release is one interstitial after every third completed match, at least three minutes apart, triggered when the player leaves the results screen. These limits are a suggested product choice, not a Google policy threshold.

Use this lifecycle:

1. After the app UI is ready, check `Capacitor.isNativePlatform()` before any native calls.
2. Initialize AdMob once and request current consent information. Show a consent form when required. Request ads only when `canRequestAds` permits it. If consent or loading fails, continue the game without an ad.
3. Preload the interstitial in the menu using `AdMob.prepareInterstitial({ adId: YOUR_TEST_AD_UNIT_ID })`. Avoid loading work during combat.
4. In `app/page.tsx`, wrap the results screen's **PLAY AGAIN** action. Leave the finished room first, temporarily disable starting a new game, and show a prepared ad only if your completed-match and time limits permit it.
5. Use `InterstitialAdPluginEvents.Dismissed` and `FailedToShow` listeners to release the UI lock and restore game audio. Do not assume `showInterstitial()` resolving means the ad has closed. Register listeners before showing, remove them after use, and prevent duplicate button clicks from opening multiple ads.
6. If no ad is ready, skip it immediately and return to the menu. Reset timing/counting only for an ad actually shown; prepare the next one outside gameplay.

Keep the website path unchanged by guarding calls with the native-platform check. The SDK and controller must not block online room updates. Do not show an interstitial on launch, while aiming, during a countdown, or while a reconnect is trying to restore an active match. Do not put banners near the joystick or bow. Review Google's [interstitial implementation guidance](https://developers.google.com/admob/android/interstitial) and the plugin's [API and event definitions](https://github.com/capacitor-community/admob).

Optional later: rewarded ads for cosmetics outside a match. That requires a real cosmetic inventory and verified reward handling, which this game does not yet implement. Avoid selling a competitive advantage through extra arrows or mid-match revives. Do not claim rewards are supported by this ZIP.

## 6. Consent, privacy and app verification

Configure the applicable consent messages in AdMob's **Privacy & messaging** section. Refresh consent information each app launch and expose a Privacy Choices action when required, using the plugin's `showPrivacyOptionsForm()`. Keep the game playable if ads cannot be requested. Google's [UMP guide](https://developers.google.com/admob/android/privacy) explains consent and `canRequestAds`.

Publish a privacy policy that matches your actual game, server logs, hosting providers, ads SDK and retention practices. Declare **Contains ads** and complete Google Play's Data safety, target audience, content rating and app access sections accurately. If you target children or a mixed audience, implement the applicable age handling and ad settings before release; do not simply choose an older age group to avoid those obligations. See [Google Play Families requirements](https://support.google.com/googleplay/android-developer/answer/9893335).

Create a developer website you control. Put AdMob's exact personalized seller line in its root `/app-ads.txt` file, then add that website to the Play listing. If this game's frontend is your developer website, adding `public/app-ads.txt` and redeploying serves the file at the root. Use your own publisher ID, never an example. Link the Play listing in AdMob and complete app verification/readiness review. Full ad serving depends on those checks. [AdMob app-ads.txt verification](https://support.google.com/admob/answer/14538460?hl=en).

## 7. Build an APK for testing and an AAB for Play

After code, environment or ad changes:

```sh
npm run build:mobile
npx cap sync android
npx cap open android
```

Use Android Studio's build menu to generate a debug APK for direct testing. For publication, select **Generate Signed App Bundle / APK → Android App Bundle**. Create an upload keystore, store it and its passwords securely, and produce a release `.aab`. Enable Play App Signing through Play Console and keep your upload key for future releases. Do not commit the keystore or passwords. Follow the current [Android app-signing guide](https://developer.android.com/studio/publish/app-signing).

Upload the AAB to Play Console's internal testing track first. Supply the name, descriptions, required screenshots/artwork, support contact, privacy policy and declarations. Follow the console's current asset sizes and validation messages. Increase Android `versionCode` for every uploaded release and keep `versionName` meaningful.

For personal developer accounts created after November 13, 2023, Google currently requires a closed test with at least **12 testers continuously opted in for 14 days** before applying for production access. Testers should actually exercise the app and report problems; meeting the duration alone does not guarantee approval. [Google's testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

Test real devices with demo ads, then use registered test devices when validating your own units. Before production, replace demo ad unit IDs with your real units, verify consent behavior, remove debug-only settings and verify the signed release build. Submit to review and roll out gradually after approval.

## 8. Earning money and maintaining the app

After app/ad approval, eligible real impressions can earn revenue. Complete AdMob's payment, identity and tax information as requested. Revenue depends on active players, retention, geography, ad demand, fill rate and impressions; no revenue amount is guaranteed. Do not ask friends to click ads or generate artificial traffic. Track actual earnings and hosting costs in the dashboards.

Keep ad frequency low enough that players return. Watch crashes, failed matches, ping and ad errors after releases. The Northflank server must remain running even though Android has the game assets locally. Backend restarts clear rooms. Changes to bundled frontend code or the backend URL require a new mobile build, Capacitor sync, version increment and release.

## Common problems

| Symptom | Check |
| --- | --- |
| Mobile build asks for a server URL | Set `.env.production.local` to the real backend HTTPS origin, without a trailing slash. |
| Blank app | Run the mobile build before Capacitor sync; verify `webDir=mobile-dist`. Inspect Android Logcat and the WebView console. |
| Browser works but Android reconnects | Allow exact `https://localhost` on the backend and use the example Capacitor hostname/scheme. |
| App crashes after installing AdMob | Check that the manifest references a valid application ID, not an ad unit ID. |
| Native AdMob plugin unavailable | Install the plugin, run Capacitor sync, and rebuild the native app; a normal browser cannot run native ads. |
| No ad appears | Check consent permission, test ad ID, load error callbacks, network access and AdMob readiness. No-fill should never block the game. |
| Old game/backend still appears | Rebuild `mobile-dist`, run sync, increment the native version and install the new build. |

The web and mobile asset builds were checked here. Physical Android testing, Gradle/APK/AAB builds, consent UI and ad delivery still need to be verified after you install the native tools and complete the integration above.
