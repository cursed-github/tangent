#!/usr/bin/env bash
# Build packaged extension zips for Chrome and Firefox from the shared source.
#
# Usage: ./build.sh            # builds both targets
#        ./build.sh chrome     # builds only Chrome
#        ./build.sh firefox    # builds only Firefox
#
# Output: dist/chrome/ + dist/tangent-chrome-<version>.zip
#         dist/firefox/ + dist/tangent-firefox-<version>.zip
set -euo pipefail

cd "$(dirname "$0")"

# Files shared by every target (everything the extension needs at runtime).
SHARED=(content.js styles.css rules.json icons)

VERSION="$(grep -m1 '"version"' manifest.json | sed -E 's/.*"version"[^"]*"([^"]+)".*/\1/')"

build() {
  local target="$1" manifest="$2"
  local out="dist/$target"

  echo "==> Building $target (v$VERSION)"
  rm -rf "$out"
  mkdir -p "$out"

  cp -R "${SHARED[@]}" "$out/"
  cp "$manifest" "$out/manifest.json"

  # Zip from inside the folder so paths are at the archive root (store required).
  local zipname="tangent-$target-$VERSION.zip"
  rm -f "dist/$zipname"
  if command -v zip >/dev/null 2>&1; then
    ( cd "$out" && zip -qr -X "../$zipname" . )
  else
    # Fallback: use Python's zipfile so no external `zip` binary is needed.
    ( cd "$out" && python3 -c "import zipfile,os,sys
z=zipfile.ZipFile(os.path.join('..',sys.argv[1]),'w',zipfile.ZIP_DEFLATED)
for root,_,files in os.walk('.'):
    for f in sorted(files):
        p=os.path.join(root,f)
        z.write(p, os.path.relpath(p,'.'))
z.close()" "$zipname" )
  fi
  echo "    -> dist/$zipname"
}

targets=("${@:-chrome firefox}")
for t in ${targets[@]}; do
  case "$t" in
    chrome)  build chrome  manifest.json ;;
    firefox) build firefox manifest.firefox.json ;;
    *) echo "Unknown target: $t (use chrome or firefox)" >&2; exit 1 ;;
  esac
done

echo "Done."
