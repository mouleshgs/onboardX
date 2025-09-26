const OpenAI = require('openai');
const pineconePkg = require('@pinecone-database/pinecone');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initPineconeClient() {
  const PINECONE_API_KEY = process.env.PINECONE_API_KEY || process.env.pinecone_api_key;
  const PINECONE_ENV = process.env.PINECONE_ENV || process.env.pinecone_env || process.env.PINECONE_ENVIRONMENT || process.env.pinecone_environment;
  const PINECONE_INDEX = process.env.PINECONE_INDEX || process.env.pinecone_index;
  if (!PINECONE_API_KEY || !PINECONE_ENV || !PINECONE_INDEX) throw new Error('Pinecone env missing');

  const Pinecone = pineconePkg.Pinecone;
  const explicitController = process.env.PINECONE_CONTROLLER_HOST || process.env.PINECONE_CONTROLLER_URL || process.env.PINECONE_API_HOST;
  const looksLikeIndexHost = explicitController && /\.svc\.|\.pinecone\.io/.test(explicitController) && !/controller\./i.test(explicitController);
  let controllerHostUrl = undefined;
  if (explicitController && /controller\./i.test(explicitController)) controllerHostUrl = explicitController;
  else if (!explicitController && PINECONE_ENV && PINECONE_ENV.match(/^[a-z0-9-]+$/i)) controllerHostUrl = `https://controller.${PINECONE_ENV}.pinecone.io`;

  const pineconeClient = controllerHostUrl ? new Pinecone({ apiKey: PINECONE_API_KEY, controllerHostUrl }) : new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = looksLikeIndexHost ? pineconeClient.index(PINECONE_INDEX, explicitController) : pineconeClient.index(PINECONE_INDEX);
  return { pineconeClient, index };
}

async function getIndexDimension(pineconeClient) {
  let indexDim = parseInt(process.env.HASH_DIM) || undefined;
  try {
    const desc = await pineconeClient.describeIndex(process.env.PINECONE_INDEX || process.env.pinecone_index);
    if (desc && desc.dimension) indexDim = desc.dimension;
  } catch (e) {
    // ignore
  }
  if (!indexDim) indexDim = parseInt(process.env.HASH_DIM) || 512;
  return indexDim;
}

async function embedText(text) {
  // prefer OpenAI embeddings
  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
    return r.data[0].embedding;
  }
  // try local USE
  try {
    const use = require('@tensorflow-models/universal-sentence-encoder');
    const tf = require('@tensorflow/tfjs-node');
    const model = await use.load();
    const tensor = await model.embed([text]);
    const arr = await tensor.array();
    tensor.dispose && tensor.dispose();
    return arr[0];
  } catch (e) {
    // fallback to deterministic hash
    const crypto = require('crypto');
    const dim = parseInt(process.env.HASH_DIM) || 512;
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
}

async function queryPinecone(index, vector, topK=3) {
  const q = await index.query({ topK, vector, includeMetadata: true, includeValues: false });
  return (q && q.matches) || q || [];
}

// Minimal local keyword search over datasets to prefer exact/lexical matches
function localKeywordSearchSync(query, topK = 5) {
  const DATA_DIR = path.join(__dirname, '..', 'datasets');
  let files;
  try { files = fs.readdirSync(DATA_DIR); } catch (e) { return []; }
  const rawWords = (query || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  // crude stopword filter to avoid small filler words dominating score
  const stop = new Set(['the','and','or','an','a','to','of','in','on','for','is','what','how','when','where','by','with','be','you','your']);
  const qWords = rawWords.filter(w => w.length >= 3 && !stop.has(w));
  // if filtering removed too much, fall back to raw words
  if (qWords.length === 0) qWords.push(...rawWords.filter(Boolean));
  if (!qWords.length) return [];
  const cand = [];
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (!['.md', '.markdown', '.txt', '.pdf'].includes(ext)) continue;
    let txt = '';
    try { txt = fs.readFileSync(path.join(DATA_DIR, f), 'utf8'); } catch (e) { continue; }
    const textLower = txt.toLowerCase();
  let filenameMatches = 0;
  for (const w of qWords) if (f.toLowerCase().includes(w)) filenameMatches += 1;
  let contentMatches = 0;
  for (const w of qWords) if (textLower.indexOf(w) !== -1) contentMatches += 1;
  // base score weights filename matches higher
  let score = (1.5 * filenameMatches + contentMatches) / Math.max(1, qWords.length);
  // phrase boost for likely exact phrases
  if (textLower.indexOf('ai onboarding') !== -1 || textLower.indexOf('onboarding course') !== -1 || f.toLowerCase().indexOf('ai-onboarding') !== -1) score += 0.5;
    // excerpt around first match
    let excerpt = txt.slice(0, 800);
    for (const w of qWords) {
      const idx = textLower.indexOf(w);
      if (idx !== -1) { excerpt = txt.slice(Math.max(0, idx - 120), Math.min(txt.length, idx + 680)); break; }
    }
    cand.push({ filename: f, text: excerpt, score });
  }
  cand.sort((a,b)=>b.score - a.score);
  return cand.slice(0, topK);
}



