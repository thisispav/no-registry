# no-registry — agent notes

## pkdns-cli and `install.sh`

The npm package `packages/cli` (`pkdns-cli`) and `packages/cli/install.sh` must stay in sync for anything that affects **GitHub Releases**, **install paths**, **environment variables** (`PKDNS_*`), **binary/tarball naming**, or **supported OS/arch**.

When you add or change a CLI feature that impacts those areas, update `packages/cli/install.sh` in the **same change** (same PR/task). If the change is only internal (logic, tests, no install/release surface), you do not need to touch `install.sh`.

Cursor loads the same policy from `.cursor/rules/no-registry-pkdns-install-sync.mdc` at the repo workspace root (`synonym`).
