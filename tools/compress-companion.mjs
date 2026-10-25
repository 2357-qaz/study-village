// Lossless transport only; the authored .bin, geometry, paint and topology remain unchanged.
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const assets = new URL('../dist/assets/', import.meta.url),
  manifestURL = new URL('companion-v10.json', assets),
  source = await fs.readFile(new URL('companion-v10.bin', assets)),
  packed = gzipSync(source, {level: 9}),
  digest = createHash('sha256').update(packed).digest('hex'),
  file = `companion-v10.${digest.slice(0, 16)}.bin.gz`,
  manifest = JSON.parse(await fs.readFile(manifestURL, 'utf8'));
manifest.compressed = {file, bytes: packed.length, decodedBytes: source.length};
await fs.writeFile(new URL(file, assets), packed);
await fs.writeFile(manifestURL, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `${source.length} → ${packed.length} bytes (${(100 * (1 - packed.length / source.length)).toFixed(1)}% smaller): ${file}`
);
