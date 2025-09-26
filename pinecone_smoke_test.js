/**
 * pinecone_smoke_test.js
 *
 * Tiny Pinecone smoke test: upsert a single deterministic vector and query it back.
 * Safe to run (single vector). Uses hash-based embedding to avoid heavy deps.
 *
 * Usage: node pinecone_smoke_test.js
 * Optional env: TEST_HASH_DIM to match your Pinecone index dimension (default: 128)
 */

require('dotenv').config();
const crypto = require('crypto');

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

async function initPinecone() {
  const PINECONE_API_KEY = process.env.PINECONE_API_KEY || process.env.pinecone_api_key;
  const PINECONE_ENV = process.env.PINECONE_ENV || process.env.pinecone_env || process.env.PINECONE_ENVIRONMENT || process.env.pinecone_environment;
  const PINECONE_INDEX = process.env.PINECONE_INDEX || process.env.pinecone_index;
  if (!PINECONE_API_KEY || !PINECONE_ENV || !PINECONE_INDEX) {
    throw new Error('PINECONE_API_KEY (or pinecone_api_key), PINECONE_ENV (or PINECONE_ENVIRONMENT) and PINECONE_INDEX required in environment');
  }

  const pineconePkg = require('@pinecone-database/pinecone');
  // new SDK: create client with config
  // Construct controllerHostUrl for the new Pinecone SDK if environment looks like a region
  // Allow explicit override of the controller host (useful if region naming differs)
  const explicitController = process.env.PINECONE_CONTROLLER_HOST || process.env.PINECONE_CONTROLLER_URL || process.env.PINECONE_API_HOST;
  // If explicitController looks like an index host (cluster host), we'll pass it as the indexHostUrl
  const looksLikeIndexHost = explicitController && /\.svc\.|\.pinecone\.io/.test(explicitController) && !/controller\./i.test(explicitController);

  // If we have an explicit controller that is actually the controller host (controller.<region>.pinecone.io), use it as controllerHostUrl.
  let controllerHostUrl = undefined;
  if (explicitController && /controller\./i.test(explicitController)) {
    controllerHostUrl = explicitController;
  } else if (!explicitController && PINECONE_ENV && PINECONE_ENV.match(/^[a-z0-9-]+$/i)) {
    controllerHostUrl = `https://controller.${PINECONE_ENV}.pinecone.io`;
  }

  // Create client. If we have a controllerHostUrl, pass it; otherwise create with apiKey only and rely on index host override.
  const pineconeClient = controllerHostUrl ? new pineconePkg.Pinecone({ apiKey: PINECONE_API_KEY, controllerHostUrl }) : new pineconePkg.Pinecone({ apiKey: PINECONE_API_KEY });

  // If explicitController looks like an index host, pass it as indexHostUrl to the index() call. Otherwise let the SDK resolve the index host via controller.
  const index = looksLikeIndexHost ? pineconeClient.index(PINECONE_INDEX, explicitController) : pineconeClient.index(PINECONE_INDEX);
  return { pineconeClient, index };
}

