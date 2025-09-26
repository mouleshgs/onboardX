const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.log('Usage: node verify-signature.js <metadata.json path or filename in data/>');
    process.exit(1);
  }

  let metaPath = arg;
  if (!fs.existsSync(metaPath)) {
    // try data/ folder
    const tryPath = path.join(__dirname, 'data', arg);
    if (fs.existsSync(tryPath)) metaPath = tryPath;
  }

  if (!fs.existsSync(metaPath)) {
    console.error('Metadata file not found:', arg);
    process.exit(2);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (!meta.file || !meta.sha256 || !meta.ecdsaSignature) {
    console.error('Metadata missing required fields (file, sha256, ecdsaSignature)');
    process.exit(3);
  }

  const pdfPath = path.join(__dirname, 'data', meta.file);
  if (!fs.existsSync(pdfPath)) {
    console.error('Signed PDF not found at', pdfPath);
    process.exit(4);
  }

  const pdfBytes = fs.readFileSync(pdfPath);
  const hash = crypto.createHash('sha256').update(pdfBytes).digest('hex');
  console.log('Computed sha256:', hash);
  console.log('Metadata sha256 :', meta.sha256);
  if (hash !== meta.sha256) {
    console.error('Mismatch: PDF file hash does not match metadata.sha256');
    process.exit(5);
  }

  const pubKeyPath = path.join(__dirname, 'keys', 'ecdsa_public.pem');
  if (!fs.existsSync(pubKeyPath)) {
    console.error('Public key not found at', pubKeyPath);
    process.exit(6);
  }

  const pub = fs.readFileSync(pubKeyPath, 'utf8');
  const verify = crypto.createVerify('SHA256');
  verify.update(Buffer.from(meta.sha256, 'hex'));
  verify.end();
  const ok = verify.verify(pub, Buffer.from(meta.ecdsaSignature, 'base64'));
  console.log('ECDSA signature valid:', ok);
  process.exit(ok ? 0 : 7);
}

main();
