// Run: npx tsx scripts/test_workbook_import.ts path/to/workbook.xlsx
// Checks that the website's importer produces exactly the files the Python importer wrote to public/data.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { convert, crossCheck, readWorkbook, REQUIRED_FILES } from '../app/lib/workbookImport';

(async () => {
  const buf = readFileSync(process.argv[2]);
  const wb = await readWorkbook(new Uint8Array(buf));
  const conv = convert(wb);
  const check = crossCheck(wb, conv);
  console.log(`Monthly_Summary cross-check: ${check.checked} figures compared, ${check.differences.length} differences, ${check.warnings.length} confirmed-rule warnings`);
  for (const w of check.warnings) console.log('  warning', JSON.stringify(w));
  let bad = 0;
  for (const name of REQUIRED_FILES) {
    const expected = JSON.parse(readFileSync(`public/data/${name}`, 'utf8'));
    const got = JSON.parse(JSON.stringify(conv.files[name]));
    const same = isDeepStrictEqual(expected, got);
    console.log(same ? 'SAME     ' : 'DIFFERENT', name);
    if (!same) { bad++; console.log('  expected', JSON.stringify(expected).slice(0, 300)); console.log('  got     ', JSON.stringify(got).slice(0, 300)); }
  }
  console.log(conv.notes.length ? `notes: ${conv.notes.join(' | ')}` : 'no notes');
  process.exit(bad || check.differences.length ? 1 : 0);
})();
