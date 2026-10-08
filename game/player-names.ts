// 512 short, family-friendly nicknames that fit the game's 16-character limit.
const prefixes = [
  'Sky', 'Cloud', 'Storm', 'Thunder', 'Lightning', 'Breeze', 'Gust', 'Aero',
  'Rocket', 'Comet', 'Meteor', 'Orbit', 'Nova', 'Solar', 'Lunar', 'Cosmic',
  'Turbo', 'Sonic', 'Flash', 'Blaze', 'Frost', 'Spark', 'Neon', 'Pixel',
  'Jolly', 'Bouncy', 'Bubble', 'Fiery', 'Mighty', 'Sneaky', 'Lucky', 'Golden',
] as const;
const suffixes = [
  'Ace', 'Ninja', 'Rider', 'Ranger', 'Pilot', 'Panda', 'Fox', 'Falcon',
  'Tiger', 'Dragon', 'Wizard', 'Knight', 'Arrow', 'Popper', 'Dasher', 'Bandit',
] as const;

export const PLAYER_NAMES: readonly string[] = Object.freeze(prefixes.flatMap(prefix => suffixes.map(suffix => prefix + suffix)));
const legacyPresets = new Set(['SkyShot', 'CloudHunter', 'PopKing', 'ArrowAce', 'AirRage', 'WallMaster']);

export function randomPlayerName(previous = '', random = Math.random): string {
  const previousIndex = PLAYER_NAMES.indexOf(previous);
  const count = PLAYER_NAMES.length - (previousIndex >= 0 ? 1 : 0);
  let index = Math.floor(random() * count);
  if (previousIndex >= 0 && index >= previousIndex) index++;
  return PLAYER_NAMES[index];
}

export function initialPlayerName(saved: string | null, mode: string | null): string {
  // Migrate old automatic presets without discarding an existing custom name.
  if (saved?.trim() && (mode === 'custom' || mode === null && !legacyPresets.has(saved) && !PLAYER_NAMES.includes(saved))) return saved;
  return randomPlayerName(saved || '');
}
