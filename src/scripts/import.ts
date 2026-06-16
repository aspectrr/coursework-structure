import 'dotenv/config';
import { importAll } from '../lib/importRunner';

const root = process.env.COURSES_DIR ?? '/courses';

console.log(`Scanning ${root} for MIT OCW courses...`);

importAll(root)
  .then((results) => {
    console.log('\nImport results:');
    for (const r of results) {
      const status = r.ok ? (r.updated ? 'UPDATED' : 'IMPORTED') : 'FAILED';
      console.log(`  ${status.padEnd(10)} ${r.slug} — ${r.title}${r.error ? `  (${r.error})` : ''}`);
    }
    console.log(`\nDone: ${results.length} course(s).`);
    process.exit(0);
  })
  .catch((e) => {
    console.error('Import failed:', e);
    process.exit(1);
  });
