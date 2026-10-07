import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus, InterstitialAdPluginEvents, MaxAdContentRating } from '@capacitor-community/admob';
import config from '../mobile/android-config.json';
import { AdPolicy } from './ad-policy';
import { sound } from './audio';
const testAds = process.env.NEXT_PUBLIC_ANDROID_TEST === '1' || config.adsMode !== 'live';

class GameAds {
  policy = new AdPolicy();
  allowed = false;
  privacyRequired = false;
  ready = false;
  loading = false;
  showing = false;
  initializing = false;
  active = false;
  started: Promise<void> | null = null;
  needsAge = false;
  listeners = new Set<() => void>();
  ageSelected: ((age: string) => void) | null = null;
  onChange = () => { for (const listener of this.listeners) listener(); };
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  selectAge(age: string) {
    if (!['under13', '13to15', '16to17', 'adult', 'unknown'].includes(age)) return;
    localStorage.setItem('ab-age-range', age);
    this.needsAge = false;
    this.ageSelected?.(age);
    this.ageSelected = null;
    this.onChange();
  }

  initialize() {
    if (!Capacitor.isNativePlatform()) return Promise.resolve();
    return this.started ??= this.start().finally(() => { this.initializing = false; this.onChange(); });
  }
  private async start() {
    this.initializing = true;
    this.onChange();
    // Ask neutrally before initializing the advertising SDK for a mixed audience.
    if (config.audience === 'children' && !['under13', '13to15', '16to17', 'adult', 'unknown'].includes(localStorage.getItem('ab-age-range') || '')) {
      this.needsAge = true;
      this.onChange();
      await new Promise<string>(resolve => { this.ageSelected = resolve; });
    }
    // A neutral age screen supports the mixed audience. All players receive the
    // same conservative child-directed, G-rated, non-personalized ad treatment.
    const underAge = config.audience === 'children';
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      // Offline LAN play must not wait indefinitely for a consent network call.
      // A late response cannot trigger a form because the raced request rejects.
      const request = AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: underAge });
      let consent = await Promise.race([request, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Consent unavailable offline')), 6000); })]).finally(() => clearTimeout(timer));
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) consent = await AdMob.showConsentForm();
      this.allowed = consent.canRequestAds;
      this.privacyRequired = consent.privacyOptionsRequirementStatus === 'REQUIRED';
      if (!this.allowed) { this.onChange(); return; }
      await AdMob.initialize({ tagForChildDirectedTreatment: underAge, tagForUnderAgeOfConsent: underAge, maxAdContentRating: MaxAdContentRating.General });
      this.active = true;
      this.onChange();
      void this.preload();
    } catch { /* Offline play remains available if consent or ads cannot load. */ }
  }
  async preload() {
    if (!this.active || !this.allowed || this.ready || this.loading || this.showing) return;
    this.loading = true;
    try {
      await AdMob.prepareInterstitial({ adId: testAds ? 'ca-app-pub-3940256099942544/1033173712' : config.interstitialAdId, isTesting: testAds, npa: true, immersiveMode: true });
      this.ready = true;
    } catch { this.ready = false; }
    finally { this.loading = false; }
  }
  async privacy() {
    if (!Capacitor.isNativePlatform()) return;
    await AdMob.showPrivacyOptionsForm();
    const consent = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: config.audience === 'children' });
    this.allowed = consent.canRequestAds;
    this.privacyRequired = consent.privacyOptionsRequirementStatus === 'REQUIRED';
    this.ready = false;
    this.onChange();
    void this.preload();
  }
  async afterResults(local: boolean) {
    if (local || !this.active || !this.allowed || !this.ready || this.showing || !this.policy.eligible(Date.now())) { void this.preload(); return; }
    this.showing = true;
    this.onChange();
    this.ready = false;
    const ctx = sound.ctx;
    const wasRunning = ctx?.state === 'running';
    let shown = false;
    let finish!: () => void;
    const closed = new Promise<void>(resolve => { finish = resolve; });
    const handles: import('@capacitor/core').PluginListenerHandle[] = [];
    try {
      if (wasRunning) await ctx?.suspend();
      handles.push(await AdMob.addListener(InterstitialAdPluginEvents.Showed, () => { shown = true; this.policy.shown(Date.now()); }));
      handles.push(await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => finish()));
      handles.push(await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => finish()));
      await AdMob.showInterstitial(); await closed;
    }
    catch { /* Failed ads must never stop the player returning to the menu. */ }
    finally {
      await Promise.allSettled(handles.map(handle => handle.remove()));
      this.showing = false;
      this.onChange();
      if (wasRunning) void ctx?.resume();
      if (!shown) this.ready = false;
      void this.preload();
    }
  }
}
export const ads = new GameAds();
