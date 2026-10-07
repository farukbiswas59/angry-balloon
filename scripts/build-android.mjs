import { readFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const release = process.argv[2] === 'release';
const config = JSON.parse(readFileSync(path.join(root, 'mobile/android-config.json'), 'utf8'));
if (release) {
  if (!existsSync(path.join(root, 'android/signing.properties'))) throw Error('Release needs android/signing.properties and your private upload key. See ANDROID-RELEASE-GUIDE.md.');
  if (config.adsMode !== 'live' || !/^ca-app-pub-\d{16}~\d{10}$/.test(config.admobAppId) || !/^ca-app-pub-\d{16}\/\d{10}$/.test(config.interstitialAdId) || config.admobAppId.includes('3940256099942544')) throw Error('Release needs your real AdMob IDs and adsMode: live.');
  if (!['children','adults'].includes(config.audience)) throw Error('Confirm the audience before a release build.');
  const url = new URL(config.serverUrl);
  if (url.protocol !== 'https:' || url.hostname === 'localhost') throw Error('Release needs a public HTTPS multiplayer backend.');
}
const env = { ...process.env };
const localJava = path.join(root, 'work/android-tools/jdk/Contents/Home');
const localSdk = path.join(root, 'work/android-sdk');
if (!env.JAVA_HOME && existsSync(localJava)) env.JAVA_HOME = localJava;
if (!env.ANDROID_HOME && existsSync(localSdk)) env.ANDROID_HOME = localSdk;
if (!env.JAVA_HOME || !env.ANDROID_HOME) throw Error('Set JAVA_HOME to JDK 21 and ANDROID_HOME to your Android SDK.');
env.GRADLE_USER_HOME ||= path.join(root, 'work/gradle');
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run(process.execPath, ['node_modules/vite/bin/vite.js','build','--config','vite.mobile.config.ts','--mode',release?'production':'android-test']);
run(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor','sync','android']);
run('./gradlew', release ? [':app:assembleRelease',':app:bundleRelease',':app:lintRelease','--console=plain'] : [':app:assembleDebug','--console=plain'], path.join(root,'android'));
const out = path.join(root,'outputs'); mkdirSync(out,{recursive:true});
if (release) {
  copyFileSync(path.join(root,'android/app/build/outputs/apk/release/app-release.apk'),path.join(out,'angry-balloon-release.apk'));
  copyFileSync(path.join(root,'android/app/build/outputs/bundle/release/app-release.aab'),path.join(out,'angry-balloon-play-store.aab'));
} else copyFileSync(path.join(root,'android/app/build/outputs/apk/debug/app-debug.apk'),path.join(out,'angry-balloon-test.apk'));
console.log(`Android ${release?'release APK and Play Store AAB':'test APK'} saved to outputs/.`);
