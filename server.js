// load .env first (explicitly from this script's directory so starting node from repo root still works)
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const crypto = require('crypto');
// nanoid is an ESM package in newer versions; provide a tiny local fallback generator to avoid ESM require issues
function nanoid(len = 8) {
  // produce URL-safe base62-like id
  const alph = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += alph[bytes[i] % alph.length];
  return out;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Lightweight CORS middleware (no external dependency)
// Configure allowed origins via CORS_ORIGIN env (comma-separated). In dev, we echo the request origin so browser accepts it.
app.use((req, res, next) => {
  try {
    const origin = req.headers.origin;
    const allowed = process.env.CORS_ORIGIN || '*';
    if (origin) {
      if (allowed === '*' || (allowed.split(',').map(s => s.trim()).indexOf(origin) !== -1)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    } else {
      // no origin present (server-to-server), allow all
      res.setHeader('Access-Control-Allow-Origin', allowed === '*' ? '*' : allowed);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
  } catch (e) {
    // ignore errors in CORS handling
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '10mb' }));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const KEYS_DIR = path.join(__dirname, 'keys');
if (!fs.existsSync(KEYS_DIR)) fs.mkdirSync(KEYS_DIR);

const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'ecdsa_private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'ecdsa_public.pem');

function ensureKeys() {
  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) return;
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256'
  });
  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey.export({ type: 'sec1', format: 'pem' }));
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey.export({ type: 'spki', format: 'pem' }));
  console.log('Generated ECDSA key pair');
}

ensureKeys();

// Simple in-memory contract registry for demo
const contracts = {};

// Generate mock access credentials for a contract and optionally notify via Slack/webhook
async function generateAccessForContract(contractId, req) {
  const c = contracts[contractId];
  if (!c) return null;
  if (c.access && c.access.unlocked) return c.access; // already generated

  const now = Date.now();
  const expiresAt = new Date(now + (24 * 60 * 60 * 1000)).toISOString(); // 24h
  const username = `user-${nanoid(6)}`;
  const password = crypto.randomBytes(8).toString('base64').replace(/\/+|=|\+/g,'').slice(0,12);
  const token = nanoid(24);

  // build tool links (prefer TOOL_BASE_URL env, otherwise derive from request)
  const base = process.env.TOOL_BASE_URL || (req ? `${req.protocol}://${req.get('host')}` : null) || '';
  const tools = [
    { name: 'Work Dashboard', url: `${base}/dashboard?token=${token}` }
  ];

  // Add the public Notion onboarding course link so distributors can open the course from Access Tools
  try {
    const notionLink = 'https://www.notion.so/AI-Onboarding-Course-27aaf52b342580278af7e58011e55dea?showMoveTo=true&saveParent=true';
    // put the onboarding course near the top of the tools list
    tools.unshift({ name: 'Onboarding Course', url: notionLink });
  } catch (e) {
    // non-fatal if URL construction somehow fails
  }

  const access = {
    unlocked: true,
    generatedAt: new Date(now).toISOString(),
    expiresAt,
    credentials: { username, password, token },
    tools,
    slackNotified: false,
    webhookNotified: false,
    events: c.events || { slackVisited: false, notionCompleted: false }
  };

  // compute progress: signature verified = 30%, slackVisited = +20%, notionCompleted = +50% (caps at 100)
  try {
    let progress = 0;
    if (c.status === 'signed') progress += 30;
    if (c.events && c.events.slackVisited) progress += 20;
    if (c.events && c.events.notionCompleted) progress += 50;
    if (progress > 100) progress = 100;
    access.progress = progress;
  } catch (e) {
    access.progress = 0;
  }

  // Initialize simple event tracker if not present
  if (!c.events) c.events = { slackVisited: false, notionCompleted: false };

  // Slack invite link support:
  // 1) If operator provides SLACK_JOIN_LINK in .env, include it as the Slack workspace invite link.
  // 2) Otherwise, if SLACK_ADMIN_TOKEN + SLACK_TEAM_ID are provided, attempt to call admin.users.invite
  //    to invite the distributor by email. Note: this API requires an admin token with proper scopes.
  try {
    // Priority: explicit join link
    if (process.env.SLACK_JOIN_LINK) {
      tools.unshift({ name: 'Slack Workspace', url: process.env.SLACK_JOIN_LINK });
      access.slackInviteProvided = true;
    } else if (process.env.SLACK_ADMIN_TOKEN && process.env.SLACK_TEAM_ID && c.assignedToEmail) {
      const fetch = require('node-fetch');
      const params = new URLSearchParams();
      params.append('team_id', process.env.SLACK_TEAM_ID);
      params.append('email', c.assignedToEmail);
      // resend if previously invited
      params.append('resend', 'true');

      const resp = await fetch('https://slack.com/api/admin.users.invite', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_ADMIN_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      const jr = await resp.json().catch(() => ({}));
      if (jr && jr.ok) {
        // admin.users.invite may not always return an invite URL; include a friendly message instead
        if (jr.url) {
          tools.unshift({ name: 'Slack Workspace', url: jr.url });
        } else {
          // fallback: point to the configured join link if available or the workspace root
          const fallback = process.env.SLACK_JOIN_FALLBACK || `https://slack.com/signin`;
          tools.unshift({ name: 'Slack Workspace', url: fallback });
        }
        access.slackInviteProvided = true;
        access.slackAdminInvite = jr;
      } else {
        access.slackInviteError = jr && jr.error ? jr.error : 'invite_failed';
      }
    }
  } catch (e) {
    access.slackInviteError = e && e.message;
  }

  c.access = access;

  // persist to Firestore if available
  if (firestore) {
    try { await firestore.collection('contracts').doc(contractId).update({ access: c.access }); } catch (e) { console.warn('Failed to persist access to Firestore', e && e.message); }
  }

  // Notify via incoming webhook if configured
  try {
    if (process.env.SLACK_WEBHOOK_URL) {
      const fetch = require('node-fetch');
      const text = `:tada: Access unlocked for contract *${contractId}* assigned to *${c.assignedToEmail || 'unknown'}*\n*Portal:* ${tools[0].url}`;
      await fetch(process.env.SLACK_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ text }) });
      c.access.webhookNotified = true;
    } else if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_NOTIFY_CHANNEL) {
      // use Slack Web API to post message (no additional dependency)
      const fetch = require('node-fetch');
      const body = { channel: process.env.SLACK_NOTIFY_CHANNEL, text: `Access unlocked for contract ${contractId} — ${tools[0].url}` };
      await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      c.access.slackNotified = true;
    }
  } catch (e) {
    console.warn('Failed to notify Slack/webhook for access', e && e.message);
  }

  return c.access;
}

