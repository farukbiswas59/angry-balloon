import { cleanName } from './engine.ts';
import type { Room } from './engine.ts';
import { lanAddress } from './lan-address.ts';
import type { GameSocket } from './lan-native';

export type LocalRoomInfo = { code: string; hostName: string; name: string; players: number; maxPlayers: number; joinable: boolean; protocol: number };
export type DiscoveredRoom = LocalRoomInfo & { service: string; address: string };
export type DiscoveryEvent = { type: 'found' | 'lost' | 'error'; service?: string; address?: string; port?: number; message?: string };

export function localRoomInfo(room: Room): LocalRoomInfo {
  const host = room.players.find(player => player.id === room.host && !player.bot);
  const hostName = cleanName(host?.name);
  return { code: room.code, hostName, name: `${hostName}'s room · ${room.code}`, players: room.players.length, maxPlayers: room.maxPlayers,
    joinable: room.phase === 'lobby' && !!host?.connected && room.players.length < room.maxPlayers, protocol: 1 };
}

// Treat discovery packets as untrusted. Joining still goes through the normal server checks.
export function parseLocalRoom(value: unknown): LocalRoomInfo | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  if (r.protocol !== 1 || typeof r.code !== 'string' || !/^[A-Z2-9]{5}$/.test(r.code) || r.joinable !== true ||
      !Number.isInteger(r.players) || !Number.isInteger(r.maxPlayers) || Number(r.players) < 1 || Number(r.maxPlayers) < 4 ||
      Number(r.maxPlayers) > 10 || Number(r.players) >= Number(r.maxPlayers)) return null;
  const hostName = cleanName(r.hostName);
  return { protocol: 1, code: r.code, hostName, name: `${hostName}'s room · ${r.code}`, players: Number(r.players), maxPlayers: Number(r.maxPlayers), joinable: true };
}

// Resolve advertised endpoints, then ask the actual host whether its room is still joinable.
// Only three probes run at once, keeping native transport slots free for the player's join.
export class LocalRoomDirectory {
  private endpoints = new Map<string, string>();
  private available = new Map<string, DiscoveredRoom>();
  private probes = new Set<GameSocket>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private scanning = false;
  private socket: (url: string) => GameSocket;
  private changed: (rooms: DiscoveredRoom[]) => void;
  constructor(socket: (url: string) => GameSocket, changed: (rooms: DiscoveredRoom[]) => void) { this.socket = socket; this.changed = changed; }
  start() { this.timer = setInterval(() => this.refresh(), 4000); }
  event(event: DiscoveryEvent) {
    if (this.stopped || !event.service) return;
    if (event.type === 'lost') { this.endpoints.delete(event.service); this.available.delete(event.service); this.publish(); return; }
    if (event.type !== 'found' || !event.address || this.endpoints.size >= 64 && !this.endpoints.has(event.service)) return;
    try { this.endpoints.set(event.service, lanAddress(`${event.address}:${event.port}`)); } catch { return; }
    void this.refresh();
  }
  private publish() {
    if (this.stopped) return;
    // DNS-SD and broadcast can both find the same host; show it only once.
    const unique = new Map([...this.available.values()].map(room => [`${room.address}:${room.code}`, room]));
    this.changed([...unique.values()].sort((a, b) => a.name.localeCompare(b.name) || a.address.localeCompare(b.address)));
  }
  async refresh() {
    if (this.stopped || this.scanning) return;
    this.scanning = true;
    const queue = [...this.endpoints];
    try {
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
        while (queue.length && !this.stopped) {
          const [service, address] = queue.shift()!;
          const room = await this.probe(address);
          if (this.stopped || this.endpoints.get(service) !== address) continue;
          if (room) this.available.set(service, { ...room, service, address }); else this.available.delete(service);
          this.publish();
        }
      }));
    } finally { this.scanning = false; }
  }
  private probe(address: string): Promise<LocalRoomInfo | null> {
    return new Promise(resolve => {
      let socket: GameSocket;
      try { socket = this.socket(address.replace(/^http/, 'ws') + '/socket'); } catch { resolve(null); return; }
      this.probes.add(socket);
      let done = false;
      const finish = (room: LocalRoomInfo | null) => {
        if (done) return; done = true; clearTimeout(timeout); this.probes.delete(socket); socket.close(); resolve(room);
      };
      const timeout = setTimeout(() => finish(null), 3000);
      socket.onopen = () => socket.send(JSON.stringify({ type: 'room-info' }));
      socket.onmessage = event => { try { const message = JSON.parse(event.data); if (message.type === 'room-info') finish(parseLocalRoom(message.room)); } catch { finish(null); } };
      socket.onerror = () => finish(null);
      socket.onclose = () => finish(null);
    });
  }
  stop() { this.stopped = true; if (this.timer) clearInterval(this.timer); this.timer = null; for (const socket of [...this.probes]) socket.close(); this.endpoints.clear(); this.available.clear(); }
}
