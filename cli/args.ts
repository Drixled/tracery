import { parseArgs } from 'node:util';
import { settingError, type Settings } from '../src/engine';
export function parseCli(args = process.argv.slice(2)) {
  const parsed = parseArgs({ args, allowPositionals: true, options: {
    art: { type: 'string', short: 'a' }, image: { type: 'string' }, palette: { type: 'string', short: 'p' },
    mode: { type: 'string', short: 'm' }, color: { type: 'string', short: 'c' }, name: { type: 'string', short: 'n' },
    out: { type: 'string', short: 'o' }, install: { type: 'boolean' }, agent: { type: 'boolean' },
    png: { type: 'string' }, cell: { type: 'string' }, width: { type: 'string' }, cols: { type: 'string' },
    kitty: { type: 'boolean' }, iterm: { type: 'boolean' }, 'install-graphics': { type: 'boolean' },
    'image-colors': { type: 'boolean' }, info: { type: 'boolean' }, 'list-palettes': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (parsed.positionals.length > 1) throw new Error('Use at most one project file.');
  if (parsed.values.art && parsed.values.image) throw new Error('Use either --art or --image.');
  const outputs = ['install', 'agent', 'kitty', 'iterm', 'install-graphics'] as const;
  if (outputs.filter(key => parsed.values[key]).length > 1) throw new Error('Use only one output option: --install, --agent, --kitty, --iterm, or --install-graphics.');
  return parsed;
}
export function numericOption(flag: string, key: keyof Settings, value: string): number {
  if (!value.trim()) throw new Error(`--${flag} needs a number.`);
  const number = Number(value);
  const error = settingError(key, number);
  if (error) throw new Error(`--${flag}: ${error}`);
  return number;
}
