// Interstitials are eligible only after completed matches and a natural exit.
export class AdPolicy {
  completed = 0;
  lastShown = 0;
  lastMatch = '';
  complete(match: string) {
    if (match === this.lastMatch) return;
    this.lastMatch = match;
    this.completed++;
  }
  eligible(now: number) { return this.completed >= 3 && now - this.lastShown >= 180_000; }
  shown(now: number) { this.completed = 0; this.lastShown = now; }
}
