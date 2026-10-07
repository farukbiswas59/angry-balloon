// Plain-text sockets are restricted to loopback and private IPv4 LAN addresses.
export function lanAddress(value: string) {
  const trimmed = value.trim().replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/$/, '');
  const match = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?$/.exec(trimmed);
  if (!match) throw Error('Enter the host’s local IPv4 address, for example 192.168.1.10:3001.');
  const parts = match[1].split('.').map(Number), port = Number(match[2] || 3001);
  if (parts.some(p => p > 255) || port < 1024 || port > 65535 || !(parts[0] === 10 || parts[0] === 127 || parts[0] === 192 && parts[1] === 168 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)) throw Error('Use a private Wi-Fi/hotspot address and a port from 1024 to 65535.');
  return `http://${parts.join('.')}:${port}`;
}
