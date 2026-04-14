# No Registry

**PKDNS** — a naming layer where addresses are cryptographic keys, not registrar property.

No registrar. No authority. No permission required.

→ [noregistry.com](https://noregistry.com)

---

## Structure

Monorepo (`bun` workspaces):

```
packages/
  app/  Landing page — original single-file `index.html` (deploy on Vercel with root `packages/app`)
  cli/  pkdns CLI (`pkdns-cli` package — one-command PKDNS setup)
```

## Running locally

**Site:** open `packages/app/index.html` in a browser, or from the repo root run `bun run dev:app` (Vite dev server, no React — same markup/CSS as shipped).

**CLI:** from the repo root, `bun install` then `bun run dev:cli`, or `cd packages/cli && bun run dev`.
