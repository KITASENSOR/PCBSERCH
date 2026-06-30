# SMT PCB Search

Cloudflare Workers + D1 application for SMT PCB BOM, material usage, packaging, production schedule, and material requirement queries.

## Current Deployment

- Worker URL: https://smt-pcb-search.s110513202.workers.dev
- Worker name: `smt-pcb-search`
- Cloudflare account ID: `d015cadd5a857ea10b617679c148d37c`
- Active deployment ID: `15cd3d75-1154-4f8d-99b3-ea7c34ef476b`
- Active version ID: `de3cee5b-e8cb-486c-8d74-a0f5e34cb34b`
- Version number: `24`
- Version created: `2026-06-30T05:13:19.968357Z`
- Deployment created: `2026-06-30T05:13:22.737031Z`
- Script ETag: `c75edade677cc9b56654ea1f6806c61264cb4a1489ff1affc7b6570018cf1c9c`

## D1 Database

- Database name: `smt-pcb-search-db`
- Database ID: `76d8928e-b9ba-4720-9709-43590abbef7f`
- Binding: `DB`

## Project Files

- `public/index.html`: Cloudflare Worker Assets frontend.
- `src/index.js`: Worker API entrypoint downloaded from the current Cloudflare deployment.
- `wrangler.jsonc`: Cloudflare Worker, Assets, observability, and D1 binding config.
- `cloudflare-version.json`: Local record of the Cloudflare deployment synced into this repository.
- `migrations/`: D1 schema migrations.
- `scripts/`: Excel-to-D1 import/export helpers.

The old root-level GitHub Pages redirect page has been removed. The app should be served through Cloudflare Worker Assets.

## API Surface

- `GET /api/health`
- `GET /api/bom`
- `GET /api/usage`
- `GET /api/packaging`
- `GET /api/schedule`
- `POST /api/materials/calculate`
- `GET /api/admin/export`
- `POST /api/admin/import`

Admin endpoints require `ADMIN_TOKEN` when that environment variable is configured.

## Local Development

```powershell
npm install
npm run dev
```

Local URL:

```text
http://127.0.0.1:8790/
```

## Deploy

```powershell
npm run deploy
```

## Future Workflow

After this Cloudflare-to-GitHub synchronization, future changes should use this order:

1. Pull the latest files from GitHub `main`.
2. Modify and test locally.
3. Commit and push changes back to GitHub.
4. Deploy the GitHub-synced project to Cloudflare.
5. Record any new Cloudflare deployment/version details in `cloudflare-version.json` and this README when they change.

## Branch Policy

The GitHub repository should keep only the `main` branch.