// Optional Firestore integration (server-side). To enable, set one of:
// - FIREBASE_SERVICE_ACCOUNT_JSON (the JSON service account as a string)
// - FIREBASE_SERVICE_ACCOUNT_PATH (path to the service account JSON file)
// - or set GOOGLE_APPLICATION_CREDENTIALS to a credentials path and have default application credentials available
let firestore = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const admin = require('firebase-admin');
    let cred;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      cred = admin.credential.cert(sa);
      admin.initializeApp({ credential: cred });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      const sa = require(saPath);
      cred = admin.credential.cert(sa);
      admin.initializeApp({ credential: cred });
    } else {
      // Use application default credentials
      admin.initializeApp();
    }
    firestore = admin.firestore();
    console.log('Firestore initialized');
  }
} catch (e) {
  console.warn('Firestore not initialized:', e && e.message);
  firestore = null;
}

// No sample contract at startup. Contracts are created by vendor uploads.

app.get('/api/contracts', (req, res) => {
  res.json(Object.values(contracts));
});

// Vendor uploads a contract and assigns to a distributor email. Upload to Dropbox vendor_data/<vendorId>/
const upload = multer();
app.post('/api/vendor/upload', upload.single('file'), async (req, res) => {
  try {
    const vendorId = req.body.vendorId || req.body.vendorEmail || 'vendor';
    const distributorEmail = req.body.distributorEmail;
    if (!distributorEmail) return res.status(400).json({ error: 'distributorEmail required' });
    if (!req.file) return res.status(400).json({ error: 'file required' });

    const id = 'contract-' + nanoid(6);
  const originalName = req.file.originalname || `${id}.pdf`;
  // store the file in Dropbox using the contract id as the filename at the Dropbox root
  // (so all uploaded contracts live in a single, unique namespace)
  const dropFilename = `${id}.pdf`;
  const dropPath = `/${dropFilename}`;

    if (!process.env.DROPBOX_TOKEN) {
      // fallback: save locally under public/uploads
      const uploadsDir = path.join(__dirname, 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const outPath = path.join(uploadsDir, `${id}.pdf`);
      fs.writeFileSync(outPath, req.file.buffer);
      contracts[id] = { id, file: `uploads/${id}.pdf`, status: 'pending', createdAt: new Date().toISOString(), vendorId, vendorEmail: req.body.vendorEmail, assignedToEmail: distributorEmail, originalName };
      // persist to Firestore if available
      if (firestore) {
        try { await firestore.collection('contracts').doc(id).set(contracts[id]); } catch (e) { console.warn('Failed to save contract to Firestore', e && e.message); }
      }
      return res.json({ ok: true, id, file: contracts[id].file });
    }

    // upload to Dropbox (if configured). If Dropbox returns an auth error, fall back to local storage.
    try {
      const { Dropbox } = require('dropbox');
      const fetch = require('node-fetch');
      const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN, fetch });
      await dbx.filesUpload({ path: dropPath, contents: req.file.buffer, mode: { '.tag': 'overwrite' } });

      // create shared link
      let link;
      try {
        const resLink = await dbx.sharingCreateSharedLinkWithSettings({ path: dropPath });
        link = resLink.result.url.replace('?dl=0', '?dl=1');
      } catch (e) {
        try {
          const list = await dbx.sharingListSharedLinks({ path: dropPath, direct_only: true });
          if (list.result && list.result.links && list.result.links.length) link = list.result.links[0].url.replace('?dl=0', '?dl=1');
        } catch (e2) {
          // ignore
        }
      }

      contracts[id] = { id, file: dropPath, status: 'pending', createdAt: new Date().toISOString(), vendorId, vendorEmail: req.body.vendorEmail, assignedToEmail: distributorEmail, originalName, storageUrl: link };
      if (firestore) {
        try { await firestore.collection('contracts').doc(id).set(contracts[id]); } catch (e) { console.warn('Failed to save contract to Firestore', e && e.message); }
      }
      return res.json({ ok: true, id, storageUrl: link });
    } catch (e) {
      // If Dropbox failed (401 unauthorized or other), fall back to local storage and continue
      console.warn('Dropbox upload failed, falling back to local save:', e && (e.error || e.message || e.toString()));
      try {
        const uploadsDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const outPath = path.join(uploadsDir, `${id}.pdf`);
        fs.writeFileSync(outPath, req.file.buffer);
        contracts[id] = { id, file: `uploads/${id}.pdf`, status: 'pending', createdAt: new Date().toISOString(), vendorId, vendorEmail: req.body.vendorEmail, assignedToEmail: distributorEmail, originalName };
        if (firestore) {
          try { await firestore.collection('contracts').doc(id).set(contracts[id]); } catch (e2) { console.warn('Failed to save contract to Firestore', e2 && e2.message); }
        }
        return res.json({ ok: true, id, file: contracts[id].file, note: 'Dropbox upload failed; saved locally' });
      } catch (e2) {
        console.error('Fallback local save also failed', e2 && e2.message);
        return res.status(500).json({ error: 'upload failed', detail: (e2 && e2.message) || String(e2) });
      }
    }
  } catch (e) {
    console.error('vendor upload failed', e && e.message);
    return res.status(500).json({ error: 'upload failed', detail: (e && e.message) || String(e) });
  }
});

