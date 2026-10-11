/** Bounded snapshots, with one undo step per continuous input gesture. */
export class History<T> {
  private entries: T[];
  private cursor = 0;
  private group: string | undefined;
  constructor(initial: T, private limit = 50, private options: { clone?: (value: T) => T; equal?: (a: T, b: T) => boolean } = {}) { this.entries = [this.clone(initial)]; }
  private clone(value: T) { return this.options.clone ? this.options.clone(value) : structuredClone(value); }
  peekUndo(): T | null { return this.canUndo ? this.clone(this.entries[this.cursor - 1]) : null; }
  peekRedo(): T | null { return this.canRedo ? this.clone(this.entries[this.cursor + 1]) : null; }
  get canUndo() { return this.cursor > 0; }
  get canRedo() { return this.cursor < this.entries.length - 1; }
  record(value: T, group?: string) {
    if (this.options.equal ? this.options.equal(value, this.entries[this.cursor]) : JSON.stringify(value) === JSON.stringify(this.entries[this.cursor])) return;
    const combine = group !== undefined && group === this.group && this.cursor > 0 && !this.canRedo;
    this.entries.splice(this.cursor + 1);
    if (combine) this.entries[this.cursor] = this.clone(value);
    else { this.entries.push(this.clone(value)); this.cursor++; }
    if (this.entries.length > this.limit) { this.entries.shift(); this.cursor--; }
    this.group = group;
  }
  endGroup() { this.group = undefined; }
  /** Start over from a new baseline, as when another banner is opened. */
  reset(value: T) { this.entries = [this.clone(value)]; this.cursor = 0; this.group = undefined; }
  undo(): T | null {
    this.endGroup();
    return this.canUndo ? this.clone(this.entries[--this.cursor]) : null;
  }
  redo(): T | null {
    this.endGroup();
    return this.canRedo ? this.clone(this.entries[++this.cursor]) : null;
  }
}
