// tiny_test_rag.js
// Very small memory test of hash-based embedding and retrieval.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'datasets');
const FILENAME = 'AI-onboarding-course.md';

function hashEmbedding(text, dim = 32) {
  let buf = Buffer.alloc(0);
  let seed = text || '';
  while (buf.length < dim * 4) {
    const h = crypto.createHash('sha256').update(seed).digest();
    buf = Buffer.concat([buf, h]);
    seed = h.toString('hex') + seed;
  }
  const vec = new Array(dim);
  for (let i = 0; i < dim; i++) {
    const off = i * 4;
    const v = buf.readUInt32BE(off);
    vec[i] = (v / 0xffffffff) * 2 - 1;
  }
  return vec;
}

function dot(a, b) { let s = 0; for (let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; }
function norm(a){ let s=0; for (let i=0;i<a.length;i++) s+=a[i]*a[i]; return Math.sqrt(s); }
function cosine(a,b){ const na=norm(a), nb=norm(b); if(na==0||nb==0) return 0; return dot(a,b)/(na*nb); }

try{
  const p = path.join(DATA_DIR, FILENAME);
  if(!fs.existsSync(p)) { console.error('File not found:', p); process.exit(1); }
  const text = fs.readFileSync(p,'utf8').slice(0,800);
  const q = process.argv.slice(2).join(' ') || 'How to upload signed documents?';
  const dim = parseInt(process.env.TEST_HASH_DIM) || 32;
  const vecText = hashEmbedding(text, dim);
  const vecQ = hashEmbedding(q, dim);
  console.log('Text snippet length:', text.length);
  console.log('Vector dim:', dim);
  console.log('Cosine similarity between snippet and query:', cosine(vecText, vecQ).toFixed(4));
}catch(e){ console.error('Error in tiny test', e && e.message); process.exit(1); }