app.get('/api/contract/:id', (req, res) => {
  const c = contracts[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});

// If Firestore is enabled, prefer returning from Firestore
app.get('/api/vendor/contracts', async (req, res) => {
  const { vendorEmail, vendorId } = req.query;
  if (firestore) {
    try {
      let q = firestore.collection('contracts');
      if (vendorEmail) q = q.where('vendorEmail', '==', vendorEmail);
      if (vendorId) q = q.where('vendorId', '==', vendorId);
      const snap = await q.get();
      const list = [];
      snap.forEach(d => list.push(d.data()));
      return res.json(list);
    } catch (e) {
      console.warn('Error querying Firestore for vendor contracts', e && e.message);
      // fall through to in-memory
    }
  }
  const list = Object.values(contracts).filter(c => {
    if (vendorEmail && c.vendorEmail && c.vendorEmail.toLowerCase() === vendorEmail.toLowerCase()) return true;
    if (vendorId && c.vendorId && c.vendorId === vendorId) return true;
    return false;
  });
  res.json(list);
});

// Return contracts belonging to a vendor (by vendorEmail or vendorId)
app.get('/api/vendor/contracts', (req, res) => {
  const { vendorEmail, vendorId } = req.query;
  const list = Object.values(contracts).filter(c => {
    if (vendorEmail && c.vendorEmail && c.vendorEmail.toLowerCase() === vendorEmail.toLowerCase()) return true;
    if (vendorId && c.vendorId && c.vendorId === vendorId) return true;
    return false;
  });
  res.json(list);
});

// RAG chat endpoint for the widget
try {
  const rag = require('./server/rag');
  app.post('/api/chat', async (req, res) => {
    try {
      const message = (req.body && req.body.message) || '';
      const reply = await rag.getReply(message, req);
      return res.json({ reply });
    } catch (e) {
      console.error('Chat handler error', e && e.message);
      return res.status(500).json({ reply: 'Internal error' });
    }
  });
  app.get('/api/chat/welcome', (req, res) => {
    try {
      const welcome = rag.getWelcome();
      return res.json({ welcome });
    } catch (e) {
      return res.json({ welcome: 'Hello — ask me anything about onboarding.' });
    }
  });
} catch (e) {
  console.warn('RAG module not available, /api/chat disabled', e && e.message);
}

app.get('/contract/:id/pdf', async (req, res) => {
  const c = contracts[req.params.id];
  if (!c) return res.status(404).send('Not found');

  // If we have a storageUrl (Dropbox shared link or other), fetch it server-side and stream bytes
  if (c.storageUrl) {
    try {
      // If this is a Dropbox shared link and we have a token, use the Dropbox API to fetch the file
      if (process.env.DROPBOX_TOKEN && c.storageUrl.indexOf('dropbox.com') !== -1) {
        try {
          const { Dropbox } = require('dropbox');
          const fetch = require('node-fetch');
          const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN, fetch });

          // Dropbox SDK: download the file via the shared link (works for /scl/ and other shared link types)
          const sharedRes = await dbx.sharingGetSharedLinkFile({ url: c.storageUrl });
          // sharedRes.result.fileBinary may contain the bytes
          const fileBinary = (sharedRes && sharedRes.result && (sharedRes.result.fileBinary || sharedRes.fileBinary)) || null;
          if (fileBinary) {
            res.setHeader('Content-Type', 'application/pdf');
            return res.send(Buffer.from(fileBinary, 'binary'));
          }

          // If SDK didn't provide fileBinary, try to get a temporary link via filesGetTemporaryLink by resolving shared link metadata
          // Attempt to derive a path from shared link metadata
          try {
            const meta = await dbx.sharingGetSharedLinkMetadata({ url: c.storageUrl });
            if (meta && meta.result && meta.result.path_lower) {
              const path = meta.result.path_lower;
              const tmp = await dbx.filesGetTemporaryLink({ path });
              const url = tmp && tmp.result && tmp.result.link;
              if (url) {
                const resp = await fetch(url);
                if (!resp.ok) return res.status(502).send('Failed to fetch Dropbox temp link');
                res.status(resp.status);
                try { resp.headers.forEach((val, key) => { const k = key.toLowerCase(); if (k === 'content-encoding') return; if (k === 'content-type' || k === 'content-length' || k === 'content-disposition' || k === 'accept-ranges') { res.setHeader(key, val); } }); } catch (e) {}
                const body = resp.body;
                if (body && typeof body.pipe === 'function') return body.pipe(res);
                const arrayBuffer = await resp.arrayBuffer();
                return res.send(Buffer.from(arrayBuffer));
              }
            }
          } catch (e) {
            // ignore and fall back to generic fetch below
          }
        } catch (e) {
          console.error('Dropbox API shared-link fetch failed', e && e.message);
          // fall back to generic fetch
        }
      }

      // Generic fetch fallback for non-dropbox links or when token not available
      const fetch = require('node-fetch');
      // ensure dl=1 for Dropbox links to get raw content
      let url = c.storageUrl;
      if (url.indexOf('dropbox.com') !== -1 && url.indexOf('dl=1') === -1) {
        url = url.replace('?dl=0', '?dl=1');
      }
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error('Failed to fetch storageUrl', resp.status, resp.statusText);
        return res.status(502).send('Failed to fetch remote file');
      }
      // forward status and headers where appropriate, but avoid passing along content-encoding
      res.status(resp.status);
      try {
        resp.headers.forEach((val, key) => {
          const k = key.toLowerCase();
          if (k === 'content-encoding') return; // let express handle encoding
          // overwrite content-type to application/pdf if missing
          if (k === 'content-type' || k === 'content-length' || k === 'content-disposition' || k === 'accept-ranges') {
            res.setHeader(key, val);
          }
        });
      } catch (e) {
        // some fetch implementations expose headers differently; ignore on failure
      }
      // stream the remote response body directly to the client
      const body = resp.body;
      if (body && typeof body.pipe === 'function') {
        return body.pipe(res);
      }
      // fallback: buffer and send
      const arrayBuffer = await resp.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (e) {
      console.error('Proxy fetch failed', e);
      return res.status(500).send('Failed to proxy remote file');
    }
  }

  // If the stored file path looks like a Dropbox root path (e.g. '/contract-xxxx.pdf') and we have a token,
  // use the Dropbox API to download or get a temporary link so we avoid relying on a public shared link.
  if (process.env.DROPBOX_TOKEN && typeof c.file === 'string' && c.file.startsWith('/')) {
    try {
      const { Dropbox } = require('dropbox');
      const fetch = require('node-fetch');
      const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN, fetch });

      // Try filesDownload (may return fileBinary in the response). If that doesn't provide raw bytes,
      // fall back to filesGetTemporaryLink and fetch the temporary URL.
      try {
        const dl = await dbx.filesDownload({ path: c.file });
        const fileBinary = (dl && dl.result && dl.result.fileBinary) || dl.fileBinary || null;
        if (fileBinary) {
          res.setHeader('Content-Type', 'application/pdf');
          return res.send(Buffer.from(fileBinary, 'binary'));
        }
      } catch (err) {
        // ignore and try temporary link
      }

      // Use temporary link as fallback
      const tmp = await dbx.filesGetTemporaryLink({ path: c.file });
      const url = tmp && tmp.result && tmp.result.link;
      if (!url) return res.status(502).send('Failed to get Dropbox temporary link');
      const resp = await fetch(url);
      if (!resp.ok) return res.status(502).send('Failed to fetch Dropbox temp link');
      res.status(resp.status);
      try {
        resp.headers.forEach((val, key) => {
          const k = key.toLowerCase();
          if (k === 'content-encoding') return;
          if (k === 'content-type' || k === 'content-length' || k === 'content-disposition' || k === 'accept-ranges') {
            res.setHeader(key, val);
          }
        });
      } catch (e) {}
      const body = resp.body;
      if (body && typeof body.pipe === 'function') return body.pipe(res);
      const arrayBuffer = await resp.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (e) {
      console.error('Dropbox API fetch failed', e && e.message);
      // fall through to the other handlers (http url or local file)
    }
  }

  // If the file field is an absolute http(s) URL, fetch it and proxy
  if (/^https?:\/\//i.test(c.file)) {
    try {
      const fetch = require('node-fetch');
      const resp = await fetch(c.file);
      if (!resp.ok) return res.status(502).send('Failed to fetch remote file');
      res.status(resp.status);
      try {
        resp.headers.forEach((val, key) => {
          const k = key.toLowerCase();
          if (k === 'content-encoding') return;
          if (k === 'content-type' || k === 'content-length' || k === 'content-disposition' || k === 'accept-ranges') {
            res.setHeader(key, val);
          }
        });
      } catch (e) {}
      const body = resp.body;
      if (body && typeof body.pipe === 'function') {
        return body.pipe(res);
      }
      const arrayBuffer = await resp.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (e) {
      console.error('Proxy fetch failed', e);
      return res.status(500).send('Failed to proxy remote file');
    }
  }

  // Otherwise serve local file from public/, but ensure it exists
  const safePath = path.normalize(c.file).replace(/^\/+/, ''); // remove leading slashes
  const p = path.join(__dirname, 'public', safePath);
  if (!fs.existsSync(p)) {
    console.error('Contract file not found:', p);
    return res.status(404).send('Contract file not found');
  }
  res.sendFile(p);
});

