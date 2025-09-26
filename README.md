# onboardX contract signing PoC

This is a minimal proof-of-concept that demonstrates:

- PDF viewing (iframe) and signature capture via a canvas.
- Server-side PDF merging using pdf-lib.
- SHA-256 digest of the final PDF and ECDSA signing of that hash.

How to run (Windows PowerShell):

```powershell
cd d:\projects\CIT_Hack\onboardX
npm install
npm start
# then open http://localhost:3000
```

Notes:
- This is a demo. Replace local storage with S3 and add authentication for production.
- To verify signature: use the public key in `keys/ecdsa_public.pem` and verify the signature over the hex-encoded sha256.
