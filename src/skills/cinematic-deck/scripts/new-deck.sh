#!/usr/bin/env bash
# Scaffold a deck folder: engine copy, a theme file and the starter page.
# Usage: new-deck.sh <target-dir> [blank|nocturne|plain|blueprint]
#   blank (default) writes an empty theme.css to fill from the brief.
set -euo pipefail

skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="${1:?usage: new-deck.sh <target-dir> [blank|nocturne|plain|blueprint]}"
theme="${2:-blank}"

if [[ -e "$target/index.html" ]]; then
  echo "error: $target/index.html already exists; choose another folder or edit that deck" >&2
  exit 1
fi

case "$theme" in
  blank|nocturne|plain|blueprint) ;;
  *) echo "error: unknown theme '$theme' (use blank, nocturne, plain or blueprint)" >&2; exit 1 ;;
esac

mkdir -p "$target/assets"
cp -r "$skill_dir/scripts/template/deck" "$target/deck"

if [[ "$theme" == blank ]]; then
  cat > "$target/theme.css" <<'CSS'
/* Theme for this deck. Set the tokens listed at the top of deck/base.css;
 * anything left unset falls back to a neutral light look. */
:root {
  --motion: 1;
}
CSS
else
  cp "$skill_dir/scripts/template/themes/$theme.css" "$target/theme.css"
fi

slug="$(basename "$target")"
sed "s/SLUG/$slug/" "$skill_dir/scripts/template/starter.html" > "$target/index.html"

echo "created $target (theme: $theme)"
echo "  index.html   slides"
echo "  theme.css    tokens + optional backdrop"
echo "  deck/        engine (copied; edit only to fix a bug in this deck)"
echo "  assets/      images and media"
