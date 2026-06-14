#!/usr/bin/env bash
#
# URDF Studio installer.
#
# Builds the native (release) Tauri app from source and installs a `urdfstudio`
# launcher onto your PATH so you can start the app from any terminal:
#
#     ./scripts/install.sh        # build + install
#     urdfstudio                  # launch
#
# By default everything is installed under your home directory (no sudo):
#   - launcher : ~/.local/bin/urdfstudio
#   - binary   : ~/.local/lib/urdfstudio/
#   - desktop  : ~/.local/share/applications/urdfstudio.desktop   (Linux)
#
# Override locations with environment variables:
#   PREFIX=/usr/local sudo ./scripts/install.sh   # system-wide install
#   BIN_DIR=/somewhere/bin LIB_DIR=/somewhere/lib ./scripts/install.sh
#
# Other knobs:
#   SKIP_BUILD=1   reuse an existing release binary instead of rebuilding
#   SKIP_DEPS=1    don't run `npm install`
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PREFIX="${PREFIX:-$HOME/.local}"
BIN_DIR="${BIN_DIR:-$PREFIX/bin}"
LIB_DIR="${LIB_DIR:-$PREFIX/lib/urdfstudio}"
DESKTOP_DIR="${DESKTOP_DIR:-$HOME/.local/share/applications}"

APP_NAME="urdfstudio"
# Binary name produced by `tauri build` (matches package name in src-tauri/Cargo.toml).
TAURI_BIN="urdf-studio"

OS="$(uname -s)"

# ---------------------------------------------------------------------------
# Pretty output
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
  BOLD=""; GREEN=""; YELLOW=""; RED=""; DIM=""; RESET=""
