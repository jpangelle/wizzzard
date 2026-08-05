#!/usr/bin/env bash
# One-off generator for the placeholder app icon (purple rounded square + wizard emoji).
# Renders with AppKit, downsizes with sips, packs with iconutil. Re-run to regenerate.
set -euo pipefail
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

cat > "$tmp/render.swift" <<'EOF'
import AppKit

let side: CGFloat = 1024
let image = NSImage(size: NSSize(width: side, height: side))
image.lockFocus()
let rect = NSRect(x: 0, y: 0, width: side, height: side).insetBy(dx: 80, dy: 80)
NSColor(calibratedRed: 0.35, green: 0.20, blue: 0.60, alpha: 1).setFill()
NSBezierPath(roundedRect: rect, xRadius: 180, yRadius: 180).fill()
let emoji = NSAttributedString(string: "🧙", attributes: [.font: NSFont.systemFont(ofSize: 560)])
let esize = emoji.size()
emoji.draw(at: NSPoint(x: (side - esize.width) / 2, y: (side - esize.height) / 2))
image.unlockFocus()
let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
let png = rep.representation(using: .png, properties: [:])!
try! png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
EOF

swift "$tmp/render.swift" "$tmp/icon1024.png"

iconset="$tmp/AppIcon.iconset"
mkdir "$iconset"
for s in 16 32 128 256 512; do
  sips -z "$s" "$s" "$tmp/icon1024.png" --out "$iconset/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z "$d" "$d" "$tmp/icon1024.png" --out "$iconset/icon_${s}x${s}@2x.png" >/dev/null
done

iconutil -c icns "$iconset" -o template/Resources/AppIcon.icns
echo "Wrote template/Resources/AppIcon.icns"
