const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../public/images/species');
const MAX_WIDTH = 800;
const QUALITY = 80;
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function collectFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(full));
    } else if (EXTS.has(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

async function compress(file) {
  const before = fs.statSync(file).size;
  const ext = path.extname(file).toLowerCase();
  const tmp = file + '.tmp';

  const img = sharp(file).resize({ width: MAX_WIDTH, withoutEnlargement: true });

  if (ext === '.png') {
    await img.png({ quality: QUALITY }).toFile(tmp);
  } else {
    await img.jpeg({ quality: QUALITY, mozjpeg: true }).toFile(tmp);
  }

  fs.renameSync(tmp, file);
  const after = fs.statSync(file).size;
  return { before, after };
}

(async () => {
  const files = await collectFiles(ROOT);
  console.log(`Found ${files.length} images — compressing...`);

  let totalBefore = 0, totalAfter = 0;

  for (const file of files) {
    try {
      const { before, after } = await compress(file);
      totalBefore += before;
      totalAfter += after;
      const saved = ((1 - after / before) * 100).toFixed(1);
      console.log(`  ${path.relative(ROOT, file).padEnd(50)} ${(before/1024).toFixed(0).padStart(6)}KB → ${(after/1024).toFixed(0).padStart(5)}KB  (-${saved}%)`);
    } catch (e) {
      console.error(`  ERROR: ${file} — ${e.message}`);
    }
  }

  const totalSaved = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
  console.log(`\nTotal: ${(totalBefore/1024/1024).toFixed(2)} MB → ${(totalAfter/1024/1024).toFixed(2)} MB  (-${totalSaved}%)`);
})();
