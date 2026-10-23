import { readFile } from 'node:fs/promises';
import { extract } from '../src/extract.mjs';

const files = [
  'D:/Indian ACT/Bharatiya Nyaya Sanhita 2023.pdf',
  'D:/Indian ACT/it_act_2000_updated.pdf',
  'D:/Indian ACT/Digital Personal Data Protection Rules 2025.pdf',
];
for (const f of files) {
  const t0 = Date.now();
  try {
    const buf = await readFile(f);
    const r = await extract(buf, f.split('/').pop(), 'application/pdf');
    const chars = r.text.length;
    const nonEmpty = r.pages.length;
    const avg = nonEmpty ? Math.round(chars / nonEmpty) : 0;
    console.log(`\n=== ${f.split('/').pop()}`);
    console.log(`   ${(buf.length/1048576).toFixed(1)}MB | ${r.pageCount} pages | ${nonEmpty} with text | ${chars.toLocaleString()} chars | ${avg} avg | ${Date.now()-t0}ms`);
    const withIdx = r.pages.find(p => /process|prohibit|punish|section/i.test(p.text));
    const sample = (withIdx ?? r.pages[0])?.text ?? '';
    console.log('   sample:', JSON.stringify(sample.slice(0,150).replace(/\s+/g,' ')));
  } catch (e) { console.log(`\n=== ${f.split('/').pop()}\n   FAILED: ${e.message}`); }
}
