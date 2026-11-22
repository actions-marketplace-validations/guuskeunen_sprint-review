/** Width and height of a PNG or JPEG data URI, so pictures keep their shape. */
export function imageSize(uri: string): { w: number; h: number } | null {
  const b = Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64');
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  for (let i = 2; i < b.length - 9; ) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xc3) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
