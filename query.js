/**
 * query.js
 *
 * CLI for querying the vector store (Pinecone). Usage:
 *
 * Environment variables required:
 * - OPENAI_API_KEY
 * - PINECONE_API_KEY
 * - PINECONE_ENV
 * - PINECONE_INDEX
 *
 * Install dependencies:
 * npm install openai @pinecone-database/pinecone readline-sync
 *
 * Usage examples:
 * node query.js "What does the onboarding course say about contracts?"
 * or run without args to get an interactive prompt.
 */

const OpenAI = require('openai');
const pineconePkg = require('@pinecone-database/pinecone');
const readlineSync = require('readline-sync');
require('dotenv').config();

async function initClients() {
  const PINECONE_API_KEY = process.env.PINECONE_API_KEY || process.env.pinecone_api_key;
  const PINECONE_ENV = process.env.PINECONE_ENV || process.env.pinecone_env || process.env.PINECONE_ENVIRONMENT || process.env.pinecone_environment;
  const PINECONE_INDEX = process.env.PINECONE_INDEX || process.env.pinecone_index;
  if (!PINECONE_API_KEY || !PINECONE_ENV || !PINECONE_INDEX) throw new Error('PINECONE_API_KEY (or pinecone_api_key), PINECONE_ENV (or pinecone_env or PINECONE_ENVIRONMENT) and PINECONE_INDEX (or pinecone_index) required');
  // init pinecone client
  const Pinecone = pineconePkg.Pinecone;
  const explicitController = process.env.PINECONE_CONTROLLER_HOST || process.env.PINECONE_CONTROLLER_URL || process.env.PINECONE_API_HOST;
  const looksLikeIndexHost = explicitController && /\.svc\.|\.pinecone\.io/.test(explicitController) && !/controller\./i.test(explicitController);
  let controllerHostUrl = undefined;
  if (explicitController && /controller\./i.test(explicitController)) {
    controllerHostUrl = explicitController;
  } else if (!explicitController && PINECONE_ENV && PINECONE_ENV.match(/^[a-z0-9-]+$/i)) {
    controllerHostUrl = `https://controller.${PINECONE_ENV}.pinecone.io`;
  }
  const pinecone = controllerHostUrl ? new Pinecone({ apiKey: PINECONE_API_KEY, controllerHostUrl }) : new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = looksLikeIndexHost ? pinecone.index(PINECONE_INDEX, explicitController) : pinecone.index(PINECONE_INDEX);

  // Try to detect index dimension so we can match hash fallback vectors to the index
  let indexDim = parseInt(process.env.HASH_DIM) || 512;
  try {
    const desc = await pinecone.describeIndex(PINECONE_INDEX);
    if (desc && desc.dimension) indexDim = desc.dimension;
  } catch (e) {
    // ignore
  }

  // embedding model: prefer OpenAI if key present, otherwise try local USE
  let embeddingModel = null;
  let openai = null;
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    embeddingModel = { type: 'openai', client: openai };
  } else {
    // try local USE
    try {
      const use = require('@tensorflow-models/universal-sentence-encoder');
      const tf = require('@tensorflow/tfjs-node');
      const model = await use.load();
      embeddingModel = { type: 'use', client: model };
    } catch (e) {
      console.warn('No OPENAI_API_KEY and failed to load local USE model:', e && e.message);
      console.warn('Falling back to deterministic hash-based embeddings (lower quality but free).');
      embeddingModel = { type: 'hash', client: null, dim: indexDim };
    }
  }

  return { openai, index, embeddingModel, indexDim };
}

// Defensive fetch-by-id wrapper: returns parsed JSON or null when empty
async function safeFetchById(index, id) {
  try {
    return await index.fetch({ ids: [id] });
  } catch (e) {
    if (e && e.message && e.message.includes('Unexpected end of JSON input')) {
      // fallback to raw HTTP fetch to inspect
      try {
        const PINECONE_API_KEY = process.env.PINECONE_API_KEY || process.env.pinecone_api_key;
        let host;
        try {
          const desc = await index._client.describeIndex(process.env.PINECONE_INDEX || process.env.pinecone_index);
          host = desc && desc.host;
        } catch (inner) {
          host = process.env.PINECONE_INDEX_HOST || process.env.PINECONE_API_HOST || process.env.PINECONE_CONTROLLER_HOST;
        }
        if (!host) return null;
        const url = host.startsWith('http') ? `${host}/vectors/fetch` : `https://${host}/vectors/fetch`;
        let fetchFn = global.fetch;
        if (!fetchFn) fetchFn = require('node-fetch');
        const resp = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Api-Key': PINECONE_API_KEY }, body: JSON.stringify({ ids: [id] }) });
        const text = await resp.text();
        if (!text || text.trim().length === 0) return null;
        return JSON.parse(text);
      } catch (rawErr) {
        return null;
      }
    }
    return null;
  }
}

