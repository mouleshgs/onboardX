
# onboardX — Contract Onboarding & RAG PoC

A professional proof-of-concept demonstrating a contract onboarding workflow with PDF signature capture, server-side PDF processing and signing, and a small Retrieval-Augmented Generation (RAG) assistant for onboarding documentation. The codebase is intentionally modular so pieces can be promoted to production-grade services.

This README describes the system goals, architecture, deployment and operational guidance, developer quick start, important environment variables, and recommended hardening steps for production.

## Table of contents

- Project goals
- Architecture overview
- Key components
- Quick start (development)
- Ingesting documents (RAG)
- Running the chat / query tools
- Signature verification
- Environment variables
- Production considerations & security
- Troubleshooting
- Next steps and suggestions

## Project goals

- Demonstrate a full contract onboarding flow: vendor upload, distributor access provisioning, browser-based signature capture, server-side PDF merging, SHA-256 digest generation and ECDSA signing of final artifacts.
- Provide a simple RAG assistant that answers onboarding questions using local documents and an external vector store (Pinecone) + LLM (OpenAI) with fallbacks to local embeddings.
- Keep the architecture modular so components (storage, auth, vector store) can be replaced with production services.

## Architecture overview

- Frontend: React (Vite) UI under `frontend/` and a secondary UI under `project/`. Key UI capabilities include PDF viewing (iframe), signature capture (`SignaturePad`), and a small dashboard.
- Backend: Node.js + Express (`server.js`) exposing REST endpoints for upload, contract metadata, access generation, `/api/chat` (RAG), and static hosting (`public/`).
- Document storage: Local filesystem by default (`public/uploads`); optional Dropbox integration when `DROPBOX_TOKEN` is provided.
- Signatures & crypto: Server generates/uses an ECDSA keypair (`keys/ecdsa_private.pem` & `keys/ecdsa_public.pem`) to sign SHA-256 digests of merged PDFs.
- Retrieval stack: Pinecone (vector index) for vector search, OpenAI for embeddings & chat completion when available; fallback to Universal Sentence Encoder (`@tensorflow-models/universal-sentence-encoder`) or deterministic hash vectors.
- Persistence: In-memory contract registry (for demo) with optional Firestore persistence if `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH` is configured.

## Key components

- `server.js` — main Express server: upload handling, contract lifecycle, access generation, Slack/webhook integration, and RAG endpoints.
- `server/rag.js` — RAG retrieval logic: local keyword search, embedding generation, Pinecone query and optional OpenAI chat fusion.
- `ingest.js` — ingestion pipeline: extract text from `datasets/`, chunk, embed and upsert vectors to Pinecone.
- `query.js` — CLI helper to query the Pinecone index and optionally call OpenAI for an answer.
- `public/` — static frontend assets and sample pages.
- `frontend/`, `project/` — React frontends including components for PDF viewing and signature capture.

## Quick start (development)

Prerequisites

- Node.js (16+ recommended)
- npm
- Optional: `OPENAI_API_KEY`, `PINECONE_*` env vars for RAG features

Install and run locally (PowerShell example):

```powershell
cd your directory\onboardX
npm install
npm start
# Open http://localhost:3000 in your browser
```

Notes

- On first run the server will auto-generate an ECDSA keypair and place them in `keys/` if they do not exist.
- By default the contract registry lives in memory and will not survive server restarts. Configure Firestore to persist contract metadata.

## Ingesting documents for RAG

The ingestion pipeline builds vector data for the RAG assistant from files placed in `datasets/` (supports `.md`, `.txt`, `.pdf`). The pipeline extracts text, chunks it, creates embeddings and upserts vectors to Pinecone.

High-level:

1. Ensure `PINECONE_API_KEY`, `PINECONE_ENV` and `PINECONE_INDEX` are set.
2. Optionally set `OPENAI_API_KEY` for OpenAI embeddings; otherwise the pipeline will try USE or fallback to deterministic hash vectors.
3. Run:

```powershell
node ingest.js
```

Configuration flags (common):

- `CONVERT_PDFS` — convert PDF files to text before ingesting
- `INGEST_BATCH_SIZE` — embeddings batching size
- `MAX_PDF_BYTES` — skip large PDFs by default (5MB)

See comments at the top of `ingest.js` for additional options.

## Running the chat/query tools

- RAG chat endpoint (server): `POST /api/chat` — request body { message: string } returns { reply: string }.
- Welcome message: `GET /api/chat/welcome`.
- CLI query tool: `node query.js "Your question here"` — embeds, queries Pinecone, and if configured calls OpenAI to synthesize a response.

Behavior

