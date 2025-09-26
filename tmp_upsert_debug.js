require('dotenv').config();
(async () => {
  try {
    const pkg = require('@pinecone-database/pinecone');
    const PINECONE_API_KEY = process.env.PINECONE_API_KEY || process.env.pinecone_api_key;
    const PINECONE_ENV = process.env.PINECONE_ENV || process.env.pinecone_env || process.env.PINECONE_ENVIRONMENT || process.env.pinecone_environment;
    const PINECONE_INDEX = process.env.PINECONE_INDEX || process.env.pinecone_index;
    const controllerHostUrl = `https://controller.${PINECONE_ENV}.pinecone.io`;
    const client = new pkg.Pinecone({ apiKey: PINECONE_API_KEY, controllerHostUrl });
    const index = client.Index(PINECONE_INDEX);
    const vec = new Array(8).fill(0).map((_,i)=>Math.cos(i));
    console.log('Attempting upsert...');
  await index.upsert([{ id: 'debug-1', values: vec, metadata: { a:1 }}]);
    console.log('Upsert returned');
  } catch (e) {
    console.error('Upsert error:');
    console.error(e);
    if (e.response) console.error('response data:', e.response.data || e.response);
  }
})();
