#!/usr/bin/env bash
# Builds ZRL-Sprawl.zip from this source. Needs: mono's C# compiler (mcs), curl, unzip, zip, sha256sum.
#   ./build.sh            fetches the WebView2 SDK from NuGet (pinned by checksum)
#   WV2_NUPKG=file ./build.sh   uses a copy you already have
set -euo pipefail
cd "$(dirname "$0")"

WV2_VERSION=1.0.4022.49
WV2_SHA256=ee9de67e5bb9ef3a96c5689b2efc8188e2df160a0e79234c0404243782fde5fb
VERSION=$(tr -d ' \r\n' < VERSION)
OUT=build/ZRL-Sprawl

rm -rf build ZRL-Sprawl.zip
mkdir -p build/wv2 "$OUT"

NUPKG=${WV2_NUPKG:-build/wv2.nupkg}
if [ ! -f "$NUPKG" ]; then
  curl -fsSL -o "$NUPKG" "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$WV2_VERSION/microsoft.web.webview2.$WV2_VERSION.nupkg"
fi
echo "$WV2_SHA256  $NUPKG" | sha256sum -c -
unzip -q "$NUPKG" -d build/wv2

LIB=build/wv2/lib/net462
mcs -target:winexe -platform:x64 -optimize+ -win32icon:windows/zrl.ico -out:"$OUT/ZRL-Sprawl.scr" \
  -r:System.Windows.Forms.dll -r:System.Drawing.dll -r:System.Core.dll \
  -r:"$LIB/Microsoft.Web.WebView2.Core.dll" -r:"$LIB/Microsoft.Web.WebView2.WinForms.dll" \
  windows/saver.cs

cp "$LIB/Microsoft.Web.WebView2.Core.dll" "$LIB/Microsoft.Web.WebView2.WinForms.dll" build/wv2/runtimes/win-x64/native/WebView2Loader.dll "$OUT/"
cp -r sprawl "$OUT/sprawl"
cp LICENSE THIRD-PARTY-NOTICES.md "$OUT/"
sed "s/@VERSION@/$VERSION/g" windows/README.txt | sed 's/$/\r/' > "$OUT/README.txt"

( cd build && zip -qr -X ../ZRL-Sprawl.zip ZRL-Sprawl )
echo "ZRL Sprawl $VERSION"
sha256sum ZRL-Sprawl.zip
