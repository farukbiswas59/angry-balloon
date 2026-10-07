import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { LanRoom } from './lan-room';

type HostEvent = { type: string; peer: string; data?: string; message?: string };
type ClientEvent = { type: string; client: string; data?: string; code?: number };
const Lan = registerPlugin<{
  startHost(): Promise<{ addresses: string[]; port: number }>;
  stopHost(): Promise<void>;
  sendHost(options: { packets: { peer: string; data: string }[] }): Promise<void>;
  connect(options: { client: string; url: string }): Promise<void>;
  sendClient(options: { client: string; data: string }): Promise<void>;
  closeClient(options: { client: string }): Promise<void>;
  addListener(name: 'hostEvent', callback: (event: HostEvent) => void): Promise<PluginListenerHandle>;
  addListener(name: 'clientEvent', callback: (event: ClientEvent) => void): Promise<PluginListenerHandle>;
}>('LocalNetwork');

export type GameSocket = {
  readyState: number; bufferedAmount: number;
  onopen: (() => void) | null; onclose: ((event?: { code?: number }) => void) | null;
  onerror: (() => void) | null; onmessage: ((event: { data: string }) => void) | null;
  send(data: string): void; close(): void;
};

// Native transport avoids mixed-content exceptions. The Java plugin
// independently restricts all plain-text connections to private IP addresses.
export class NativeLanSocket implements GameSocket {
  readyState = 0; bufferedAmount = 0;
  onopen: (() => void) | null = null; onclose: ((event?: { code?: number }) => void) | null = null;
  onerror: (() => void) | null = null; onmessage: ((event: { data: string }) => void) | null = null;
  client = crypto.randomUUID(); handle: PluginListenerHandle | null = null;
  constructor(url: string) { void this.open(url); }
  private async open(url: string) {
    try {
      this.handle = await Lan.addListener('clientEvent', event => {
        if (event.client !== this.client || this.readyState === 3) return;
        if (event.type === 'open') { this.readyState = 1; this.onopen?.(); }
        if (event.type === 'message' && event.data) this.onmessage?.({ data: event.data });
        if (event.type === 'error') this.onerror?.();
        if (event.type === 'close') this.closed(event.code);
      });
      if (this.readyState === 3) { await this.handle.remove(); return; }
      await Lan.connect({ client: this.client, url });
    } catch { this.onerror?.(); this.closed(); }
  }
  send(data: string) { if (this.readyState === 1) void Lan.sendClient({ client: this.client, data }).catch(() => { this.onerror?.(); this.close(); }); }
  close() { if (this.readyState === 3) return; void Lan.closeClient({ client: this.client }); this.closed(); }
  private closed(code?: number) { if (this.readyState === 3) return; this.readyState = 3; void this.handle?.remove(); this.onclose?.({ code }); }
}

class PhoneHost {
  room: LanRoom | null = null;
  listener: PluginListenerHandle | null = null;
  timer: ReturnType<typeof setInterval> | null = null;
  sending = false;
  onError = (_message: string) => {};
  async start() {
    await this.stop();
    const room = new LanRoom(); this.room = room;
    this.listener = await Lan.addListener('hostEvent', event => {
      if (event.type === 'open') room.open(event.peer);
      if (event.type === 'close') room.close(event.peer);
      if (event.type === 'message' && event.data) room.receive(event.peer, event.data, performance.now());
      if (event.type === 'error') this.onError(event.message || 'LAN host stopped. Create a new local room.');
    });
    try {
      const info = await Lan.startHost();
      let previous = performance.now(), accumulator = 0;
      this.timer = setInterval(() => {
        const now = performance.now(); accumulator += Math.min((now - previous) / 1000, .25); previous = now;
        while (accumulator >= 1/60) { room.tick(1/60, now); accumulator -= 1/60; }
        if (!this.sending) {
          const packets = room.drain();
          if (packets.length) {
            this.sending = true;
            void Lan.sendHost({ packets }).catch(() => this.onError('LAN connection interrupted.')).finally(() => { this.sending = false; });
          }
        }
      }, 1000/60);
      return info;
    } catch (error) { await this.stop(); throw error; }
  }
  async stop() {
    if (this.timer) clearInterval(this.timer); this.timer = null;
    await this.listener?.remove(); this.listener = null;
    await Lan.stopHost(); this.room = null; this.sending = false;
  }
}
export const phoneHost = new PhoneHost();
