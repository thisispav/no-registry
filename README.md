# No Registry

**PKDNS** — a naming layer where addresses are cryptographic keys, not registrar property.

No registrar. No authority. No permission required.

→ [noregistry.com](https://noregistry.com)

Repository: [github.com/thisispav/no-registry](https://github.com/thisispav/no-registry/)

---

## Structure

Monorepo (`bun` workspaces):

```
packages/
  app/  Landing page — original single-file `index.html` (deploy on Vercel with root `packages/app`)
  cli/  pkdns CLI (`pkdns-cli` package — one-command PKDNS setup), plus `install.sh` for binary installs
```

## Install the CLI (binary)

The installer downloads the latest **pkdns** release asset for your OS/arch from [GitHub Releases](https://github.com/thisispav/no-registry/releases), verifies SHA256 when a checksum file is published, and installs the binary under `~/.pkdns/bin/pkdns` (or `$PKDNS_DIR/bin/pkdns`).

```sh
curl -fsSL https://raw.githubusercontent.com/thisispav/no-registry/main/packages/cli/install.sh | sh
```

Optional environment variables (read by `install.sh`):

| Variable | Meaning |
|----------|---------|
| `PKDNS_DIR` | Install root (default: `~/.pkdns`) |
| `PKDNS_VERSION` | Exact release tag to install (default: latest from the API) |

If `~/.pkdns/bin` is not on your `PATH`, the script prints an `export PATH=…` line to add to your shell config.

**Note:** The curl flow only works once releases include the compiled archives expected by `packages/cli/install.sh` (e.g. `pkdns-<tag>-linux-amd64.tar.gz` and matching `sha256sums` file when you publish them).

## Using the CLI

After installation, the command is `pkdns`. From a dev checkout you can run `bun run dev:cli` or `cd packages/cli && bun run dev` (same interface).

```sh
pkdns --help
```

Common commands:

| Command | Description |
|---------|-------------|
| `pkdns init` | Interactive setup wizard — configure and start pkdns |
| `pkdns install` | Download and install the pkdns binary for this platform (Node/bun workflow) |
| `pkdns upgrade` | Upgrade pkdns to the latest release |
| `pkdns start` / `stop` / `restart` | Control the pkdns server |
| `pkdns status` | Show server status |
| `pkdns logs` | Show server logs |
| `pkdns resolve` | Resolve a domain through pkdns |
| `pkdns config` | Manage configuration (`show`, `get`, `set` subcommands) |
| `pkdns test` | Self-test that pkdns is set up correctly |
| `pkdns version` | Show CLI and binary version |

## Running locally

**Site:** open `packages/app/index.html` in a browser, or from the repo root run `bun run dev:app` (Vite dev server, no React — same markup/CSS as shipped).

**CLI:** from the repo root, `bun install` then `bun run dev:cli`, or `cd packages/cli && bun run dev`.
