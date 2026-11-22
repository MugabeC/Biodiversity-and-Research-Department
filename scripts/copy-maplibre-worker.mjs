// The map library's background worker has to be served as a plain file. This copies it (and the file it imports)
// into public/maplibre before every build, so it always matches the installed version of the library.
import { copyFileSync, mkdirSync } from 'node:fs';

const from = 'node_modules/maplibre-gl/dist';
const to = 'public/maplibre';
mkdirSync(to, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) copyFileSync(`${from}/${file}`, `${to}/${file}`);
console.log('Copied the map worker to public/maplibre');
