// Generates PNG app icons (no image libraries needed): violet→blue gradient
// rounded square with a face-outline ring. Outputs to public/.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}

function icon(size, rounded) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const r = rounded ? size * 0.22 : 0;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * size);
      let R = 139 + (59 - 139) * t, G = 92 + (130 - 92) * t, B = 246 + (246 - 246) * t, A = 255;
      // rounded corners
      const cx = Math.min(Math.max(x, r), size - 1 - r), cy = Math.min(Math.max(y, r), size - 1 - r);
      if (r && Math.hypot(x - cx, y - cy) > r) A = 0;
      // face ellipse ring + two eye dots
      const ex = (x - size / 2) / (size * 0.26), ey = (y - size * 0.52) / (size * 0.33);
      const d = Math.hypot(ex, ey);
      const ring = Math.abs(d - 1) < 0.07;
      const eye = Math.hypot(x - size * 0.42, y - size * 0.46) < size * 0.035 || Math.hypot(x - size * 0.58, y - size * 0.46) < size * 0.035;
      if ((ring || eye) && A) { R = G = B = 255; }
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = R; raw[i + 1] = G; raw[i + 2] = B; raw[i + 3] = A;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

writeFileSync(join(out, 'icon-192.png'), icon(192, false));
writeFileSync(join(out, 'icon-512.png'), icon(512, false));
writeFileSync(join(out, 'apple-touch-icon.png'), icon(180, false));
writeFileSync(join(out, 'icon-rounded-512.png'), icon(512, true));
writeFileSync(join(out, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#g)"/><ellipse cx="32" cy="33" rx="16" ry="21" fill="none" stroke="#fff" stroke-width="3"/><circle cx="27" cy="29" r="2.2" fill="#fff"/><circle cx="37" cy="29" r="2.2" fill="#fff"/></svg>`);
console.log('Icons written to public/');
