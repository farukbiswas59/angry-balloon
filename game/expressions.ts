import type { Player, Snapshot } from './engine.ts';

export type Expression = 'idle' | 'focused' | 'cheer' | 'wink' | 'shocked' | 'worried' | 'dizzy' | 'angry' | 'sad';
export type Reaction = { expression: Expression; until: number; after?: { expression: Expression; until: number } };

export function playerExpression(player: Player, state: Snapshot, now: number, reaction?: Reaction): Expression {
  if (state.phase === 'ended') return state.winner === player.team ? 'cheer' : 'sad';
  if (reaction && reaction.until > now) return reaction.expression;
  if (reaction?.after && reaction.after.until > now) return reaction.after.expression;
  if (state.phase !== 'playing' && state.phase !== 'sudden') return 'idle';
  if (state.arrows.some(a => a.team !== player.team && Math.hypot(a.x - player.x, a.y - player.y) < 115)) return 'shocked';
  if (player.happyUntil > now) return 'cheer';
  if (player.aimUntil > now) return 'focused';
  if (player.role === 'shooter' && player.ammo <= 3) return 'worried';
  return 'idle';
}

// Reactions are drawn directly on canvas, so every expression works offline and
// needs no extra bitmap downloads. This glossy body replaces the static sprite
// only while reacting; its geometry never changes the collision hitbox.
export function drawExpression(ctx: CanvasRenderingContext2D, player: Player, expression: Expression, seconds: number, reducedMotion: boolean) {
  if (expression === 'idle') return;
  const t = reducedMotion ? 0 : seconds;
  const joyful = expression === 'cheer' || expression === 'wink';
  const wobble = expression === 'shocked' || expression === 'worried' || expression === 'angry';
  ctx.save();
  ctx.translate(wobble ? Math.sin(t * 22) * 1.8 : 0, joyful ? -Math.abs(Math.sin(t * 8)) * 4 : 0);
  ctx.rotate(expression === 'dizzy' ? Math.sin(t * 8) * .12 : 0);
  const pulse = joyful ? Math.sin(t * 8) * .035 : 0;
  ctx.scale(1 + pulse, 1 - pulse);
  const blue = player.team === 'blue';
  const fill = ctx.createRadialGradient(-11, -28, 2, 5, -4, 40);
  fill.addColorStop(0, blue ? '#75f0ff' : '#ffd574');
  fill.addColorStop(.48, blue ? '#16bce9' : '#ff8042');
  fill.addColorStop(1, blue ? '#05649d' : '#b22e26');
  ctx.fillStyle = fill; ctx.strokeStyle = blue ? '#075178' : '#862d21'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, -9, 29, 33, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5, 23); ctx.lineTo(5, 23); ctx.lineTo(0, 29); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#d7ad62'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 29); ctx.bezierCurveTo(-7, 32, 9, 35, 0, 41); ctx.stroke();
  ctx.fillStyle = '#ffffffaa'; ctx.beginPath(); ctx.ellipse(-13, -29, 4, 9, -.65, 0, Math.PI * 2); ctx.fill();
  if (player.role === 'builder') {
    ctx.fillStyle = '#65452c'; ctx.fillRect(-24, -32, 48, 5);
    for (const x of [-13, 13]) { ctx.fillStyle = '#75b4cb'; ctx.strokeStyle = '#e6b665'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, -31, 10, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
  const ink = '#183340'; ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  const blink = !reducedMotion && t % 4.1 > 3.94;
  for (const x of [-11, 11]) {
    if (expression === 'dizzy') {
      ctx.beginPath(); ctx.moveTo(x - 4, -16); ctx.lineTo(x + 4, -7); ctx.moveTo(x + 4, -16); ctx.lineTo(x - 4, -7); ctx.stroke();
    } else if (blink || expression === 'cheer' || expression === 'wink' && x > 0) {
      ctx.beginPath(); ctx.moveTo(x - 5, -9); ctx.quadraticCurveTo(x, -17, x + 5, -9); ctx.stroke();
    } else {
      ctx.fillStyle = '#fff7dd'; ctx.beginPath(); ctx.ellipse(x, -12, expression === 'shocked' ? 7 : 6, expression === 'shocked' ? 9 : 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x + (player.team === 'blue' ? 1 : -1), -10, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (expression === 'angry' || expression === 'focused') {
    ctx.beginPath(); ctx.moveTo(-18, -23); ctx.lineTo(-5, -18); ctx.moveTo(18, -23); ctx.lineTo(5, -18); ctx.stroke();
  } else if (expression === 'worried' || expression === 'sad') {
    ctx.beginPath(); ctx.moveTo(-18, -20); ctx.lineTo(-5, -24); ctx.moveTo(18, -20); ctx.lineTo(5, -24); ctx.stroke();
  }
  ctx.fillStyle = ink;
  if (expression === 'shocked') { ctx.beginPath(); ctx.ellipse(0, 7, 5, 7, 0, 0, Math.PI * 2); ctx.fill(); }
  else if (joyful) {
    ctx.beginPath(); ctx.moveTo(-12, 2); ctx.quadraticCurveTo(0, 21, 12, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff8dc'; ctx.fillRect(-7, 3, 14, 3);
  } else if (expression === 'dizzy') {
    ctx.beginPath(); ctx.moveTo(-8, 7); ctx.quadraticCurveTo(-4, 1, 0, 7); ctx.quadraticCurveTo(4, 13, 8, 7); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-9, 9); ctx.quadraticCurveTo(0, expression === 'sad' || expression === 'worried' ? -1 : 14, 9, 9); ctx.stroke();
  }
  if (expression === 'sad' || expression === 'worried') {
    ctx.fillStyle = '#b5f4ff'; const y = expression === 'sad' ? 3 + (t * 18 % 11) : -2;
    ctx.beginPath(); ctx.ellipse(18, y, 2.5, 4, -.3, 0, Math.PI * 2); ctx.fill();
  }
  if (expression === 'dizzy' || joyful) {
    ctx.fillStyle = '#ffe27d';
    for (let i = 0; i < 3; i++) { const a = t * 3 + i * Math.PI * 2 / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * 31, -29 + Math.sin(a) * 9, 2.3, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}
