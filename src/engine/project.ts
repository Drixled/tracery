import { validateSettings } from './presets';
import type { Settings } from './types';

export interface SourceImage { dataUrl: string; name: string }
export interface Project {
  format: 'tracery';
  version: 1;
  settings: Settings;
  image: SourceImage | null;
}
export const MAX_IMAGE_DATA = 3 * 1024 * 1024;

export function createProject(settings: Settings, image: SourceImage | null = null): Project {
  return { format: 'tracery', version: 1, settings: { ...settings, stops: settings.stops.slice() }, image: image ? { ...image } : null };
}

/** Read a complete project, or a settings file from an older release. */
export function parseProject(input: unknown): Project {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('The project must be a JSON object.');
  const raw = input as Record<string, unknown>;
  if (!Object.hasOwn(raw, 'format') && !Object.hasOwn(raw, 'version')) return createProject(validateSettings(raw));
  if (raw.format !== 'tracery' || raw.version !== 1) throw new Error('This project format or version is not supported.');
  let image: SourceImage | null = null;
  if (raw.image != null) {
    const value = raw.image as Record<string, unknown>;
    if (typeof value !== 'object' || Array.isArray(value) || typeof value.dataUrl !== 'string' ||
        value.dataUrl.length > MAX_IMAGE_DATA || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.dataUrl) ||
        typeof value.name !== 'string' || value.name.length > 256) throw new Error('The saved source image is invalid or too large.');
    image = { dataUrl: value.dataUrl, name: value.name };
  }
  return createProject(validateSettings(raw.settings), image);
}
