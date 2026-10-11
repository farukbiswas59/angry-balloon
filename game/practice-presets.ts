export type Difficulty = 'easy' | 'medium' | 'hard';
export const PRACTICE_PRESETS = {
  easy: { label: 'Easy', description: 'Gentle aim · slower shots and repairs', shotInterval: 2.4, aimError: 32, lead: 0, movement: .45, repairInterval: 1.25, dodge: false },
  medium: { label: 'Medium', description: 'Balanced aim · active opponents', shotInterval: 1.45, aimError: 14, lead: .45, movement: .7, repairInterval: .85, dodge: false },
  hard: { label: 'Hard', description: 'Sharp aim · quick shots, dodges and repairs', shotInterval: .85, aimError: 4, lead: .85, movement: 1, repairInterval: .5, dodge: true },
} as const;
export function practiceDifficulty(value: unknown): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'medium';
}
