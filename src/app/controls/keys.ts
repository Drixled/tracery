import type { Settings } from '../../engine';

type KeysOf<T> = { [K in keyof Settings]: Settings[K] extends T ? K : never }[keyof Settings];
export type NumberKey = KeysOf<number>;
export type BooleanKey = KeysOf<boolean>;
export type StringKey = KeysOf<string>;
/** Settings whose values come from a fixed list in the engine schema. */
export type ChoiceKey = 'src' | 'font' | 'imgUse' | 'dither' | 'dir' | 'mode' | 'color' | 'targetCols' | 'gfxProto' | 'fLayout' | 'fAlign' | 'fWrap' | 'draw' | 'tint';