// accept signature: JSON { contractId, name, signatureDataUrl }
app.post('/api/sign', async (req, res) => {
  try {
    const { contractId, name, signatureDataUrl } = req.body;
    if (!contractId || !name || !signatureDataUrl) return res.status(400).json({ error: 'Missing fields' });
    const c = contracts[contractId];
    if (!c) return res.status(404).json({ error: 'Contract not found' });

    // load PDF: support storageUrl or remote URL, otherwise local file
    let pdfBytes;
    // If the contract has a storageUrl and it's a Dropbox shared link, use the Dropbox API to fetch the file
    if (c.storageUrl && c.storageUrl.indexOf('dropbox.com') !== -1 && process.env.DROPBOX_TOKEN) {
      try {
        const { Dropbox } = require('dropbox');
        const fetch = require('node-fetch');
        const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN, fetch });
        // Try to download via shared link API
        try {
          const sharedRes = await dbx.sharingGetSharedLinkFile({ url: c.storageUrl });
          const fileBinary = (sharedRes && sharedRes.result && (sharedRes.result.fileBinary || sharedRes.fileBinary)) || null;
          if (fileBinary) {
            pdfBytes = Buffer.from(fileBinary, 'binary');
          }
        } catch (e) {
          // ignore and fall through to tmp link
        }
        // If we still don't have bytes, try to resolve metadata -> temporary link
        if (!pdfBytes) {
          try {
            const meta = await dbx.sharingGetSharedLinkMetadata({ url: c.storageUrl });
            if (meta && meta.result && meta.result.path_lower) {
              const p = meta.result.path_lower;
              const tmp = await dbx.filesGetTemporaryLink({ path: p });
              const url = tmp && tmp.result && tmp.result.link;
              if (url) {
                const resp = await fetch(url);
                if (!resp.ok) return res.status(502).json({ error: 'Failed to fetch remote PDF for signing' });
                const arrayBuffer = await resp.arrayBuffer();
                pdfBytes = Buffer.from(arrayBuffer);
              }
            }
          } catch (e) {
            // fall through to generic fetch
          }
        }
      } catch (e) {
        console.error('Dropbox fetch for signing failed', e && e.message);
      }
    }

    // If c.file looks like a Dropbox root path and we have a token, fetch it via filesDownload or tmp link
    if (!pdfBytes && process.env.DROPBOX_TOKEN && typeof c.file === 'string' && c.file.startsWith('/')) {
      try {
        const { Dropbox } = require('dropbox');
        const fetch = require('node-fetch');
        const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN, fetch });
        try {
          const dl = await dbx.filesDownload({ path: c.file });
          const fileBinary = (dl && dl.result && dl.result.fileBinary) || dl.fileBinary || null;
          if (fileBinary) pdfBytes = Buffer.from(fileBinary, 'binary');
        } catch (e) {
          // try temporary link fallback
          try {
            const tmp = await dbx.filesGetTemporaryLink({ path: c.file });
            const url = tmp && tmp.result && tmp.result.link;
            if (url) {
              const resp = await (require('node-fetch'))(url);
              if (!resp.ok) return res.status(502).json({ error: 'Failed to fetch remote PDF for signing' });
              const arrayBuffer = await resp.arrayBuffer();
              pdfBytes = Buffer.from(arrayBuffer);
            }
          } catch (e2) {
            // ignore
          }
        }
      } catch (e) {
        console.error('Dropbox filesDownload for signing failed', e && e.message);
      }
    }

    // If still not set, fall back to generic URL fetch
    if (!pdfBytes && c.storageUrl && /^https?:\/\//i.test(c.storageUrl)) {
      const fetch = require('node-fetch');
      const url = c.storageUrl.indexOf('dropbox.com') !== -1 ? c.storageUrl.replace('?dl=0', '?dl=1') : c.storageUrl;
      const resp = await fetch(url);
      if (!resp.ok) return res.status(502).json({ error: 'Failed to fetch remote PDF for signing' });
      const arrayBuffer = await resp.arrayBuffer();
      pdfBytes = Buffer.from(arrayBuffer);
    }

    // generic remote file
    if (!pdfBytes && /^https?:\/\//i.test(c.file)) {
      const fetch = require('node-fetch');
      const resp = await fetch(c.file);
      if (!resp.ok) return res.status(502).json({ error: 'Failed to fetch remote PDF for signing' });
      const arrayBuffer = await resp.arrayBuffer();
      pdfBytes = Buffer.from(arrayBuffer);
    }

    // local file fallback
    if (!pdfBytes) {
      const pdfPath = path.join(__dirname, 'public', c.file);
      if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'Local PDF not found for signing' });
      pdfBytes = fs.readFileSync(pdfPath);
    }
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // embed signature image
    const data = signatureDataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');
    const sigBytes = Buffer.from(data, 'base64');
    const img = await pdfDoc.embedPng(sigBytes).catch(() => pdfDoc.embedJpg(sigBytes));
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    // draw signature image at bottom
    lastPage.drawImage(img, { x: 50, y: 80, width: 200, height: 80 });
    // add a small 'Signature' label and the printed name beneath it
    try {
      const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
      // label above the name, a bit below the image
      lastPage.drawText('Signature', { x: 50, y: 66, size: 10, font: helv });
      // printed name below the label
      lastPage.drawText(name, { x: 50, y: 52, size: 10, font: helv });
    } catch (e) {
      // fallback: draw name only if font embedding fails
      lastPage.drawText(name, { x: 50, y: 60, size: 10 });
    }

    const signedPdfBytes = await pdfDoc.save();

    // compute sha256
    const hash = crypto.createHash('sha256').update(signedPdfBytes).digest('hex');

    // sign hash with ECDSA private key
    const privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    const sign = crypto.createSign('SHA256');
    sign.update(Buffer.from(hash, 'hex'));
    sign.end();
    const signature = sign.sign(privateKeyPem).toString('base64');

    // prepare metadata
    const outName = `${contractId}-signed-${Date.now()}.pdf`;
    const metadata = {
      contractId,
      name,
      signedAt: new Date().toISOString(),
      file: outName,
      sha256: hash,
      ecdsaSignature: signature
    };

    // Upload signed PDF to Dropbox if configured, otherwise save locally under DATA_DIR
    try {
      if (process.env.DROPBOX_TOKEN) {
        const { Dropbox } = require('dropbox');
        const fetch = require('node-fetch');
        const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN, fetch });
        const dropPath = '/' + outName;
        await dbx.filesUpload({ path: dropPath, contents: signedPdfBytes, mode: { '.tag': 'overwrite' } });
        // try to create or get a shared link
        try {
          const resLink = await dbx.sharingCreateSharedLinkWithSettings({ path: dropPath });
          metadata.storageUrl = resLink.result.url.replace('?dl=0', '?dl=1');
        } catch (e) {
          const list = await dbx.sharingListSharedLinks({ path: dropPath, direct_only: true });
          if (list.result && list.result.links && list.result.links.length) metadata.storageUrl = list.result.links[0].url.replace('?dl=0', '?dl=1');
        }
      } else {
        // save locally to DATA_DIR and expose via /signed/:name
        const outPath = path.join(DATA_DIR, outName);
        fs.writeFileSync(outPath, signedPdfBytes);
        metadata.storageUrl = `${req.protocol}://${req.get('host')}/signed/${outName}`;
        console.log('DROPBOX_TOKEN not set; saved signed PDF locally at', outPath);
      }

      // update registry in-memory
      c.status = 'signed';
      c.signedAt = metadata.signedAt;
      c.signedFile = outName;
      c.storageUrl = metadata.storageUrl || null;

      // persist status to Firestore if available
      if (firestore) {
        try {
          await firestore.collection('contracts').doc(contractId).update({ status: 'signed', signedAt: c.signedAt, signedFile: c.signedFile, storageUrl: c.storageUrl });
        } catch (e) {
          console.warn('Failed to update Firestore contract status', e && e.message);
        }
      }

      // In real app: notify vendor dashboard via websocket or push. Here we just return metadata.
      // Generate access tools (mock) for distributor so they can start immediately
      try {
        const access = await generateAccessForContract(contractId, req).catch(() => null);
        if (access) metadata.access = access;
      } catch (e) {}

      return res.json({ ok: true, metadata });
    } catch (e) {
      console.error('Signed file storage failed:', e && e.message);
      return res.status(500).json({ error: 'Signed file storage failed', detail: (e && e.message) || String(e) });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error', detail: err.message });
  }
});