async function run() {
  try {
    const { pineconeClient, index } = await initPinecone();
    console.log('Pinecone client config:', (pineconeClient && typeof pineconeClient.getConfig === 'function') ? pineconeClient.getConfig() : 'no-config');
    // list indexes available in the project
    try {
      const idxList = await pineconeClient.listIndexes();
      console.log('Existing indexes:', JSON.stringify(idxList, null, 2));
    } catch (e) {
      console.error('Failed to list indexes:', e && e.message);
    }
    // try to describe the target index to get its host
    try {
      const desc = await pineconeClient.describeIndex(process.env.PINECONE_INDEX || process.env.pinecone_index);
      console.log('Index description:', JSON.stringify(desc, null, 2));
    } catch (e) {
      console.error('describeIndex failed:', e && e.message);
    }
    // determine the vector dimension from index description if available
    let dim = parseInt(process.env.TEST_HASH_DIM) || 128;
    try {
      const desc = await pineconeClient.describeIndex(process.env.PINECONE_INDEX || process.env.pinecone_index);
      if (desc && desc.dimension) dim = desc.dimension;
    } catch (e) {
      // ignore - we'll use env/default
    }
    const id = 'smoke_test_1';
    const text = 'pinecone-smoke-' + Date.now();
    const vec = hashEmbedding(text, dim);

    console.log('Upserting test vector id=', id, 'dim=', dim);
    const vectorsPayload = [{ id, values: vec, metadata: { test: true, text } }];
    try {
      // correct current SDK usage: index.upsert(recordsArray)
      await index.upsert(vectorsPayload);
      console.log('Upsert succeeded');
    } catch (e) {
      console.error('Upsert failed:', e && e.message);
      if (e && e.stack) console.error(e.stack);
      process.exit(1);
    }

    // Fetch the inserted record by id to confirm persistence
    try {
      const fetched = await index.fetch({ ids: [id] });
      console.log('Fetch result for id=', id, JSON.stringify(fetched, null, 2));
    } catch (e) {
      console.error('Fetch failed (SDK):', e && e.message);
      if (e && e.stack) console.error(e.stack);

      // If this was a JSON parse error, fallback to a raw HTTP fetch to inspect response bytes
      const isJsonParse = e && e.message && e.message.includes('Unexpected end of JSON input');
      if (isJsonParse) {
        try {
          // Try to call the index REST API directly to inspect raw response
          const PINECONE_API_KEY = process.env.PINECONE_API_KEY || process.env.pinecone_api_key;
          let host = null;
          try {
            const desc = await pineconeClient.describeIndex(process.env.PINECONE_INDEX || process.env.pinecone_index);
            host = desc && (desc.host || desc.hostname);
          } catch (inner) {
            console.warn('Could not describe index to get host for raw fetch:', inner && inner.message);
          }
          // allow explicit env override of index host
          host = host || process.env.PINECONE_INDEX_HOST || process.env.PINECONE_API_HOST || process.env.PINECONE_CONTROLLER_HOST;
          if (!host) {
            console.error('No index host available for raw fetch. Set PINECONE_INDEX_HOST or ensure describeIndex works.');
          } else {
            const url = host.startsWith('http') ? `${host}/vectors/fetch` : `https://${host}/vectors/fetch`;
            console.log('Raw fetch URL:', url);
            const body = JSON.stringify({ ids: [id] });
            // Use global fetch (Node 18+) or fallback to node-fetch if not available
            let fetchFn = global.fetch;
            if (!fetchFn) {
              try {
                fetchFn = require('node-fetch');
              } catch (ff) {
                console.error('No fetch available to perform raw HTTP call:', ff && ff.message);
                throw e;
              }
            }
            const resp = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Api-Key': PINECONE_API_KEY }, body });
            const raw = await resp.text();
            console.log('Raw HTTP response status:', resp.status);
            console.log('Raw HTTP response body (text):', raw);
            try {
              const parsed = JSON.parse(raw);
              console.log('Parsed raw response:', JSON.stringify(parsed, null, 2));
            } catch (pe) {
              console.warn('Failed to parse raw response as JSON:', pe && pe.message);
            }
          }
        } catch (rawErr) {
          console.error('Raw fetch attempt failed:', rawErr && rawErr.message);
          if (rawErr && rawErr.stack) console.error(rawErr.stack);
        }
      }
    }

    console.log('Querying back...');
    // Try different query signatures
    let qres;
    try {
      qres = await index.query({ topK: 3, vector: vec, includeMetadata: true });
    } catch (e) {
      console.error('Query failed:', e && e.message);
      if (e && e.stack) console.error(e.stack);
      process.exit(1);
    }
    if (!qres) {
      console.error('Query failed for all known SDK patterns.');
      process.exit(1);
    }
    const matches = (qres && (qres.matches || (qres.results && qres.results[0] && qres.results[0].matches))) || qres;
    console.log('Matches:', JSON.stringify(matches, null, 2));
  } catch (err) {
    console.error('Error:', err && err.message);
    process.exit(1);
  }
}

if (require.main === module) run();
