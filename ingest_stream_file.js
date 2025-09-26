/**
 * ingest_stream_file.js
 * Stream the file `datasets/AI-onboarding-course.md`, chunk incrementally
 * and upsert each chunk immediately to avoid high memory usage.
 *
 * Usage: node ingest_stream_file.js
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

    const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE) || 800;
    const OVERLAP = parseInt(process.env.CHUNK_OVERLAP) || 120;

    const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 16 * 1024 });
    let buf = '';
    let chunkIndex = 0;
    for await (const piece of stream) {
      buf += piece;
      while (buf.length >= CHUNK_SIZE) {
        let chunk = buf.slice(0, CHUNK_SIZE);
        // try to break at last space
        const lastSpace = chunk.lastIndexOf(' ');
        if (lastSpace > Math.floor(chunk.length * 0.6)) chunk = chunk.slice(0, lastSpace);
        const id = `AI_onboarding_stream_chunk_${chunkIndex}`;
        const vec = hashEmbedding(chunk, dim);
        try {
          await index.upsert([{ id, values: vec, metadata: { source: 'AI-onboarding-course.md', chunkIndex, text: chunk.slice(0, 200) } }]);
          console.log('Upserted chunk', chunkIndex);
        } catch (e) {
          console.error('Upsert error for chunk', chunkIndex, e && e.message);
        }
        chunkIndex += 1;
        // advance buffer with overlap
        buf = buf.slice(Math.max(0, CHUNK_SIZE - OVERLAP));
      }
    }

    // final flush
    if (buf && buf.trim().length > 20) {
      const chunk = buf.trim();
      const id = `AI_onboarding_stream_chunk_${chunkIndex}`;
      const vec = hashEmbedding(chunk, dim);
      try {
        await index.upsert([{ id, values: vec, metadata: { source: 'AI-onboarding-course.md', chunkIndex, text: chunk.slice(0, 200) } }]);
        console.log('Upserted final chunk', chunkIndex);
      } catch (e) {
        console.error('Upsert error for final chunk', e && e.message);
      }
    }

    console.log('Streaming ingest complete. Running a verification query using the first chunk...');
    try {
      // create vector for a small snippet to query
      const qVec = hashEmbedding('AI Onboarding Course', dim);
      const qres = await index.query({ topK: 5, vector: qVec, includeMetadata: true });
      console.log('Query verification matches:', JSON.stringify(qres.matches || qres, null, 2));
    } catch (e) {
      console.error('Query verification failed:', e && e.message);
    }

  } catch (err) {
    console.error('Error:', err && err.message);
    if (err && err.stack) console.error(err.stack);
    process.exit(1);
  }
}

if (require.main === module) run();
