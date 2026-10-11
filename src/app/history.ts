/** Bounded snapshots, with one undo step per continuous input gesture. */
export class History<T> {
  private entries: T[];
  private cursor = 0;
  private group: string | undefined;
  constructor(initial: T, private limit = 50) { this.entries = [structuredClone(initial)]; }
  get canUndo() { return this.cursor > 0; }
  get canRedo() { return this.cursor < this.entries.length - 1; }
  record(value: T, group?: string) {
    if (JSON.stringify(value) === JSON.stringify(this.entries[this.cursor])) return;
    const combine = group !== undefined && group === this.group && this.cursor > 0 && !this.canRedo;
    this.entries.splice(this.cursor + 1);
    if (combine) this.entries[this.cursor] = structuredClone(value);
    else { this.entries.push(structuredClone(value)); this.cursor++; }
    if (this.entries.length > this.limit) { this.entries.shift(); this.cursor--; }
    this.group = group;
  }
  endGroup() { this.group = undefined; }
  undo(): T | null {
    this.endGroup();
    return this.canUndo ? structuredClone(this.entries[--this.cursor]) : null;
  }
  redo(): T | null {
    this.endGroup();
    return this.canRedo ? structuredClone(this.entries[++this.cursor]) : null;
  }
}
