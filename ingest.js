/**
 * ingest.js
 *
 * Ingest Markdown (.md) and PDF (.pdf) files from the `datasets/` directory,
 * extract text, chunk it, create embeddings with OpenAI, and store them in
 * Pinecone with metadata { source, type, filename, chunkIndex }.
 *
 * Environment variables required:
 * - OPENAI_API_KEY  : OpenAI API key
 * - PINECONE_API_KEY: Pinecone API key
 * - PINECONE_ENV    : Pinecone environment/region (e.g. "us-west1-gcp")
 * - PINECONE_INDEX  : Pinecone index name to use/create
 *
 * Install dependencies:
 * npm install openai @pinecone-database/pinecone pdf-parse glob fs-extra
 *
 * Usage:
 * node ingest.js
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const glob = require('glob');
const fse = require('fs-extra');
const OpenAI = require('openai');
// We'll use the Pinecone SDK directly where available
const pineconePkg = require('@pinecone-database/pinecone');
const child_process = require('child_process');

require('dotenv').config();

const DATA_DIR = path.join(__dirname, 'datasets');
const BATCH_SIZE = parseInt(process.env.INGEST_BATCH_SIZE) || 10; // smaller default to reduce memory usage
const INGEST_MAX_FILES = parseInt(process.env.INGEST_MAX_FILES) || undefined; // optional limit for safety

// Simple chunking by character length with overlap
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

// Streaming chunker for text files — yields chunks to process without holding entire file
async function* chunkFileStream(filePath, chunkSize = 800, overlap = 120) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 16 * 1024 });
  let buf = '';
  for await (const piece of stream) {
    buf += piece;
    while (buf.length >= chunkSize) {
      let chunk = buf.slice(0, chunkSize);
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > Math.floor(chunk.length * 0.6)) chunk = chunk.slice(0, lastSpace);
      yield chunk.trim();
      buf = buf.slice(Math.max(0, chunkSize - overlap));
    }
  }
  if (buf && buf.trim().length > 20) yield buf.trim();
}

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.md' || ext === '.markdown') {
    return fs.readFileSync(filePath, 'utf8');
  }
  if (ext === '.pdf') {
    const data = fs.readFileSync(filePath);
    try {
      const parsed = await pdf(data);
      return parsed.text || '';
    } catch (e) {
      console.error('Failed to parse PDF', filePath, e && e.message);
      return '';
    }
  }
  return '';
}

let useModel = null;

async function initEmbeddingModel() {
  // If OPENAI_API_KEY present, prefer OpenAI embeddings. Otherwise, try to load Universal Sentence Encoder locally (tfjs)
  if (process.env.OPENAI_API_KEY) {
    return { type: 'openai', client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) };
  }
  // Fallback: use Universal Sentence Encoder locally (free). This requires tfjs-node and @tensorflow-models/universal-sentence-encoder installed.
  try {
    const use = require('@tensorflow-models/universal-sentence-encoder');
    const tf = require('@tensorflow/tfjs-node');
    const model = await use.load();
    return { type: 'use', client: model };
  } catch (e) {
    console.warn('No OPENAI_API_KEY and failed to load local USE model:', e && e.message);
    console.warn('Falling back to deterministic hash-based embeddings (lower quality but free).');
    return { type: 'hash', client: null };
  }
}

async function getEmbeddings(modelHandle, inputs) {
  // inputs: array of strings
  if (!modelHandle) throw new Error('No embedding model initialized');
  if (modelHandle.type === 'openai') {
    const openai = modelHandle.client;
    const embRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input: inputs });
    return embRes.data.map(d => d.embedding);
  }
  if (modelHandle.type === 'use') {
    // modelHandle.client is the loaded USE model
    const model = modelHandle.client;
    // USE supports batching; it returns a tensor
    const embeddingsTensor = await model.embed(inputs);
    const arr = await embeddingsTensor.array();
    embeddingsTensor.dispose && embeddingsTensor.dispose();
    return arr;
  }
  if (modelHandle.type === 'hash') {
    // deterministic hash-based embedding: convert SHA256 stream into float vector
    const crypto = require('crypto');
    const dim = parseInt(process.env.HASH_DIM) || 128; // will be overridden by index dimension when available
    return inputs.map(text => {
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
    });
  }
  throw new Error('Unsupported model type');
}

async function main() {
  const PINECONE_API_KEY = process.env.PINECONE_API_KEY || process.env.pinecone_api_key;
  const PINECONE_ENV = process.env.PINECONE_ENV || process.env.pinecone_env || process.env.PINECONE_ENVIRONMENT || process.env.pinecone_environment;
  const PINECONE_INDEX = process.env.PINECONE_INDEX || process.env.pinecone_index;
  if (!PINECONE_API_KEY || !PINECONE_ENV || !PINECONE_INDEX) {
    console.error('PINECONE_API_KEY (or pinecone_api_key), PINECONE_ENV (or pinecone_env) and PINECONE_INDEX (or pinecone_index) are required in environment');
    process.exit(1);
  }

  const modelHandle = await initEmbeddingModel();
  if (!modelHandle) {
    console.error('No embedding model available. Set OPENAI_API_KEY or install @tensorflow-models/universal-sentence-encoder and @tensorflow/tfjs-node');
    process.exit(1);
  }

  // Optionally convert PDFs to .txt first to avoid parsing PDFs in this main process.
  const convertFlag = process.env.CONVERT_PDFS === '1' || process.env.CONVERT_PDFS === 'true' || process.argv.includes('--convert');
  async function convertPdfsWithWorker() {
    const worker = path.join(__dirname, 'scripts', '_pdf_to_text_worker.js');
    if (!fs.existsSync(worker)) {
      console.warn('Worker script not found:', worker);
      return;
    }
    const pdfs = glob.sync('**/*.pdf', { cwd: DATA_DIR, absolute: true }) || [];
    for (const pdfPath of pdfs) {
      try {
        const txtPath = pdfPath.replace(/\.pdf$/i, '.txt');
        if (fs.existsSync(txtPath)) {
          // already converted
          continue;
        }
        console.log('Converting PDF to text (worker):', path.relative(DATA_DIR, pdfPath));
        const args = ['--max-old-space-size=4096', worker, pdfPath];
        const res = child_process.spawnSync(process.execPath, args, { stdio: 'inherit' });
        if (res.error) {
          console.error('Failed to spawn worker for', pdfPath, res.error && res.error.message);
        } else if (res.status !== 0) {
          console.warn('Worker exited with code', res.status, 'for', pdfPath);
        }
      } catch (e) {
        console.error('PDF convert error', pdfPath, e && e.message);
      }
    }
  }
  if (convertFlag) {
    console.log('CONVERT_PDFS set — converting PDFs to .txt before ingest');
    await convertPdfsWithWorker();
  }

  // Initialize Pinecone client using the package
  const Pinecone = pineconePkg.Pinecone;
  const explicitController = process.env.PINECONE_CONTROLLER_HOST || process.env.PINECONE_CONTROLLER_URL || process.env.PINECONE_API_HOST;
  const looksLikeIndexHost = explicitController && /\.svc\.|\.pinecone\.io/.test(explicitController) && !/controller\./i.test(explicitController);
  let controllerHostUrl = undefined;
  if (explicitController && /controller\./i.test(explicitController)) {
    controllerHostUrl = explicitController;
  } else if (!explicitController && PINECONE_ENV && PINECONE_ENV.match(/^[a-z0-9-]+$/i)) {
    controllerHostUrl = `https://controller.${PINECONE_ENV}.pinecone.io`;
  }
  const pineconeClient = controllerHostUrl ? new Pinecone({ apiKey: PINECONE_API_KEY, controllerHostUrl }) : new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = looksLikeIndexHost ? pineconeClient.index(PINECONE_INDEX, explicitController) : pineconeClient.index(PINECONE_INDEX);

  // Gather files (md / pdf)
  const patterns = ['**/*.md', '**/*.markdown', '**/*.txt', '**/*.pdf'];
  let files = patterns.map(p => glob.sync(p, { cwd: DATA_DIR, absolute: true })).flat().filter(Boolean);
  if (!files.length) {
    console.log('No files found in datasets/ to ingest');
    return;
  }
  if (INGEST_MAX_FILES) files = files.slice(0, INGEST_MAX_FILES);
  console.log(`Found ${files.length} files to ingest`);

  // Get index dimension for HASH fallback
  let indexDim = parseInt(process.env.HASH_DIM) || undefined;
  try {
    const desc = await pineconeClient.describeIndex(PINECONE_INDEX);
    if (desc && desc.dimension) indexDim = desc.dimension;
    console.log('Index dimension detected:', indexDim);
  } catch (e) {
    console.warn('Could not describe index to get dimension; using HASH_DIM env or 128');
  }
  if (!indexDim) indexDim = parseInt(process.env.HASH_DIM) || 128;

  // Process files in streaming fashion to avoid OOM
  let fileCount = 0;
  for (const filePath of files) {
    fileCount += 1;
    const rel = path.relative(DATA_DIR, filePath);
    const ext = path.extname(filePath).toLowerCase();
  const type = ext === '.pdf' ? 'pdf' : 'text';
    console.log('Processing', rel);

    if (ext === '.pdf') {
      // PDFs are loaded fully (pdf-parse requires buffer). To avoid OOM, skip large PDFs by default.
      const stats = fs.statSync(filePath);
      const MAX_PDF_BYTES = parseInt(process.env.MAX_PDF_BYTES) || 5 * 1024 * 1024; // 5MB default
      const forcePdf = process.env.FORCE_PDF === '1' || process.env.FORCE_PDF === 'true';
      if (stats.size > MAX_PDF_BYTES && !forcePdf) {
        console.warn(`Skipping PDF ${rel} (size ${Math.round(stats.size/1024)} KB) — set FORCE_PDF=1 to override`);
        continue;
      }
      // safe to load
      const data = fs.readFileSync(filePath);
      let parsedText = '';
      try {
        const parsed = await pdf(data);
        parsedText = parsed.text || '';
      } catch (e) {
        console.error('Failed to parse PDF', rel, e && e.message);
        continue;
      }
      if (!parsedText || parsedText.trim().length < 10) {
        console.warn('Skipping empty PDF:', rel);
        continue;
      }
      const chunks = chunkText(parsedText, 800, 120);
      console.log(`  -> ${chunks.length} chunks (pdf)`);
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const inputs = batch.map(b => b);
        try {
          const embeddings = await getEmbeddings(modelHandle, inputs.map(x=>x));
          const vectors = batch.map((b, idx) => ({ id: `${rel.replace(/[^a-zA-Z0-9-_\.]/g, '_')}_chunk_${i + idx}`, values: embeddings[idx], metadata: { source: rel, type, filename: rel, chunkIndex: i + idx, text: b } }));
          await index.upsert(vectors);
          console.log(`    upserted ${vectors.length} vectors`);
        } catch (e) {
          console.error('Embedding/upsert error (pdf)', e && e.message);
        }
      }
    } else {
      // Stream text files
      try {
        let chunkIndex = 0;
        for await (const chunk of chunkFileStream(filePath, 800, 120)) {
          const id = `${rel.replace(/[^a-zA-Z0-9-_\.]/g, '_')}_chunk_${chunkIndex}`;
          try {
            let emb;
            if (modelHandle.type === 'hash') {
              // generate hash vector with indexDim
              const crypto = require('crypto');
              let buf = Buffer.alloc(0);
              let seed = chunk || '';
              while (buf.length < indexDim * 4) {
                const h = crypto.createHash('sha256').update(seed).digest();
                buf = Buffer.concat([buf, h]);
                seed = h.toString('hex') + seed;
              }
              const vec = new Array(indexDim);
              for (let vi = 0; vi < indexDim; vi++) {
                const off = vi * 4;
                const v = buf.readUInt32BE(off);
                vec[vi] = (v / 0xffffffff) * 2 - 1;
              }
              emb = vec;
            } else {
              const arr = await getEmbeddings(modelHandle, [chunk]);
              emb = arr[0];
            }
            await index.upsert([{ id, values: emb, metadata: { source: rel, type, filename: rel, chunkIndex, text: chunk.slice(0, 500) } }]);
            console.log('  upserted chunk', chunkIndex);
          } catch (e) {
            console.error('Chunk upsert error', e && e.message);
          }
          chunkIndex += 1;
        }
      } catch (e) {
        console.error('Streaming file error', e && e.message);
      }
    }
  }

  console.log('Ingestion complete');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
