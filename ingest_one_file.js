/**
 * ingest_one_file.js
 *
 * Ingest a single file (`datasets/AI-onboarding-course.md`) into Pinecone using
 * deterministic hash embeddings. This script will:
 * - read the index's dimension via describeIndex
 * - chunk the file
 * - generate hash embeddings with the index dimension
 * - upsert the chunks into the index
 * - run a query using the first chunk's vector to confirm ingestion
 *
 * Usage: node ingest_one_file.js
 * Optional env:
 *  - INGEST_BATCH_SIZE (default 10)
 *
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function initPinecone() {
  const pineconePkg = require('@pinecone-database/pinecone');
  const PINECONE_API_KEY = process.env.PINECONE_API_KEY || process.env.pinecone_api_key;
  const PINECONE_ENV = process.env.PINECONE_ENV || process.env.PINECONE_ENVIRONMENT || process.env.pinecone_env || process.env.pinecone_environment;
  const PINECONE_INDEX = process.env.PINECONE_INDEX || process.env.pinecone_index;
  if (!PINECONE_API_KEY || !PINECONE_ENV || !PINECONE_INDEX) {
    throw new Error('PINECONE_API_KEY, PINECONE_ENV (or PINECONE_ENVIRONMENT), and PINECONE_INDEX required in .env');
  }

  const explicitController = process.env.PINECONE_CONTROLLER_HOST || process.env.PINECONE_CONTROLLER_URL || process.env.PINECONE_API_HOST;
  const looksLikeIndexHost = explicitController && /\.svc\.|\.pinecone\.io/.test(explicitController) && !/controller\./i.test(explicitController);
  let controllerHostUrl = undefined;
  if (explicitController && /controller\./i.test(explicitController)) {
    controllerHostUrl = explicitController;
  } else if (!explicitController && PINECONE_ENV && PINECONE_ENV.match(/^[a-z0-9-]+$/i)) {
    controllerHostUrl = `https://controller.${PINECONE_ENV}.pinecone.io`;
  }
  const pineconeClient = controllerHostUrl ? new pineconePkg.Pinecone({ apiKey: PINECONE_API_KEY, controllerHostUrl }) : new pineconePkg.Pinecone({ apiKey: PINECONE_API_KEY });
  const index = looksLikeIndexHost ? pineconeClient.index(PINECONE_INDEX, explicitController) : pineconeClient.index(PINECONE_INDEX);
  return { pineconeClient, index };
}

function chunkText(text, chunkSize = 800, overlap = 120) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    let chunk = text.slice(start, end).trim();
    if (end < text.length) {
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > Math.floor(chunk.length * 0.6)) chunk = chunk.slice(0, lastSpace);
    }
    chunks.push(chunk);
    start = start + (chunk.length - overlap);
    if (chunk.length === 0) break;
  }
  return chunks.filter(Boolean);
}

function hashEmbedding(text, dim) {
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

async function run() {
  try {
    const { pineconeClient, index } = await initPinecone();
    console.log('Connected to Pinecone');

    // get index dimension
    let dim = parseInt(process.env.HASH_DIM) || undefined;
    try {
      const desc = await pineconeClient.describeIndex(process.env.PINECONE_INDEX || process.env.pinecone_index);
      if (desc && desc.dimension) dim = desc.dimension;
    } catch (e) {
      console.warn('Could not describe index to get dimension, falling back to HASH_DIM or 128');
    }
    if (!dim) dim = parseInt(process.env.HASH_DIM) || 128;
    console.log('Using embedding dim=', dim);

    const DATA_DIR = path.join(__dirname, 'datasets');
    const filePath = path.join(DATA_DIR, 'AI-onboarding-course.md');
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      process.exit(1);
    }
    const text = fs.readFileSync(filePath, 'utf8');
    const chunks = chunkText(text, 800, 120);
    console.log(`File has ${chunks.length} chunks; ingesting up to first 5 chunks to avoid memory pressure`);

    const toIngest = chunks.slice(0, 5);
    const batchSize = parseInt(process.env.INGEST_BATCH_SIZE) || 10;
    for (let i = 0; i < toIngest.length; i += batchSize) {
      const batch = toIngest.slice(i, i + batchSize);
      const vectors = batch.map((c, idx) => {
        const id = `AI_onboarding_chunk_${i + idx}`;
        return { id, values: hashEmbedding(c, dim), metadata: { source: 'AI-onboarding-course.md', chunkIndex: i + idx, text: c } };
      });
      try {
        await index.upsert(vectors);
        console.log(`Upserted ${vectors.length} vectors`);
      } catch (e) {
        console.error('Upsert error:', e && e.message);
        if (e && e.stack) console.error(e.stack);
      }
    }

    // Query using first chunk's vector to confirm
    if (toIngest.length > 0) {
      const qVec = hashEmbedding(toIngest[0], dim);
      try {
        const qres = await index.query({ topK: 5, vector: qVec, includeMetadata: true });
        console.log('Query matches:', JSON.stringify(qres.matches || qres, null, 2));
      } catch (e) {
        console.error('Query error:', e && e.message);
        if (e && e.stack) console.error(e.stack);
      }
    }

    console.log('ingest_one_file.js complete');
  } catch (err) {
    console.error('Error:', err && err.message);
    if (err && err.stack) console.error(err.stack);
    process.exit(1);
  }
}

if (require.main === module) run();
