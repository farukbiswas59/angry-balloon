"use client";
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { ads } from './ads';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function BootScreen() {
  const [ready, setReady] = useState(false), [progress, setProgress] = useState(0);
  useEffect(() => {
    let alive = true;
    const start = performance.now();
    if (Capacitor.isNativePlatform()) void SplashScreen.hide().catch(() => {});
    const images = ['/art/sky.png', '/art/balloons.png'];
    let loaded = 0;
    Promise.all(images.map(src => new Promise<void>(resolve => {
      const img = new Image();
      const done = () => { if (alive) setProgress(++loaded / images.length); resolve(); };
      img.onload = done; img.onerror = done; img.src = src;
      if (img.complete) { img.onload = null; img.onerror = null; done(); }
    }))).then(() => new Promise(resolve => setTimeout(resolve, Math.max(0, 1200 - (performance.now() - start))))).then(() => {
      if (alive) { setReady(true); void ads.initialize(); }
    });
    return () => { alive = false; };
  }, []);
  if (ready) return <AgeScreen/>;
  return <section className="boot-screen" aria-label="Loading Angry Balloon" role="status">
    <div className="boot-glow"/><div className="boot-balloon"/>
    <div className="boot-title">ANGRY <span>BALLOON</span></div>
    <p className="boot-tagline">A LITTLE AIR. A LOT OF ATTITUDE.</p>
    <div className="boot-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span style={{width: `${progress * 100}%`}}/></div>
    <span className="boot-status">PREPARING YOUR SKY…</span>
    <div className="boot-credit"><span>DEVELOPED BY</span><b>Faruk Biswas</b></div>
  </section>;
}

function AgeScreen() {
  const [needed, setNeeded] = useState(ads.needsAge);
  const [busy, setBusy] = useState(ads.initializing || ads.showing);
  useEffect(() => ads.subscribe(() => { setNeeded(ads.needsAge); setBusy(ads.initializing || ads.showing); }), []);
  return <Dialog open={needed || busy}><DialogContent className="age-card" showCloseButton={false} onEscapeKeyDown={event => event.preventDefault()} onInteractOutside={event => event.preventDefault()}>
    <DialogTitle>{needed?'YOUR AGE RANGE':ads.showing?'RETURNING TO YOUR SKY…':'PREPARING PRIVACY SETTINGS…'}</DialogTitle>
    <DialogDescription>{needed?<>Only this range is saved on your device.<br/>We don’t ask for your date of birth.</>:'The game will continue automatically.'}</DialogDescription>
    {needed&&<><div className="age-options">{[['under13','Under 13'],['13to15','13–15'],['16to17','16–17'],['adult','18 or older']].map(([value,label]) => <button key={value} onClick={() => ads.selectAge(value)}>{label}</button>)}</div>
    <button className="age-unknown" onClick={() => ads.selectAge('unknown')}>Prefer not to say</button></>}
  </DialogContent></Dialog>;
}