async function embedText(openai, text) {
  // support two shapes: embedding model wrapper or openai client
  if (!openai) throw new Error('Embedding client missing');
  if (openai.type === 'openai') {
    const res = await openai.client.embeddings.create({ model: 'text-embedding-3-small', input: text });
    return res.data[0].embedding;
  }
  if (openai.type === 'use') {
    const arr = await openai.client.embed([text]);
    const tensor = arr; // universal use returns a tensor-like object when calling embed
    const values = await tensor.array();
    tensor.dispose && tensor.dispose();
    return values[0];
  }
  throw new Error('Unsupported embedding client');
}

async function queryPinecone(index, embedding, topK = 3) {
  const q = await index.query({
    topK,
    vector: embedding,
    includeMetadata: true,
    includeValues: false
  });
  // response typically has matches array
  const matches = (q && q.matches) || q;
  return (matches && matches.length) ? matches.slice(0, topK) : [];
}

function buildSystemPrompt(retrievedChunks) {
  return `You are a helpful assistant. Use the provided context chunks to answer the user's question. Be concise and cite the source filename for each fact you reference.

Context:
${retrievedChunks.map((c, i) => `---
Source: ${c.metadata && c.metadata.filename}
Chunk ${i}:
${c.metadata && c.metadata.textSnippet ? c.metadata.textSnippet : (c.metadata && c.metadata.source) || ''}
`).join('\n')}
`;
}

async function run() {
  const { openai, index, embeddingModel, indexDim } = await initClients();

  const userQuery = process.argv.slice(2).join(' ') || readlineSync.question('Enter your question: ');
  if (!userQuery || !userQuery.trim()) {
    console.error('No query provided');
    process.exit(1);
  }

  console.log('Embedding query...');
  // embed using selected embedding model
  let qEmb;
  if (embeddingModel && embeddingModel.type === 'openai') {
    const res = await embeddingModel.client.embeddings.create({ model: 'text-embedding-3-small', input: userQuery });
    qEmb = res.data[0].embedding;
  } else if (embeddingModel && embeddingModel.type === 'use') {
    const tensor = await embeddingModel.client.embed([userQuery]);
    const arr = await tensor.array();
    qEmb = arr[0];
    tensor.dispose && tensor.dispose();
  } else if (embeddingModel && embeddingModel.type === 'hash') {
    // deterministic hash-based fallback to produce a vector
    const crypto = require('crypto');
    const dim = (embeddingModel && embeddingModel.dim) || indexDim || parseInt(process.env.HASH_DIM) || 512;
    let buf = Buffer.alloc(0);
    let seed = userQuery || '';
    while (buf.length < dim * 4) {
      const h = crypto.createHash('sha256').update(seed).digest();
      buf = Buffer.concat([buf, h]);
      seed = h.toString('hex') + seed;
    }
    qEmb = new Array(dim);
    for (let i = 0; i < dim; i++) {
      const off = i * 4;
      const v = buf.readUInt32BE(off);
      qEmb[i] = (v / 0xffffffff) * 2 - 1;
    }
  } else {
    throw new Error('No embedding model available. Set OPENAI_API_KEY or install @tensorflow-models/universal-sentence-encoder and @tensorflow/tfjs-node');
  }

  console.log('Searching Pinecone...');
  const matches = await queryPinecone(index, qEmb, 3);

  if (!matches || matches.length === 0) {
    console.log('No relevant results found');
  }

  // Build context text by retrieving the original chunk text from metadata (we stored chunk text under metadata?)
  // Note: ingest.js stores the actual text in the vector values but for safety we include a snippet in metadata
  const retrieved = matches.map(m => ({
    id: m.id,
    score: m.score,
    metadata: m.metadata || {}
  }));

  console.log('Retrieved:');
  retrieved.forEach(r => console.log(`- ${r.id} (score=${r.score}) source=${r.metadata.source}`));

  // Request full text for context: if metadata included text, use it; otherwise we ask Pinecone to fetch values (not included earlier)
  // Build a simple prompt with top chunks joined
  const contextText = retrieved.map(r => {
    const meta = r.metadata || {};
    const txt = meta.text || meta.excerpt || '';
    return `Source: ${meta.source || meta.filename || 'unknown'}\n${txt}`;
  }).join('\n\n');

  const messages = [
    { role: 'system', content: 'You are a helpful assistant. Use the provided context to answer the question. If the information is not present in the context, say you don\'t know.' },
    { role: 'user', content: `Context:\n${contextText}\n\nQuestion:\n${userQuery}` }
  ];

  if (!openai) {
    // No OpenAI LLM access; return the retrieved chunks as the 'answer' to avoid cost
    console.log('\nNo OPENAI_API_KEY detected — returning retrieved chunks instead of calling GPT-4.');
    console.log('\n=== RETRIEVED CHUNKS ===\n');
    retrieved.forEach((r, i) => {
      console.log(`--- [${i+1}] ${r.id} (score=${r.score}) source=${r.metadata.source}`);
      console.log(r.metadata.text || '(no text in metadata)');
      console.log('\n');
    });
    return;
  }

  console.log('Calling GPT-4...');
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    max_tokens: 800,
    temperature: 0.2
  });

  const answer = completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content;
  console.log('\n=== ANSWER ===\n');
  console.log(answer || 'No answer');
}

if (require.main === module) {
  run().catch(err => {
    console.error('Error:', err && err.message);
    process.exit(1);
  });
}
