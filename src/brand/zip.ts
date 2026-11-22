import { inflateRawSync } from 'node:zlib';

/** A presentation's parts are small; more than this unpacked is a zip bomb, not a template. */
const MAX_ENTRY = 50_000_000;

/**
 * Reads the entries of a zip file (a .pptx is one) through its central directory. Stored and
 * deflated entries only, which is all Office writes. Small and dependency-free on purpose.
 */
export function readZip(buf: Buffer): Map<string, () => Buffer> {
  const entries = new Map<string, () => Buffer>();
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65_535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip file.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Damaged zip directory.');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    entries.set(name, () => {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      if (method === 0) return Buffer.from(data);
      if (method === 8) {
        try {
          return inflateRawSync(data, { maxOutputLength: MAX_ENTRY });
        } catch (e) {
          if ((e as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE' || e instanceof RangeError) throw new Error(`Zip entry ${name} is too large (over ${MAX_ENTRY / 1e6} MB unpacked).`, { cause: e });
          throw e;
        }
      }
      throw new Error(`Zip entry ${name} uses an unsupported compression.`);
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
