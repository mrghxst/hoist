#!/usr/bin/env sh
# Subset the Geist variable fonts to the characters Hoist uses (Latin, Latin-1,
# Latin Extended-A, Romanian comma letters, punctuation and a few symbols).
# Needs Python with fonttools and brotli: pip install fonttools brotli
set -e
SRC=node_modules/geist/dist/fonts
OUT=static/fonts
UNICODES="U+0000-00FF,U+0100-017F,U+0218-021B,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+2605,U+2713,U+2717,U+23CE,U+FEFF,U+FFFD"
for f in "geist-sans/Geist-Variable" "geist-mono/GeistMono-Variable"; do
  case "$f" in *Mono*) out=geist-mono-1.8.2-latin.woff2 ;; *) out=geist-1.8.2-latin.woff2 ;; esac
  python -m fontTools.subset "$SRC/$f.ttf" --unicodes="$UNICODES" \
    --layout-features='kern,liga,calt,tnum,case,ss01' --flavor=woff2 \
    --output-file="$OUT/$out"
done
ls -l "$OUT"
