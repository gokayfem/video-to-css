import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

// Decoded image: { width, height, data: Uint8Array RGBA }
export function readPNG(p) {
  const png = PNG.sync.read(readFileSync(p));
  return { width: png.width, height: png.height, data: png.data };
}

export function decodePNG(buf) {
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: png.data };
}

export function writePNG(p, img) {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length);
  writeFileSync(p, PNG.sync.write(png));
}

export function rgbToRGBA(rgb, width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += 3) {
    data[i * 4] = rgb[j];
    data[i * 4 + 1] = rgb[j + 1];
    data[i * 4 + 2] = rgb[j + 2];
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}
