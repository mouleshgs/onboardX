const OpenAI = require('openai');
const pineconePkg = require('@pinecone-database/pinecone');
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
