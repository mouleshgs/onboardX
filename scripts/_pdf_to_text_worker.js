// worker: reads a PDF file path passed as first arg, parses to text using pdf-parse, and writes out .txt next to PDF
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function run() {
  const file = process.argv[2];
  if (!file) {
    console.error('No file path provided');
    process.exit(2);
  }
  try {
    const abs = require('path').resolve(file);
    const data = fs.readFileSync(abs);
    const parsed = await pdf(data);
    const text = parsed && parsed.text ? parsed.text : '';
    const out = path.join(path.dirname(abs), path.basename(abs, path.extname(abs)) + '.txt');
    fs.writeFileSync(out, text, 'utf8');
    console.log('WROTE', out);
    process.exit(0);
  } catch (e) {
    console.error('WORKER ERROR for', file, e && e.message);
    process.exit(3);
  }
}

run();
