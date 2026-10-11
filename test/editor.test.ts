import { describe, expect, it } from 'vitest';
import { createProject, DEFAULTS } from '../src/engine';
import { Editor } from '../src/app/editor';
const initial = () => createProject(DEFAULTS);
const source = { name: 'test.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

describe('atomic editor transitions', () => {
  it('does not apply a slow imported image over newer edits', async () => {
    const decode = deferred<string>();
    const editor = new Editor(initial(), () => decode.promise);
    const imported = editor.restore(createProject({ ...DEFAULTS, gap: 3, src: 'image' }, source));
    editor.edit({ gap: 2 });
    decode.resolve('pixels');
    expect(await imported).toBe(false);
    expect(editor.settings.gap).toBe(2);
    expect(editor.settings.src).toBe('ascii');
    expect(editor.busy).toBe(false);
  });
  it('cancels the whole file-read phase of an import', async () => {
    const file = deferred<ReturnType<typeof createProject>>();
    const editor = new Editor(initial(), async () => 'pixels');
    const pending = editor.importProject(() => file.promise);
    editor.edit({ gap: 2 });
    file.resolve(createProject({ ...DEFAULTS, gap: 3 }));
    expect(await pending).toBe(false);
    expect(editor.settings.gap).toBe(2);
  });
  it('only applies the latest image replacement', async () => {
    const first = deferred<{ source: typeof source; decoded: string }>();
    const second = deferred<{ source: typeof source; decoded: string }>();
    const editor = new Editor(initial(), async () => 'pixels');
    const a = editor.replaceImage(() => first.promise);
    const b = editor.replaceImage(() => second.promise);
    second.resolve({ source: { ...source, name: 'second' }, decoded: 'second pixels' });
    expect(await b).toBe(true);
    first.resolve({ source, decoded: 'first pixels' });
    expect(await a).toBe(false);
    expect(editor.snapshot().image!.name).toBe('second');
    expect(editor.decodedImage).toBe('second pixels');
  });
  it('does not move the undo cursor when decoding fails', async () => {
    let fail = false;
    const editor = new Editor(initial(), async () => { if (fail) throw new Error('bad PNG'); return 'pixels'; });
    await editor.restore(createProject({ ...DEFAULTS, src: 'image' }, source));
    await editor.restore(initial());
    fail = true;
    await expect(editor.travel('undo')).rejects.toThrow('bad PNG');
    expect(editor.history.canRedo).toBe(false);
    expect(editor.settings.src).toBe('ascii');
    fail = false;
    expect(await editor.travel('undo')).toBe(true);
    expect(editor.settings.src).toBe('image');
  });
  it('shares immutable image objects across history entries', async () => {
    const editor = new Editor(initial(), async () => 'pixels');
    await editor.restore(createProject({ ...DEFAULTS, src: 'image' }, source));
    const image = editor.snapshot().image;
    editor.edit({ gap: 2 });
    expect(editor.snapshot().image).toBe(image);
    expect(editor.history.peekUndo()!.image).toBe(image);
    expect(Object.isFrozen(image)).toBe(true);
    await editor.travel('undo');
    expect(editor.snapshot().image).toBe(image);
  });
});