// Return generated access for a contract (if unlocked)
app.get('/api/contract/:id/access', async (req, res) => {
  const c = contracts[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.access && c.access.unlocked) return res.json({ ok: true, access: c.access });
  // If not generated yet, generate now (only allowed if contract is signed)
  if (c.status !== 'signed') return res.status(403).json({ error: 'Contract not signed yet' });
  try {
    const access = await generateAccessForContract(req.params.id, req);
    return res.json({ ok: true, access });
  } catch (e) {
    console.error('Failed to generate access', e && e.message);
    return res.status(500).json({ error: 'Failed to generate access' });
  }
});

// Record a simple event for a contract (e.g. slack_visited, notion_completed)
app.post('/api/contract/:id/event', express.json(), async (req, res) => {
  const id = req.params.id;
  const c = contracts[id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  const { event } = req.body || {};
  if (!event) return res.status(400).json({ error: 'event required' });
  if (!c.events) c.events = { slackVisited: false, notionCompleted: false };
  if (event === 'slack_visited') c.events.slackVisited = true;
  if (event === 'notion_completed') c.events.notionCompleted = true;
  // recompute access progress
  recomputeProgress(c);
  // persist to Firestore if available
  if (firestore) {
    try { await firestore.collection('contracts').doc(id).update({ events: c.events }); } catch (e) { console.warn('Failed to persist events to Firestore', e && e.message); }
  }
  return res.json({ ok: true, events: c.events });
});

// Helper to recompute and persist access.progress based on current contract state
function recomputeProgress(c) {
  let progress = 0;
  // New weights per user request: signature = 30%, slack click = 10%, notion completion = 60%.
  if (c.status === 'signed') progress += 30;
  if (c.events && c.events.slackVisited) progress += 10;
  if (c.events && c.events.notionCompleted) progress += 60;
  if (progress > 100) progress = 100;
  if (!c.access) c.access = {};
  c.access.progress = progress;
  return progress;
}

// In-memory nudges store for demo (non-persistent)
const nudges = [];

// Vendor posts a nudge for a specific contract. Server selects default message when none provided.
app.post('/api/contract/:id/nudge', express.json(), async (req, res) => {
  const id = req.params.id;
  const c = contracts[id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  try {
    let message = (req.body && req.body.message) || '';
    // default message selection
    if (!message) {
      if (c.status !== 'signed') {
        message = 'Please start the Signing process';
      } else {
        // ensure we have access/progress computed
        let access = c.access && c.access.unlocked ? c.access : null;
        if (!access && c.status === 'signed') {
          try { access = await generateAccessForContract(id, req); } catch (e) { access = null; }
        }
        const prog = access && typeof access.progress === 'number' ? access.progress : 0;
        if (prog >= 100) message = 'Congrats for Completion of Onboarding; moving to Distribution phase';
        else message = 'Please complete the training soon';
      }
    }

    const n = {
      id: 'nudge-' + nanoid(6),
      contractId: id,
      from: (req.body && req.body.from) || c.vendorEmail || 'vendor',
      to: c.assignedToEmail || (req.body && req.body.to) || null,
      message,
      createdAt: new Date().toISOString(),
      read: false
    };
    nudges.push(n);

    // persist to Firestore if available (best-effort)
    if (firestore) {
      try { await firestore.collection('nudges').doc(n.id).set(n); } catch (e) { /* ignore */ }
    }

    return res.json({ ok: true, nudge: n });
  } catch (e) {
    console.error('Nudge creation failed', e && e.message);
    return res.status(500).json({ error: 'nudge failed', detail: (e && e.message) || String(e) });
  }
});

// List notifications for a specific recipient email
app.get('/api/notifications', (req, res) => {
  const email = (req.query && req.query.email) ? String(req.query.email).toLowerCase() : null;
  if (!email) return res.status(400).json({ error: 'email required' });
  const list = nudges.filter(n => n.to && String(n.to).toLowerCase() === email).slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unreadCount = list.filter(n => !n.read).length;
  return res.json({ ok: true, notifications: list, unreadCount });
});

// Mark given notification ids as read
app.post('/api/notifications/mark-read', express.json(), async (req, res) => {
  const ids = (req.body && Array.isArray(req.body.ids)) ? req.body.ids : null;
  if (!ids) return res.status(400).json({ error: 'ids required' });
  const marked = [];
  for (const id of ids) {
    const idx = nudges.findIndex(n => n.id === id);
    if (idx !== -1) {
      nudges[idx].read = true;
      marked.push(nudges[idx]);
      if (firestore) {
        try { await firestore.collection('nudges').doc(id).update({ read: true }); } catch (e) { /* ignore */ }
      }
    }
  }
  return res.json({ ok: true, marked });
});

// Verify Slack membership for the assigned email in a configured channel. Requires SLACK_BOT_TOKEN and SLACK_CHECK_CHANNEL_ID.
app.post('/api/contract/:id/check-slack', express.json(), async (req, res) => {
  const id = req.params.id; const c = contracts[id]; if (!c) return res.status(404).json({ error: 'Not found' });
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHECK_CHANNEL_ID) return res.status(400).json({ error: 'Slack verification not configured' });
  if (!c.assignedToEmail) return res.status(400).json({ error: 'No assigned email' });
  try {
    const fetch = require('node-fetch');
    // lookup user by email
    const resp = await fetch('https://slack.com/api/users.lookupByEmail', { method: 'GET', headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` , 'Content-Type':'application/x-www-form-urlencoded' }, qs: null + '' });
    // node-fetch doesn't support qs; we'll call with URL params
    const url = `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(c.assignedToEmail)}`;
    const r2 = await fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` } });
    const jr = await r2.json();
    if (!jr || !jr.ok || !jr.user) return res.json({ ok: true, slackJoined: false, reason: 'user_not_found' });
    const userId = jr.user.id;
    // fetch members of the configured channel (may be large; use cursor pagination)
    const channel = process.env.SLACK_CHECK_CHANNEL_ID;
    let cursor = undefined; let found = false;
    do {
      const q = cursor ? `?channel=${channel}&cursor=${cursor}` : `?channel=${channel}`;
      const membersRes = await fetch(`https://slack.com/api/conversations.members${q}`, { method: 'GET', headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` } });
      const jm = await membersRes.json();
      if (!jm || !jm.ok) break;
      if (jm.members && jm.members.indexOf(userId) !== -1) { found = true; break; }
      cursor = jm.response_metadata && jm.response_metadata.next_cursor ? jm.response_metadata.next_cursor : undefined;
    } while (cursor);
    if (found) {
      if (!c.events) c.events = {}; c.events.slackVisited = true; recomputeProgress(c);
      if (firestore) { try { await firestore.collection('contracts').doc(id).update({ events: c.events, access: c.access }); } catch (e) {} }
      return res.json({ ok: true, slackJoined: true, progress: c.access.progress });
    }
    return res.json({ ok: true, slackJoined: false, progress: c.access.progress });
  } catch (e) {
    console.error('Slack check failed', e && e.message);
    return res.status(500).json({ error: 'Slack check failed' });
  }
});

// Check Notion database for a completion flag for the assigned user. Requires NOTION_API_KEY and NOTION_DATABASE_ID.
app.get('/api/contract/:id/check-notion', async (req, res) => {
  const id = req.params.id; const c = contracts[id]; if (!c) return res.status(404).json({ error: 'Not found' });
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) return res.status(400).json({ error: 'Notion integration not configured' });
  if (!c.assignedToEmail) return res.status(400).json({ error: 'No assigned email' });
  try {
    const fetch = require('node-fetch');
    const url = `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`;
    const body = { filter: { property: 'Email', rich_text: { equals: c.assignedToEmail } } };
    const resp = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${process.env.NOTION_API_KEY}`, 'Notion-Version': '2022-06-28', 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    const jr = await resp.json();
    if (!jr || !jr.results) return res.status(500).json({ error: 'Notion query failed' });
    let completed = false;
    for (const p of jr.results) {
      // expect a checkbox property named 'Completed' or similar
      const props = p.properties || {};
      if (props.Completed && props.Completed.type === 'checkbox' && props.Completed.checkbox === true) { completed = true; break; }
      // alternative: look for a property named 'Done' or 'Finished'
      if (props.Done && props.Done.type === 'checkbox' && props.Done.checkbox === true) { completed = true; break; }
    }
    if (completed) { if (!c.events) c.events = {}; c.events.notionCompleted = true; recomputeProgress(c); if (firestore) { try { await firestore.collection('contracts').doc(id).update({ events: c.events, access: c.access }); } catch (e) {} } }
    return res.json({ ok: true, notionCompleted: completed, progress: c.access.progress });
  } catch (e) {
    console.error('Notion check failed', e && e.message);
    return res.status(500).json({ error: 'Notion check failed' });
  }
});

app.get('/signed/:name', (req, res) => {
  const p = path.join(DATA_DIR, req.params.name);
  if (!fs.existsSync(p)) return res.status(404).send('Not found');
  res.sendFile(p);
});

// Serve dashboard page at /dashboard (friendly URL without .html)
app.get('/dashboard', (req, res) => {
  const p = path.join(__dirname, 'public', 'dashboard.html');
  if (!fs.existsSync(p)) return res.status(404).send('Not found');
  res.sendFile(p);
});

// POST /api/sync-signed { name: "contract-...-signed-...pdf" }
app.post('/api/sync-signed', express.json(), async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'file not found' });
  if (!process.env.DROPBOX_TOKEN) return res.status(400).json({ error: 'DROPBOX_TOKEN not configured on server' });
  try {
    const { Dropbox } = require('dropbox');
    const fetch = require('node-fetch');
    const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN, fetch });
    const dropPath = '/' + name;
    const contents = fs.readFileSync(p);
    await dbx.filesUpload({ path: dropPath, contents, mode: { '.tag': 'overwrite' } });
    let link;
    try {
      const resLink = await dbx.sharingCreateSharedLinkWithSettings({ path: dropPath });
      link = resLink.result.url.replace('?dl=0', '?dl=1');
    } catch (e) {
      const list = await dbx.sharingListSharedLinks({ path: dropPath, direct_only: true });
      if (list.result && list.result.links && list.result.links.length) link = list.result.links[0].url.replace('?dl=0', '?dl=1');
    }
    return res.json({ ok: true, storageUrl: link });
  } catch (e) {
    console.error('sync-signed failed', e && e.message);
    return res.status(500).json({ error: 'sync failed', detail: (e && e.message) || String(e) });
  }
});

// Lightweight compatibility endpoint used by the demo login pages / React UI.
// Accepts { idToken, role } and returns OK. This is intentionally permissive
// for the demo app — in a production app you'd verify the token server-side.
app.post('/api/user/identify', express.json(), (req, res) => {
  try {
    const { idToken, role } = req.body || {};
    // For demo purposes, just log and return success. Keep minimal to avoid
    // changing auth behavior in existing flows.
    if (idToken) console.log('identify:', role || 'unknown role');
    return res.json({ ok: true, role: role || 'unknown' });
  } catch (e) {
    return res.status(400).json({ error: 'invalid' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (process.env.DROPBOX_TOKEN) {
      console.log('DROPBOX_TOKEN is set — Dropbox uploads enabled');
    } else {
      console.log('DROPBOX_TOKEN not set — signed PDFs will be saved locally');
    }
  });
}

module.exports = app;
