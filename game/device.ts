import { Capacitor, registerPlugin } from '@capacitor/core';

const Device = registerPlugin<{ fullscreen(options: { enabled: boolean }): Promise<void> }>('GameDevice');
export const nativeAndroid = () => Capacitor.getPlatform() === 'android';
export async function nativeFullscreen(enabled: boolean) { await Device.fullscreen({ enabled }); }
