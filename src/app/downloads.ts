interface HostedDownloads { save(request: { filename: string; data: Blob }): Promise<unknown> }
type HostWindow = Window & { claude?: { use(name: 'downloads'): Promise<HostedDownloads> } };
const hosted = (window as HostWindow).claude?.use('downloads').catch(() => null) ?? Promise.resolve(null);
export async function downloadBlob(name: string, data: string | Uint8Array, type: string) {
  const blob = new Blob([data as BlobPart], { type });
  const host = await hosted;
  if (host) {
    const filename = ['png', 'json', 'txt'].includes(name.split('.').pop() ?? '') ? name : `${name}.txt`;
    try { await host.save({ filename, data: blob }); }
    catch (e) { if ((e as { code?: string })?.code !== 'declined') throw new Error(`Could not save ${filename}. Copy the text instead.`); }
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