- The RAG layer first runs a local keyword search for strong lexical matches (fast, deterministic). If no strong match is found it will embed the query and perform a Pinecone vector search. When `OPENAI_API_KEY` is set, the retrieved context is provided to OpenAI Chat for a polished answer.

## Upload and signature flow (developer view)

1. Vendor uploads a PDF via `POST /api/vendor/upload` (multipart form with `file` and `distributorEmail`).
2. Server saves file to Dropbox (if `DROPBOX_TOKEN` present) or to `public/uploads/` as a fallback.
3. Frontend opens the PDF and allows a distributor to sign using the signature canvas.
4. The signature image is sent to the server, merged into the PDF using `pdf-lib`, and the server computes a SHA-256 digest of the final PDF.
5. The digest is signed with ECDSA (P-256) and the signature is returned/stored alongside the contract entry.

Signature verification

- Use the `keys/ecdsa_public.pem` file to verify the ECDSA signature over the hex-encoded SHA-256 digest of the final PDF. This verification can be performed using OpenSSL or any crypto library that supports ECDSA P-256.

Example (OpenSSL outline):

```text
# compute digest: sha256sum final.pdf
# verify signature using the public key (tooling differs per environment)
```

## Important environment variables

Core:

- `PORT` — server listen port (default 3000)
- `CORS_ORIGIN` — allowed origins (comma separated) for the lightweight CORS handler

RAG / embeddings / vector store:

- `OPENAI_API_KEY` — OpenAI API key for embeddings & chat (recommended for best results)
- `PINECONE_API_KEY` — Pinecone API key
- `PINECONE_ENV` — Pinecone environment / region
- `PINECONE_INDEX` — Pinecone index name
- `PINECONE_CONTROLLER_HOST` or `PINECONE_API_HOST` — optional explicit controller/host

Storage & persistence:

- `DROPBOX_TOKEN` — upload PDFs to Dropbox instead of local disk
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH` — enable Firestore persistence

Slack / notifications:

- `SLACK_JOIN_LINK` — explicit Slack invite link to include in access tools
- `SLACK_ADMIN_TOKEN`, `SLACK_TEAM_ID` — use Slack Admin API to invite users (requires admin scope)
- `SLACK_BOT_TOKEN`, `SLACK_NOTIFY_CHANNEL` — post notifications via Slack bot
- `SLACK_WEBHOOK_URL` — incoming webhook URL for notifications

Fallback and tuning:

- `HASH_DIM` — embedding dimension used for deterministic hash fallback
- `CONVERT_PDFS`, `FORCE_PDF`, `MAX_PDF_BYTES` — pdf ingestion tuning

## Production considerations & security hardening

This repository is a proof-of-concept. If you plan to promote it to production, consider the following changes (non-exhaustive):

- Replace in-memory contract registry with a durable datastore (Firestore, PostgreSQL, etc.).
- Move file storage to an object storage service (S3/GCS) and serve files via signed URLs.
- Protect all endpoints with authentication and authorization (OAuth2 / JWT). Ensure vendor and distributor roles are enforced.
- Move cryptographic keys out of the repository and into a secrets manager (AWS KMS, GCP KMS, Azure KeyVault, HashiCorp Vault). Do not store private keys in repo or local disk.
- Add input validation and file-type checks for uploads; limit upload sizes and sanitise filenames.
- Implement API rate limiting, structured logging, monitoring, and alerting for production.
- Add retry/backoff for external API calls (Pinecone, OpenAI, Dropbox, Slack) and handle quota/ratelimit gracefully.

## Troubleshooting

- If uploads silently fail: check `DROPBOX_TOKEN` usage and fallback to `public/uploads`. Inspect server logs for errors.
- If RAG returns poor results: confirm `PINECONE_INDEX` contains vectors (`ingest.js`), and that `OPENAI_API_KEY` is configured if you want OpenAI-level quality.
- If embedding code fails to load USE locally: ensure `@tensorflow/tfjs-node` and `@tensorflow-models/universal-sentence-encoder` are installed and compatible with your Node version.

## Next steps & suggestions

- Add a `.env.example` documenting required env variables for quick onboarding.
- Add an automated smoke test that verifies: file upload -> signature merge -> signing -> signature verification.
- Add CI (GitHub Actions) to run linting and tests and to validate critical scripts (ingest/query smoke tests) on PRs.
- Consider containerizing the service (Dockerfile) and adding a Helm chart or Terraform script for production deployment.

## Contributing

Contributions are welcome. Open an issue or a pull request with a description of the change and the reason. For larger refactors (persistence, auth, deployments), open an issue first to discuss design.


