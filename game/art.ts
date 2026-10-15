import type { Team } from './engine';

// One palette for canvas and CSS (see the matching tokens in globals.css).
export const INK = '#1d1838';
export const PAPER = '#fff6e3';
export const SUN = '#ffc531';
export const MINT = '#31d6a4';
export const WOOD = '#d9a066';
export const DISPLAY = '"Lilita One", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
export const TEAM = {
  blue: { main: '#2f9bff', light: '#9bd8ff', deep: '#1557c0' },
  red: { main: '#ff4d3d', light: '#ffb7a3', deep: '#b8231b' },
} as const;

type Ctx = CanvasRenderingContext2D;

// Comic lettering: thick ink outline under a solid fill.
export function label(ctx: Ctx, text: string, x: number, y: number, size: number, fill = PAPER, align: CanvasTextAlign = 'center') {
  ctx.font = `${size}px ${DISPLAY}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * .24); ctx.strokeStyle = INK; ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

// Sticker tag with a hard drop shadow. Returns its width for callers that stack things beside it.
export function tag(ctx: Ctx, text: string, x: number, y: number, size: number, bg: string, fg = PAPER) {
  ctx.font = `${size}px ${DISPLAY}`;
  const w = ctx.measureText(text).width + size * 1.1, h = size * 1.6, r = h / 2;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2 + size * .16, w, h, r); ctx.fill();
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, r); ctx.fill();
  ctx.lineWidth = Math.max(1.5, size * .13); ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + size * .05);
  return w;
}

const crates = new Map<string, HTMLCanvasElement>();
// Crates are drawn once per crew into a 3x bitmap, then blitted every frame.
export function crate(team: Team) {
  const cached = crates.get(team);
  if (cached) return cached;
  const s = 3, size = 56, c = document.createElement('canvas');
  c.width = c.height = size * s;
  const g = c.getContext('2d')!;
  g.scale(s, s); g.translate(size / 2, size / 2);
  g.fillStyle = 'rgba(29,24,56,.38)'; g.beginPath(); g.roundRect(-18, -16, 42, 42, 7); g.fill();
  const wood = g.createLinearGradient(0, -21, 0, 21);
  wood.addColorStop(0, '#f0b46c'); wood.addColorStop(1, '#c27536');
  g.fillStyle = wood; g.beginPath(); g.roundRect(-21, -21, 42, 42, 7); g.fill();
  g.strokeStyle = 'rgba(110,55,20,.5)'; g.lineWidth = 1.4;
  for (const y of [-4, 9]) { g.beginPath(); g.moveTo(-19, y); g.lineTo(19, y); g.stroke(); }
  g.lineCap = 'round';
  g.strokeStyle = '#86491f'; g.lineWidth = 5.5; g.beginPath(); g.moveTo(-13, 15); g.lineTo(13, -8); g.stroke();
  g.strokeStyle = '#f7cd8f'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-13, 13); g.lineTo(11, -8); g.stroke();
  g.fillStyle = TEAM[team].main; g.beginPath(); g.roundRect(-21, -21, 42, 11, [7, 7, 0, 0]); g.fill();
  g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(-16, -18.5, 18, 2.4);
  g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(-21, -10); g.lineTo(21, -10); g.stroke();
  g.fillStyle = INK;
  for (const [x, y] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) { g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill(); }
  g.lineWidth = 3; g.beginPath(); g.roundRect(-21, -21, 42, 42, 7); g.stroke();
  crates.set(team, c);
  return c;
}
export function drawCrate(ctx: Ctx, team: Team, x: number, y: number, alpha = 1, scale = 1) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(crate(team), x - 28 * scale, y - 28 * scale, 56 * scale, 56 * scale);
  ctx.globalAlpha = 1;
}

let cloudBank: HTMLCanvasElement | null = null;
// A soft cloud floor along the bottom of the arena, tiled horizontally for drift.
export function clouds() {
  if (cloudBank) return cloudBank;
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 220;
  const g = c.getContext('2d')!;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [y, color, count, min, max] of [[150, 'rgba(255,214,190,.55)', 26, 40, 85], [185, 'rgba(255,240,226,.85)', 30, 38, 78], [215, '#fff6e9', 34, 30, 64]] as const) {
    g.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const x = i / count * 1280 + rnd() * 30, r = min + rnd() * (max - min);
      const cy = y - rnd() * 20;
      for (const dx of [-1280, 0, 1280]) { g.beginPath(); g.arc(x + dx, cy, r, 0, Math.PI * 2); g.fill(); }
    }
  }
  cloudBank = c;
  return c;
}

// Arrow drawn at the origin pointing along +x; the tip sits at x = 21 (C.arrowTip).
export function drawArrow(ctx: Ctx, team: Team, trail = true) {
  ctx.lineCap = 'round';
  if (trail) {
    const fade = ctx.createLinearGradient(-26, 0, -78, 0);
    fade.addColorStop(0, TEAM[team].light + 'cc'); fade.addColorStop(1, TEAM[team].light + '00');
    ctx.strokeStyle = fade; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-78, 0); ctx.stroke();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(12, 0); ctx.stroke();
  ctx.strokeStyle = WOOD; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-23, 0); ctx.lineTo(12, 0); ctx.stroke();
  ctx.fillStyle = TEAM[team].main; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-29, side * 6.5); ctx.lineTo(-17, side * 6.5); ctx.lineTo(-14, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#eef3f8'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(21, 0); ctx.lineTo(9, -6); ctx.lineTo(11, 0); ctx.lineTo(9, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
}

export function drawBow(ctx: Ctx, x: number, y: number, angle: number, pull: number, team: Team, size = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(size, size); ctx.lineCap = 'round';
  const limb = () => { ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(26, 0, 0, 26); };
  ctx.strokeStyle = INK; ctx.lineWidth = 7.5; limb(); ctx.stroke();
  ctx.strokeStyle = '#b8733a'; ctx.lineWidth = 4; limb(); ctx.stroke();
  ctx.strokeStyle = PAPER; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(-pull / 2, 0); ctx.lineTo(0, 26); ctx.stroke();
  ctx.fillStyle = TEAM[team].main; ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.roundRect(9, -6, 6, 12, 2); ctx.fill(); ctx.stroke();
  if (pull > 2) { ctx.save(); ctx.translate(-pull / 2 + 23, 0); ctx.scale(.8, .8); drawArrow(ctx, team, false); ctx.restore(); }
  ctx.restore();
}
