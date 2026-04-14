#!/usr/bin/env sh
# pkdns installer
# Usage: curl -fsSL https://raw.githubusercontent.com/thisispav/no-registry/main/packages/cli/install.sh | sh

set -e

REPO="thisispav/no-registry"
INSTALL_DIR="${PKDNS_DIR:-$HOME/.pkdns}"
BIN_DIR="$INSTALL_DIR/bin"
BINARY="$BIN_DIR/pkdns"

# ── helpers ──────────────────────────────────────────────────────────────────

info()  { printf '\033[1;34m[pkdns]\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m[pkdns]\033[0m %s\n' "$*"; }
err()   { printf '\033[1;31m[pkdns] error:\033[0m %s\n' "$*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || err "Required tool not found: $1"
}

# ── platform detection ────────────────────────────────────────────────────────

detect_os() {
  case "$(uname -s)" in
    Linux)  echo "linux" ;;
    Darwin) echo "osx"   ;;
    *)      err "Unsupported OS: $(uname -s). Only Linux and macOS are supported." ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "amd64"  ;;
    aarch64|arm64) echo "arm64" ;;
    *) err "Unsupported architecture: $(uname -m). Only x86_64 and arm64 are supported." ;;
  esac
}

# ── latest release ────────────────────────────────────────────────────────────

fetch_latest_tag() {
  API_URL="https://api.github.com/repos/$REPO/releases/latest"

  if command -v curl >/dev/null 2>&1; then
    TAG=$(curl -fsSL \
      -H "Accept: application/vnd.github.v3+json" \
      -H "User-Agent: pkdns-install-sh" \
      "$API_URL" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
  elif command -v wget >/dev/null 2>&1; then
    TAG=$(wget -qO- \
      --header="Accept: application/vnd.github.v3+json" \
      --header="User-Agent: pkdns-install-sh" \
      "$API_URL" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
  else
    err "Neither curl nor wget found. Please install one and try again."
  fi

  [ -n "$TAG" ] || err "Could not determine latest release tag from GitHub."
  echo "$TAG"
}

download() {
  URL="$1"
  DEST="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -H "User-Agent: pkdns-install-sh" -o "$DEST" "$URL"
  else
    wget -qO "$DEST" --header="User-Agent: pkdns-install-sh" "$URL"
  fi
}

# ── checksum verification ─────────────────────────────────────────────────────

verify_checksum() {
  FILE="$1"
  SUMS_FILE="$2"
  ASSET_NAME="$3"

  if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
    info "sha256sum / shasum not found — skipping checksum verification."
    return 0
  fi

  EXPECTED=$(grep "$ASSET_NAME" "$SUMS_FILE" | awk '{print $1}')
  [ -n "$EXPECTED" ] || { info "No checksum entry for $ASSET_NAME — skipping."; return 0; }

  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL=$(sha256sum "$FILE" | awk '{print $1}')
  else
    ACTUAL=$(shasum -a 256 "$FILE" | awk '{print $1}')
  fi

  [ "$ACTUAL" = "$EXPECTED" ] || err "SHA256 mismatch!\n  expected: $EXPECTED\n  got:      $ACTUAL"
  ok "Checksum verified."
}

# ── main ──────────────────────────────────────────────────────────────────────

main() {
  OS=$(detect_os)
  ARCH=$(detect_arch)

  VERSION="${PKDNS_VERSION:-}"
  if [ -z "$VERSION" ]; then
    info "Fetching latest release…"
    VERSION=$(fetch_latest_tag)
  fi

  ASSET="pkdns-${VERSION}-${OS}-${ARCH}.tar.gz"
  SUMS="pkdns-${VERSION}-sha256sums.txt"
  BASE_URL="https://github.com/$REPO/releases/download/$VERSION"

  info "Installing pkdns $VERSION ($OS/$ARCH)…"

  TMP=$(mktemp -d)
  trap 'rm -rf "$TMP"' EXIT

  TAR_PATH="$TMP/$ASSET"
  info "Downloading $ASSET…"
  download "$BASE_URL/$ASSET" "$TAR_PATH" || err "Download failed. Check that release $VERSION has an asset for $OS/$ARCH."

  # optional checksum
  SUMS_PATH="$TMP/$SUMS"
  if download "$BASE_URL/$SUMS" "$SUMS_PATH" 2>/dev/null; then
    verify_checksum "$TAR_PATH" "$SUMS_PATH" "$ASSET"
  else
    info "No checksum file found for this release — skipping verification."
  fi

  info "Extracting to $BIN_DIR…"
  mkdir -p "$BIN_DIR"
  tar -xzf "$TAR_PATH" -C "$BIN_DIR" --strip-components=1 2>/dev/null \
    || tar -xzf "$TAR_PATH" -C "$BIN_DIR"

  # find the binary wherever it ended up after extraction
  EXTRACTED=$(find "$BIN_DIR" -type f -name "pkdns" | head -1)
  [ -n "$EXTRACTED" ] || err "Could not find 'pkdns' binary after extraction."

  if [ "$EXTRACTED" != "$BINARY" ]; then
    mv "$EXTRACTED" "$BINARY"
  fi
  chmod 755 "$BINARY"

  # write version metadata
  mkdir -p "$INSTALL_DIR"
  printf '{"version":"%s","platform":"%s-%s","installedAt":"%s"}\n' \
    "$VERSION" "$OS" "$ARCH" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    > "$INSTALL_DIR/installed-version.json"

  ok "pkdns $VERSION installed to $BINARY"

  # ── PATH setup ──────────────────────────────────────────────────────────────
  setup_path() {
    case ":$PATH:" in
      *":$BIN_DIR:"*)
        # Already active in the current session — nothing to do.
        return 0
        ;;
    esac

    # Pick the shell rc file based on $SHELL.
    case "${SHELL:-}" in
      */zsh)  RC="$HOME/.zshrc" ;;
      */bash)
        if [ "$(uname -s)" = "Darwin" ]; then
          RC="$HOME/.bash_profile"
        else
          RC="$HOME/.bashrc"
        fi
        ;;
      */fish) RC="$HOME/.config/fish/config.fish" ;;
      *)      RC="$HOME/.profile" ;;
    esac

    # Already written to the rc file — skip.
    if [ -f "$RC" ] && grep -qF "$BIN_DIR" "$RC" 2>/dev/null; then
      return 0
    fi

    # fish uses fish_add_path; all other shells use export.
    case "${SHELL:-}" in
      */fish) LINE="fish_add_path \"$BIN_DIR\"" ;;
      *)      LINE="export PATH=\"$BIN_DIR:\$PATH\"" ;;
    esac

    printf '\n# Added by pkdns installer\n%s\n' "$LINE" >> "$RC"
    ok "Added pkdns to PATH in $RC"
    info "Run: source $RC  (or open a new terminal)"
  }

  setup_path
}

main "$@"