fi
info()  { printf '%s==>%s %s\n' "$GREEN$BOLD" "$RESET" "$*"; }
warn()  { printf '%s warn:%s %s\n' "$YELLOW$BOLD" "$RESET" "$*" >&2; }
die()   { printf '%s error:%s %s\n' "$RED$BOLD" "$RESET" "$*" >&2; exit 1; }
step()  { printf '%s  - %s%s\n' "$DIM" "$*" "$RESET"; }

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------
check_prereqs() {
  info "Checking prerequisites"

  command -v node >/dev/null 2>&1 || die "Node.js not found. Install Node 18+ (https://nodejs.org)."
  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$node_major" -ge 18 ] || die "Node 18+ required (found $(node -v))."
  step "node $(node -v)"

  command -v npm >/dev/null 2>&1 || die "npm not found."
  step "npm $(npm -v)"

  # Rust may live under ~/.cargo/env without being on PATH yet.
  if ! command -v cargo >/dev/null 2>&1; then
    # shellcheck disable=SC1090
    [ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
  fi
  command -v cargo >/dev/null 2>&1 || die "Rust/cargo not found. Install via https://rustup.rs"
  step "$(cargo --version)"

  if [ "$OS" = "Linux" ]; then
    if ! pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
      warn "webkit2gtk-4.1 dev libraries not detected — the Tauri build will fail without them."
      cat >&2 <<EOF
${DIM}  Install the WebView/build dependencies (Debian/Ubuntu):
    sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \\
      libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  Fedora:
    sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \\
      libappindicator-gtk3-devel librsvg2-devel gcc gcc-c++${RESET}
EOF
    else
      step "webkit2gtk-4.1 present"
    fi
  fi

  if ! command -v xacro >/dev/null 2>&1; then
    warn "'xacro' CLI not found — opening .xacro files needs it (source your ROS setup.bash, or 'pip install xacro'). Plain .urdf files work without it."
  else
    step "xacro present"
  fi
}

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
build_app() {
  if [ "${SKIP_BUILD:-0}" = "1" ]; then
    info "SKIP_BUILD=1 — skipping build"
    return
  fi

  cd "$REPO_DIR"

  if [ "${SKIP_DEPS:-0}" != "1" ]; then
    info "Installing JS dependencies (npm install)"
    npm install
  fi

  info "Building the native app (npm run tauri build) — this can take a few minutes"
  # `npm run tauri` wraps the CLI and strips snap GTK env vars; `build` produces
  # the release binary + OS installers under src-tauri/target/release/.
  npm run tauri build
}

# ---------------------------------------------------------------------------
# Locate the built binary / app bundle
# ---------------------------------------------------------------------------
locate_binary() {
  RELEASE_DIR="$REPO_DIR/src-tauri/target/release"
  if [ "$OS" = "Darwin" ]; then
    MAC_APP="$(find "$RELEASE_DIR/bundle/macos" -maxdepth 1 -name '*.app' 2>/dev/null | head -n1 || true)"
    [ -n "$MAC_APP" ] || die "Could not find the built .app bundle under $RELEASE_DIR/bundle/macos."
    step "found app bundle: $MAC_APP"
  else
    BUILT_BIN="$RELEASE_DIR/$TAURI_BIN"
    [ -x "$BUILT_BIN" ] || die "Could not find built binary at $BUILT_BIN (build may have failed; re-run without SKIP_BUILD)."
    step "found binary: $BUILT_BIN"
  fi
}

# ---------------------------------------------------------------------------
# Install launcher
# ---------------------------------------------------------------------------
install_launcher() {
  info "Installing launcher to $BIN_DIR/$APP_NAME"
  mkdir -p "$BIN_DIR" "$LIB_DIR"

  if [ "$OS" = "Darwin" ]; then
    # Copy the .app into the lib dir and launch it via `open`, forwarding any
    # file argument to the app.
    rm -rf "$LIB_DIR/$TAURI_BIN.app"
    cp -R "$MAC_APP" "$LIB_DIR/$TAURI_BIN.app"
    cat > "$BIN_DIR/$APP_NAME" <<EOF
#!/usr/bin/env bash
# URDF Studio launcher (generated by scripts/install.sh)
exec open -a "$LIB_DIR/$TAURI_BIN.app" "\$@"
EOF
  else
    # Copy the self-contained binary out of the repo so the install survives
    # the repo being moved/deleted.
    install -m 0755 "$BUILT_BIN" "$LIB_DIR/$TAURI_BIN"
    # Wrapper strips the snap-injected GTK/GLib env vars (see scripts/tauri.sh)
    # so GTK loads system modules instead of crashing on a snap core glibc.
    cat > "$BIN_DIR/$APP_NAME" <<EOF
#!/usr/bin/env bash
# URDF Studio launcher (generated by scripts/install.sh)
exec env \\
  -u GTK_PATH \\
  -u GTK_EXE_PREFIX \\
  -u GTK_IM_MODULE_FILE \\
  -u GDK_PIXBUF_MODULE_FILE \\
  -u GDK_PIXBUF_MODULEDIR \\
  -u GIO_MODULE_DIR \\
  -u GSETTINGS_SCHEMA_DIR \\
  -u LOCPATH \\
  "$LIB_DIR/$TAURI_BIN" "\$@"
EOF
  fi

  chmod +x "$BIN_DIR/$APP_NAME"
}

# ---------------------------------------------------------------------------
# Desktop entry (Linux)
# ---------------------------------------------------------------------------
install_desktop_entry() {
  [ "$OS" = "Linux" ] || return 0
  info "Installing desktop entry"
  mkdir -p "$DESKTOP_DIR"
  local icon="$REPO_DIR/src-tauri/icons/icon.png"
  cat > "$DESKTOP_DIR/$APP_NAME.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=URDF Studio
Comment=Visual URDF/xacro editor with live 3D preview
Exec=$BIN_DIR/$APP_NAME %f
Icon=$icon
Terminal=false
Categories=Development;Engineering;
MimeType=application/x-urdf;
EOF
  command -v update-desktop-database >/dev/null 2>&1 && \
    update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
}

# ---------------------------------------------------------------------------
# PATH advice
# ---------------------------------------------------------------------------
report_path() {
  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
      warn "$BIN_DIR is not on your PATH. Add this to your shell profile:"
      printf '    export PATH="%s:$PATH"\n' "$BIN_DIR" >&2
      ;;
  esac
}

# ---------------------------------------------------------------------------
main() {
  printf '%sURDF Studio installer%s\n\n' "$BOLD" "$RESET"
  check_prereqs
  build_app
  locate_binary
  install_launcher
  install_desktop_entry
  report_path
  printf '\n%sDone.%s Launch with: %surdfstudio%s\n' "$GREEN$BOLD" "$RESET" "$BOLD" "$RESET"
}

main "$@"
