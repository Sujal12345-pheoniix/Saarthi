const fs = require('fs');
const path = require('path');

async function main() {
  const base = 'http://localhost:3000';
  const uploadPath = '/api/upload';
  const reportPath = '/api/reports/skin';

  const filePath = path.join(__dirname, '..', 'public', 'file.svg');
  if (!fs.existsSync(filePath)) {
    console.error('Test file not found at', filePath);
    process.exit(2);
  }

  const FormData = globalThis.FormData;
  if (!FormData) {
    console.error('Global FormData not available in this Node runtime.');
    process.exit(2);
  }

  const form = new FormData();
  form.append('folder', 'saarthi/skin');
  form.append('file', fs.createReadStream(filePath));

  console.log('Uploading', filePath, 'to', base + uploadPath);
  const upRes = await fetch(base + uploadPath, { method: 'POST', body: form });
  const upJson = await upRes.text();
  console.log('Upload HTTP', upRes.status);
  console.log('Upload body:', upJson);

  let imageUrl = null;
  try {
    const parsed = JSON.parse(upJson);
    imageUrl = parsed.url || parsed.result?.url || null;
  } catch (e) {}

  const body = {
    skinType: 'Normal',
    concerns: ['dryness'],
    hydration: 68,
    sunExposure: 2,
    sleepHours: 7,
    imageUrl,
  };

  console.log('Posting skin report to', base + reportPath);
  const repRes = await fetch(base + reportPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const repJson = await repRes.text();
  console.log('Report HTTP', repRes.status);
  console.log('Report body:', repJson);

  process.exit(repRes.ok && upRes.ok ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