async function callOpenAIChat(systemPrompt, userPrompt) {
  if (!process.env.OPENAI_API_KEY) return null;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const completion = await openai.chat.completions.create({ model: 'gpt-4', messages: [ { role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt } ], max_tokens: 800, temperature: 0.2 });
    const answer = completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content;
    return answer || null;
  } catch (e) {
    console.warn('OpenAI chat error', e && e.message);
    return null;
  }
}

async function getReply(message, req) {
  if (!message || !message.trim()) return 'Please provide a message.';

  // Quick local search first. If it yields a strong match (filename contains query
  // words or high lexical overlap), prefer it — this avoids noisy vector matches.
  try {
    const local = localKeywordSearchSync(message, 5);
    if (local && local.length) {
      const top = local[0];
      // if filename includes query terms or score high enough, return it directly
      const qWords = (message || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
      const filenameTokens = (top.filename || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const filenameMatch = qWords.every(w => filenameTokens.includes(w));
      if (filenameMatch || top.score >= 0.6) {
        // If OpenAI is available, ask it to craft a concise answer using the local excerpt as context
        const systemPrompt = 'You are an assistant that answers questions about onboarding documents. Use the provided context and cite sources when possible.';
        const userPrompt = `Context:\nSource: ${top.filename}\n${top.text}\n\nQuestion:\n${message}`;
        const aiReply = await callOpenAIChat(systemPrompt, userPrompt);
        if (aiReply) return aiReply;
        return `From ${top.filename}:\n${top.text.trim().slice(0,1000)}${top.text.length>1000 ? '...' : ''}`;
      }
    }
  } catch (e) {
    // ignore local search errors and continue to embedding/Pinecone path
  }

  // Otherwise proceed with embedding + Pinecone as before
  const { pineconeClient, index } = await initPineconeClient();
  // embedding
  let emb = await embedText(message);
  // ensure emb length matches index dim if possible
  const idxDim = await getIndexDimension(pineconeClient);
  if (Array.isArray(emb) && emb.length !== idxDim) {
    // if emb length differs, and we're using hash fallback, regenerate with idxDim
    try {
      const crypto = require('crypto');
      let buf = Buffer.alloc(0);
      let seed = message || '';
      while (buf.length < idxDim * 4) {
        const h = crypto.createHash('sha256').update(seed).digest();
        buf = Buffer.concat([buf, h]);
        seed = h.toString('hex') + seed;
      }
      const vec = new Array(idxDim);
      for (let i = 0; i < idxDim; i++) {
        const off = i * 4;
        const v = buf.readUInt32BE(off);
        vec[i] = (v / 0xffffffff) * 2 - 1;
      }
      emb = vec;
    } catch (e) {
      // ignore
    }
  }

  const matches = await queryPinecone(index, emb, 3);
  const top = matches.slice(0,3);
  const contextText = top.map(m => {
    const md = m.metadata || {};
    return `Source: ${md.filename || md.source || 'unknown'}\n${md.text || md.excerpt || ''}`;
  }).join('\n\n');

  const systemPrompt = 'You are an assistant that answers questions about onboarding documents. Use the provided context and cite sources when possible.';
  const userPrompt = `Context:\n${contextText}\n\nQuestion:\n${message}`;

  // If OpenAI is available, use chat to generate a final reply
  const aiReply = await callOpenAIChat(systemPrompt, userPrompt);
  if (aiReply) return aiReply;

  // Otherwise, return the retrieved chunks joined as a fallback
  if (!top || top.length === 0) return "I couldn't find anything relevant.";
  return top.map(m => (m.metadata && (m.metadata.text || m.metadata.excerpt)) || m.id).join('\n\n');
}

module.exports = { getReply };

// small welcome message used by the chat widget
function getWelcome() {
  const msg = process.env.RAG_WELCOME_MESSAGE || 'Hi — I can help with onboarding docs. Ask me about contracts, signatures, or how to verify documents.';
  return msg;
}

module.exports.getWelcome = getWelcome;
