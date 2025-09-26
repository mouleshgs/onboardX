/**
 * test_rag.js
 *
 * Lightweight in-memory test of the RAG pipeline using deterministic hash embeddings.
 * This avoids Pinecone and heavy native TF bindings so it runs on low-memory systems.
 *
 * Usage: node test_rag.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'datasets');

function chunkText(text, chunkSize = 250, overlap = 50) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    let chunk = text.slice(start, end).trim();
    if (end < text.length) {
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > Math.floor(chunk.length * 0.6)) chunk = chunk.slice(0, lastSpace);
    }
    if (chunk.length === 0) break;
    chunks.push(chunk);
    start = start + (chunk.length - overlap);
  }
  return chunks;
}

function hashEmbedding(text, dim = 128) {
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

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s);
}

function cosineSim(a, b) {
  const na = norm(a); const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

async function runTest() {
  const file = path.join(DATA_DIR, 'AI-onboarding-course.md');
  if (!fs.existsSync(file)) {
    console.error('Test file not found:', file);
    process.exit(1);
  }
  const text = fs.readFileSync(file, 'utf8');
  const chunks = chunkText(text, 400, 80);
  console.log('Chunks:', chunks.length);

  const dim = parseInt(process.env.TEST_HASH_DIM) || 128;
  const vectors = chunks.map((c, i) => ({ id: `chunk_${i}`, text: c, vec: hashEmbedding(c, dim) }));

  const query = process.argv.slice(2).join(' ') || 'How do I upload signed documents?';
  console.log('Query:', query);
  const qvec = hashEmbedding(query, dim);

  const scored = vectors.map(v => ({ id: v.id, score: cosineSim(qvec, v.vec), text: v.text }));
  scored.sort((a, b) => b.score - a.score);

  console.log('\nTop results:');
  scored.slice(0, 3).forEach((r, i) => {
    console.log(`\n[${i+1}] score=${r.score.toFixed(4)} id=${r.id}`);
    console.log(r.text.slice(0, 400));
  });
}

runTest();
