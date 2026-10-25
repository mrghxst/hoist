#!/usr/bin/env sh
# Subset the Geist variable fonts to the characters Hoist uses (Latin, Latin-1,
# Latin Extended-A, Romanian comma letters, punctuation and a few symbols).
# Needs Python with fonttools and brotli: pip install fonttools brotli
set -e
SRC=node_modules/geist/dist/fonts
OUT=static/fonts
# Geist comes in two files: the core (Latin-1, punctuation, the few symbols
# the UI draws) is preloaded; Latin Extended (ő, ș, ł, ...) is fetched only
# when a page shows such a letter (unicode-range in src/app.css).
CORE="U+0000-00FF,U+2010-2027,U+2030-203A,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+2713,U+2717,U+23CE,U+FEFF,U+FFFD"
EXT="U+0100-017F,U+0218-021B,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-200F,U+2028-202F,U+203B-206F,U+2605"
FEATURES='kern,liga,calt,tnum,case,ss01'
# Only weights 400 to 600 are used, so the weight axis is cut to that range
# (still a variable font, about a third smaller).
TMP=$(mktemp -d)
rm -f "$OUT"/geist-*.woff2
python -m fontTools.varLib.instancer "$SRC/geist-sans/Geist-Variable.ttf" wght=400:600 -o "$TMP/sans.ttf"
python -m fontTools.varLib.instancer "$SRC/geist-mono/GeistMono-Variable.ttf" wght=400:600 -o "$TMP/mono.ttf"
python -m fontTools.subset "$TMP/sans.ttf" --unicodes="$CORE" --layout-features="$FEATURES"   --flavor=woff2 --output-file="$OUT/geist-1.8.2-latin-wght400-600.woff2"
python -m fontTools.subset "$TMP/sans.ttf" --unicodes="$EXT" --layout-features="$FEATURES"   --flavor=woff2 --output-file="$OUT/geist-1.8.2-latin-ext-wght400-600.woff2"
python -m fontTools.subset "$TMP/mono.ttf" --unicodes="$CORE,$EXT" --layout-features="$FEATURES"   --flavor=woff2 --output-file="$OUT/geist-mono-1.8.2-latin-wght400-600.woff2"
rm -rf "$TMP"
ls -l "$OUT"
