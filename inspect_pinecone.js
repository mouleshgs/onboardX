require('dotenv').config();
const pkg = require('@pinecone-database/pinecone');
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || process.env.pinecone_api_key;
const PINECONE_ENV = process.env.PINECONE_ENV || process.env.pinecone_env || process.env.PINECONE_ENVIRONMENT || process.env.pinecone_environment;
const PINECONE_INDEX = process.env.PINECONE_INDEX || process.env.pinecone_index;
if (!PINECONE_API_KEY) {
  console.error('no api key in env');
  process.exit(1);
}
let controllerHostUrl;
if (PINECONE_ENV && PINECONE_ENV.match(/^[a-z0-9-]+$/i)) controllerHostUrl = `https://controller.${PINECONE_ENV}.pinecone.io`;
const client = new pkg.Pinecone({ apiKey: PINECONE_API_KEY, controllerHostUrl });
const idx = client.Index(PINECONE_INDEX);
console.log('Index prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(idx)));
console.log('Index keys sample:', Object.keys(idx));
console.dir(idx, { depth: 2 });
