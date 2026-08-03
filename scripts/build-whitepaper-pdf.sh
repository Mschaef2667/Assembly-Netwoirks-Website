#!/usr/bin/env bash
#
# build-whitepaper-pdf.sh — regenerate the white paper PDF from the web page.
#
# The web page at public/whitepaper.html is the single source of truth. Its
# @media print block controls the PDF layout, so editing the page updates both
# the site and the download. Run this after changing the white paper content.
#
# Renders public/whitepaper.html -> public/the-buyer-truth-gap.pdf
#
# Requires WeasyPrint. Install once with:  pip install weasyprint
# (macOS may also need:  brew install pango )
#
# Usage:
#   ./scripts/build-whitepaper-pdf.sh

set -euo pipefail
cd "$(dirname "$0")/.."

SRC="public/whitepaper.html"
OUT="public/the-buyer-truth-gap.pdf"

echo "Rendering $SRC -> $OUT"
python3 -m weasyprint "$SRC" "$OUT" --base-url public/

PAGES=$(python3 -c "from pypdf import PdfReader; print(len(PdfReader('$OUT').pages))" 2>/dev/null || echo "?")
SIZE=$(du -h "$OUT" | cut -f1)
echo "Done. $OUT — $PAGES pages, $SIZE"
echo "Next: commit and deploy so the Download PDF button serves the new file."
