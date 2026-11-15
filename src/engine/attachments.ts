/** Bounded, in-memory transfers. File bytes never enter room snapshots or localStorage. */
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const FILE_CHUNK_BYTES = 32 * 1024;
export const MAX_CACHED_BYTES = 32 * 1024 * 1024;
const MAX_PENDING_BYTES = 16 * 1024 * 1024;
const TRANSFER_TTL = 60_000;

export interface FileMeta { id: string; name: string; size: number; mime: string }
export interface LocalAttachment extends FileMeta { url: string; preview: boolean }
export type FilePacket =
  | { t: 'file-begin'; file: FileMeta }
  | { t: 'file-chunk'; id: string; index: number; bytes: ArrayBuffer }
  | { t: 'file-end'; id: string };

export function newFileId() { return globalThis.crypto?.randomUUID?.() ?? `file-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function validFileId(value: unknown): value is string { return typeof value === 'string' && /^[a-zA-Z0-9_-]{6,80}$/.test(value); }
export function cleanFileMeta(value: unknown): FileMeta | null {
  if (!value || typeof value !== 'object') return null;
  const meta = value as FileMeta;
  if (!validFileId(meta.id) || typeof meta.name !== 'string' || !meta.name.trim() || !Number.isSafeInteger(meta.size) || meta.size < 1 || meta.size > MAX_FILE_BYTES || typeof meta.mime !== 'string' || meta.mime.length > 100) return null;
  const name = meta.name.replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 100).trim();
  return name ? { id: meta.id, name, size: meta.size, mime: /^[\w.+-]+\/[\w.+-]+$/.test(meta.mime) ? meta.mime.toLowerCase() : 'application/octet-stream' } : null;
}

/** Only signatures for inert raster formats qualify for an inline image. */
export function rasterMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 6 && String.fromCharCode(...bytes.slice(0,6)).match(/^GIF8[79]a$/)) return 'image/gif';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'image/webp';
  return null;
}

interface Pending { owner: string; file: FileMeta; chunks: ArrayBuffer[]; received: number; next: number; at: number }
export class FileReceiver {
  private pending = new Map<string, Pending>();
  constructor(private now = () => Date.now()) {}
  private key(owner: string, id: string) { return `${owner}:${id}`; }
  clear(owner?: string) { for (const [key, value] of this.pending) if (!owner || value.owner === owner) this.pending.delete(key); }
  private expire() { for (const [key, value] of this.pending) if (this.now() - value.at > TRANSFER_TTL) this.pending.delete(key); }
  begin(owner: string, value: unknown): string | null {
    this.expire();
    const file = cleanFileMeta(value);
    if (!file) return 'Choose a file between 1 byte and 8 MB.';
    if ([...this.pending.values()].some((p) => p.owner === owner)) return 'Finish the current file before sending another.';
    const reserved = [...this.pending.values()].reduce((sum, p) => sum + p.file.size, 0);
    if (this.pending.size >= 8 || reserved + file.size > MAX_PENDING_BYTES) return 'The room is receiving other files. Try again shortly.';
    this.pending.set(this.key(owner, file.id), { owner, file, chunks: [], received: 0, next: 0, at: this.now() });
    return null;
  }
  chunk(owner: string, id: unknown, index: unknown, bytes: unknown): string | null {
    this.expire();
    if (!validFileId(id)) return 'Invalid file transfer.';
    const key = this.key(owner, id);
    const pending = this.pending.get(key);
    if (!pending) return 'File transfer expired. Please send it again.';
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < 1 || bytes.byteLength > FILE_CHUNK_BYTES || index !== pending.next || pending.received + bytes.byteLength > pending.file.size) {
      this.pending.delete(key);
      return 'Invalid file chunk. Please send the file again.';
    }
    pending.chunks.push(bytes);
    pending.next++;
    pending.received += bytes.byteLength;
    pending.at = this.now();
    return null;
  }
  finish(owner: string, id: unknown): { file: FileMeta; blob: Blob } | null {
    this.expire();
    if (!validFileId(id)) return null;
    const key = this.key(owner, id);
    const pending = this.pending.get(key);
    this.pending.delete(key);
    if (!pending || pending.received !== pending.file.size) return null;
    return { file: pending.file, blob: new Blob(pending.chunks, { type: 'application/octet-stream' }) };
  }
}

export class AttachmentCache {
  private files = new Map<string, { file: LocalAttachment; blob: Blob }>();
  private bytes = 0;
  async add(meta: FileMeta, raw: Blob): Promise<LocalAttachment> {
    const detected = rasterMime(new Uint8Array(await raw.slice(0, 12).arrayBuffer()));
    const blob = new Blob([raw], { type: detected ?? 'application/octet-stream' });
    this.remove(meta.id);
    while (this.files.size >= 20 || this.bytes + blob.size > MAX_CACHED_BYTES) {
      const first = this.files.keys().next().value;
      if (!first) break;
      this.remove(first);
    }
    const file = { ...meta, url: URL.createObjectURL(blob), preview: detected !== null };
    this.files.set(meta.id, { file, blob }); this.bytes += blob.size;
    return file;
  }
  get(id: string) { return this.files.get(id); }
  snapshot(): Record<string, LocalAttachment> { return Object.fromEntries([...this.files].map(([id, value]) => [id, value.file])); }
  remove(id: string) { const item = this.files.get(id); if (item) { URL.revokeObjectURL(item.file.url); this.bytes -= item.blob.size; this.files.delete(id); } }
  clear() { for (const id of [...this.files.keys()]) this.remove(id); }
}

export interface FileConnection { open: boolean; bufferSize?: number; dataChannel?: { bufferedAmount: number }; send(packet: FilePacket): void }
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export async function sendFilePackets(connection: FileConnection, file: FileMeta, blob: Blob, active = () => true, progress?: (sent: number) => void) {
  if (!cleanFileMeta(file) || file.size !== blob.size) throw new Error('Choose a file between 1 byte and 8 MB.');
  const send = async (packet: FilePacket) => {
    const start = Date.now();
    while ((connection.dataChannel?.bufferedAmount ?? 0) > 256 * 1024 || (connection.bufferSize ?? 0) > 4) {
      if (!connection.open || !active() || Date.now() - start > 15_000) throw new Error('File transfer interrupted. Please try again.');
      await pause(20);
    }
    if (!connection.open || !active()) throw new Error('File transfer interrupted. Please try again.');
    connection.send(packet);
  };
  await send({ t: 'file-begin', file });
  let index = 0;
  for (let offset = 0; offset < blob.size; offset += FILE_CHUNK_BYTES) {
    const bytes = await blob.slice(offset, offset + FILE_CHUNK_BYTES).arrayBuffer();
    await send({ t: 'file-chunk', id: file.id, index: index++, bytes });
    progress?.(Math.min(blob.size, offset + bytes.byteLength));
    if (index % 8 === 0) await pause(0);
  }
  await send({ t: 'file-end', id: file.id });
}
