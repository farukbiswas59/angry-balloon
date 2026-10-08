# Angry Balloon changelog

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
