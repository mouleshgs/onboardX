// load .env first
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const crypto = require('crypto');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Create a sample contract at startup
const SAMPLE_PDF_PATH = path.join(__dirname, 'public', 'sample-contract.pdf');
if (!fs.existsSync(SAMPLE_PDF_PATH)) {
  // create a tiny PDF using pdf-lib
  (async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText('Sample Contract\n\nPlease review and sign below.', { x: 50, y: 750, size: 14, font: helvetica, color: rgb(0,0,0) });
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(SAMPLE_PDF_PATH, pdfBytes);
  })();
}

// Register sample contract
const SAMPLE_ID = 'contract-' + nanoid(6);
contracts[SAMPLE_ID] = { id: SAMPLE_ID, file: 'sample-contract.pdf', status: 'unsigned', createdAt: new Date().toISOString() };

app.get('/api/contracts', (req, res) => {
  res.json(Object.values(contracts));
});

app.get('/api/contract/:id', (req, res) => {
  const c = contracts[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});

app.get('/contract/:id/pdf', (req, res) => {
  const c = contracts[req.params.id];
  if (!c) return res.status(404).send('Not found');
  const p = path.join(__dirname, 'public', c.file);
  res.sendFile(p);
});

// accept signature: JSON { contractId, name, signatureDataUrl }
app.post('/api/sign', async (req, res) => {
  try {
    const { contractId, name, signatureDataUrl } = req.body;
    if (!contractId || !name || !signatureDataUrl) return res.status(400).json({ error: 'Missing fields' });
    const c = contracts[contractId];
    if (!c) return res.status(404).json({ error: 'Contract not found' });

    // load PDF
    const pdfPath = path.join(__dirname, 'public', c.file);
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // embed signature image
    const data = signatureDataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');
    const sigBytes = Buffer.from(data, 'base64');
    const img = await pdfDoc.embedPng(sigBytes).catch(() => pdfDoc.embedJpg(sigBytes));
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    // draw signature at bottom
    lastPage.drawImage(img, { x: 50, y: 80, width: 200, height: 80 });
    lastPage.drawText(name, { x: 50, y: 60, size: 10 });

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

    // Force direct upload to Dropbox (no local storage). If Dropbox is not configured, return error.
    const storageProvider = (process.env.STORAGE_PROVIDER || '').toLowerCase();
    if (storageProvider !== 'dropbox' || !process.env.DROPBOX_TOKEN) {
      console.error('Dropbox not configured. To avoid local storage set STORAGE_PROVIDER=dropbox and DROPBOX_TOKEN.');
      return res.status(500).json({ error: 'Storage provider not configured. Set STORAGE_PROVIDER=dropbox and provide DROPBOX_TOKEN to enable cloud storage (no local storage).' });
    }

    try {
      const { Dropbox } = require('dropbox');
      const fetch = require('node-fetch');
      const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN, fetch });
      const dropPath = '/' + outName;
      // upload file directly to Dropbox
      await dbx.filesUpload({ path: dropPath, contents: signedPdfBytes, mode: { '.tag': 'overwrite' } });
      // try to create or get a shared link
      let link;
      try {
        const resLink = await dbx.sharingCreateSharedLinkWithSettings({ path: dropPath });
        link = resLink.result.url.replace('?dl=0', '?dl=1');
      } catch (e) {
        const list = await dbx.sharingListSharedLinks({ path: dropPath, direct_only: true });
        if (list.result && list.result.links && list.result.links.length) {
          link = list.result.links[0].url.replace('?dl=0', '?dl=1');
        }
      }
      if (link) metadata.storageUrl = link;

      // update registry in-memory (no files written locally)
      c.status = 'signed';
      c.signedAt = metadata.signedAt;
      c.signedFile = outName;
      c.storageUrl = metadata.storageUrl || null;

      // return metadata to client
      return res.json({ ok: true, metadata });
    } catch (e) {
      console.error('Dropbox upload failed:', e.message || e);
      return res.status(500).json({ error: 'Dropbox upload failed', detail: (e && e.message) || String(e) });
    }

    // update registry
    c.status = 'signed';
    c.signedAt = metadata.signedAt;
    c.signedFile = outName;

    // In real app: notify vendor dashboard via websocket or push. Here we just return metadata.
    res.json({ ok: true, metadata });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error', detail: err.message });
  }
});

app.get('/signed/:name', (req, res) => {
  const p = path.join(DATA_DIR, req.params.name);
  if (!fs.existsSync(p)) return res.status(404).send('Not found');
  res.sendFile(p);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Sample contract id: ${SAMPLE_ID}`);
  });
}

module.exports = app;
