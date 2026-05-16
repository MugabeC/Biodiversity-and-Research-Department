import { rmSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const dir of ['.next', join('node_modules', '.cache')]) {
  const p = join(root, dir);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}
