#!/usr/bin/env bash
# Renders the Sprawl flight film from ../../sprawl (the same engine as the Windows screensaver) and adds it to a built APK.
# Needs: node + playwright (with its Chromium), ffmpeg, python3 + cryptography. Slow on CPU: plan on hours, not minutes.
#   ./render.sh                       -> out/flight.mp4 (1920x1080, 60 fps, 150 s, loops seamlessly)
#   ./render.sh app-release.apk key.p12 PASSWORD   -> also out/zrl-sprawl-eversolo.apk (film added, signed with your key)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
(cd ../../sprawl && exec python3 -m http.server 8896 --bind 127.0.0.1 >/dev/null 2>&1) & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 2
W=${WORKERS:-4}
for k in $(seq 0 $((W-1))); do node film.js out/frames 0 9000 60 1920 1080 "" jpg "$W" "$k" > "out/worker-$k.log" 2>&1 & done
wait $(jobs -p | grep -v "^$SRV$")
N=$(ls out/frames/*.jpg | wc -l); [ "$N" = 9000 ] || { echo "only $N of 9000 frames rendered; run again to finish"; exit 1; }
X="-c:v libx264 -preset slow -profile:v high -level 4.2 -b:v 8800k -maxrate 15M -bufsize 20M -g 120 -keyint_min 120 -sc_threshold 0 -bf 2 -pix_fmt yuv420p -x264-params open-gop=0:aq-mode=3:aq-strength=1.1 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -an"
ffmpeg -hide_banner -loglevel error -y -framerate 60 -i out/frames/f%05d.jpg $X -pass 1 -passlogfile out/p -f mp4 /dev/null
ffmpeg -hide_banner -loglevel error -y -framerate 60 -i out/frames/f%05d.jpg $X -pass 2 -passlogfile out/p -movflags +faststart out/flight.mp4
sha256sum out/flight.mp4
if [ $# -ge 3 ]; then
  python3 pack_film.py "$1" out/zrl-sprawl-eversolo.apk "$2" "$3" assets/flight.mp4=out/flight.mp4
  sha256sum out/zrl-sprawl-eversolo.apk
fi
