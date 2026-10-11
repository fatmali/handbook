import { deflateSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';

function chunk(type: string, data: Buffer) {
  const name = Buffer.from(type);
  const input = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, name, data, checksum]);
}
export async function generateIcons() {
  for (const size of [180, 192, 512]) {
    const pixels = Buffer.alloc((size * 4 + 1) * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const px = x / size * 192; const py = y / size * 192;
      const dx = Math.max(34 - px, 0, px - 158); const dy = Math.max(34 - py, 0, py - 158);
      const visible = dx * dx + dy * dy <= 34 * 34;
      let color = [37, 43, 69];
      if (px >= 42 && px < 89 && py >= 44 && py < 154) color = [169, 184, 247];
      if (px >= 103 && px < 150 && py >= 38 && py < 148) color = [213, 239, 223];
      if ((px >= 52 && px < 77 && py >= 132 && py < 137) || (px >= 113 && px < 138 && py >= 126 && py < 131)) color = [37, 43, 69];
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      pixels.set([...color, visible ? 255 : 0], offset);
    }
    const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
    await writeFile(`public/icon-${size}.png`, png);
  }
}
