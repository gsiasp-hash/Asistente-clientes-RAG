#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || CHROME="$(command -v google-chrome-stable || command -v chromium)"

render() {
  local name="$1" title="$2" accent="$3"
  npx -y marked "$name.md" > "/tmp/$name.body.html"
  cat > "/tmp/$name.html" <<HTML
<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1f2430;
         font-size: 11pt; line-height: 1.55; margin: 0; }
  h1 { font-size: 20pt; color: ${accent}; border-bottom: 3px solid ${accent};
       padding-bottom: 8px; margin: 0 0 14px; line-height: 1.25; }
  h2 { font-size: 14pt; color: ${accent}; margin: 22px 0 8px; page-break-after: avoid; }
  p { margin: 7px 0; text-align: justify; }
  strong { color: #111; }
  code { background: #f2f0ec; padding: 1px 5px; border-radius: 4px;
         font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 9.5pt; }
  ul { margin: 6px 0; padding-left: 22px; }
  li { margin: 3px 0; }
  .cover-title { display: none; }
</style></head>
<body>
<h1 class="cover-title">${title}</h1>
$(cat "/tmp/$name.body.html")
</body></html>
HTML
  "$CHROME" --headless --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$(pwd)/$name.pdf" "file:///tmp/$name.html" 2>/dev/null
  echo "✓ $name.pdf generado"
}

render manual-aromax   "AromaX Pro 200 — Manual de usuario"        "#6F4E37"
render faq-asistente   "FAQ — Cómo funciona este asistente"        "#2563EB"

ls -lh *.pdf | awk '{print $9, $5}'
