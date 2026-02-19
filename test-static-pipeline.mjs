import Database from 'better-sqlite3';

const db = new Database('storage.db');

// Get a static creative
const creative = db.prepare('SELECT * FROM foreplay_creatives WHERE type = ? LIMIT 1').get('STATIC');
if (!creative) {
  console.error('No static creatives found');
  process.exit(1);
}

console.log('Found creative:', creative.id, creative.title);

// Create a test pipeline run
const result = db.prepare(`
  INSERT INTO pipeline_runs (
    product, priority, type, status,
    foreplayAdId, foreplayAdTitle, foreplayAdBrand,
    staticStage, createdAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'Hyperburn',
  'High',
  'STATIC',
  'running',
  creative.id,
  creative.title,
  creative.brandName || 'Unknown',
  'stage_1_analysis',
  new Date().toISOString()
);

const runId = result.lastInsertRowid;
console.log('Created pipeline run:', runId);

// Add the static ad image
db.prepare(`
  UPDATE pipeline_runs 
  SET staticAdImages = ?
  WHERE id = ?
`).run(
  JSON.stringify([{
    id: creative.id,
    imageUrl: creative.imageUrl,
    brandName: creative.brandName,
    title: creative.title
  }]),
  runId
);

console.log('Test run created. Now call the API to start it...');
console.log(`curl -X POST http://localhost:3000/api/trpc/pipeline.runStaticPipeline -H "Content-Type: application/json" -d '{"runId":${runId},"input":{"product":"Hyperburn","priority":"High","selectedAdId":"${creative.id}","selectedAdImage":{"id":"${creative.id}","imageUrl":"${creative.imageUrl}","brandName":"${creative.brandName || 'Unknown'}","title":"${creative.title}"}}}'`);

db.close();
