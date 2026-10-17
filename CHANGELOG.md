# Angry Balloon changelog

## 1.4.1 (Android version code 9) — 15 October 2026

- Better use of 19.5:9 and 20:9 phone screens: the lobby shows both crews and all controls side by side without scrolling, the home screen fills the width, and the joystick and bow pad move to the screen edges, clear of the arena.
- Fixed selected buttons (Host on the Wi-Fi screen, role, match time, preferred crew) turning grey after being tapped.

## 1.4.0 (Android version code 8) — 15 October 2026

- Brand-new look across every screen: home, lobby, battle HUD, results, dialogs and the loading screen, built for landscape phones.
- Restyled battlefield: new crates, fletched arrows, power ring on the bow, pop bursts, a drifting cloud floor, and controls moved out of the flight area.
- Smoother online play: your balloon, shots and crates respond instantly, and game updates use about 5x less data at a faster 30 updates per second.

## 1.3.1 (Android version code 7) — 14 October 2026

- Rebuilt version 1.3.0 with a new Play version code so the update can be uploaded as a fresh app bundle. Game features are unchanged.

## 1.3.0 (Android version code 6) — 11 October 2026

- Added a dedicated Offline Practice option with Easy, Medium and Hard presets. You are a Shooter with a bot Builder ally, facing two enemy bots.
- Practice runs the full match simulation on the device without a multiplayer connection, ad requests or a LAN host. Installed Android apps can play in airplane mode.
- Difficulty changes enemy aim, shot and repair pace, movement and dodging. Bots with low ammo seek the centre pickup.
- Practice starts immediately after a countdown, pauses for menus, portrait rotation and backgrounding, and supports rematches or changing difficulty.
- Added animated cheering, winking, surprised, worried, angry, dizzy and sad faces, with procedural reaction sounds. Sound preferences and reduced-motion settings are respected.
- Kept 30 starting arrows, all marked box rewards, centre ammo pickups and existing online/LAN rules.
- Prevented old socket callbacks from reconnecting after switching to offline practice and fitted the extra home option into landscape phone layouts.

## 1.2.1 (Android version code 5) — 8 October 2026

- Reduced starting arrows to 30 for online, practice, local matches and rematches. Box rewards and the centre ammo circle are unchanged.
- Added 512 catchy preset player names. A random name is filled in automatically on each app launch; Shuffle picks a different name.
- Names typed by players are remembered, including existing custom names.
- Opening the play dialog no longer focuses the name input or opens the Android keyboard. Tap the name to edit it; manual host address and room code entry still work normally.

## 1.2.0 (Android version code 4) — 8 October 2026

- Added automatic local-room discovery under Same Wi-Fi / Hotspot. Tap an available room to join; room names use the host’s nickname and room code.
- Added Refresh Rooms to restart discovery and find rooms created after the initial search.
- Added a LAN-only UDP discovery fallback for hotspots alongside Android DNS-SD.
- Kept manual host-address and room-code joining, plus hosting on this phone.
- Nearby rooms are checked for live availability and player counts; full rooms and games in progress are hidden.
- Let’s Play now waits in the lobby for the host’s START GAME action or a one-minute deadline. Automatic start still requires both crews to be ready.
- Late joins, crew/role changes and reconnects no longer reset the lobby timer; rematches receive a fresh minute.

Update the Android app for the room browser and Start Game button, and deploy the backend for the one-minute online start rule. Discovery is for Android phone-hosted rooms; networks that block multicast can use manual joining.

## 1.1.0 (Android version code 2) — 8 October 2026

- Start each match with 50 arrows.
- Every enemy box now has an arrow mark and gives 3 arrows when broken.
- Added a shared ammo circle at the centre of the arena. Stay inside for 2 continuous seconds to collect 5 arrows, even if your ammo is empty. The circle disappears after collection and returns after 2 seconds. Leaving the circle, being popped, or disconnecting resets your hold.
- Enlarged and boxed the Same Wi-Fi / Hotspot button on Android.
- Updated the tutorial and empty-ammo guidance.
- Applied the same authoritative rules to online and phone-hosted LAN matches.

Existing 1.0.0 clients still connect to the updated backend. Update the app to see the centre circle and new instructions. Deploying the backend restarts the server and clears current rooms; testers should start a new room afterward.
