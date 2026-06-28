#!/usr/bin/env python3
"""Generate placeholder RGBA PNG icons for Tauri (and .icns via iconutil)."""
import struct, zlib, os, subprocess, sys

def png(size, rgb=(199, 91, 57)):
    sig = b"\x89PNG\r\n\x1a\n"
    def chunk(typ, data):
        return struct.pack(">I", len(data)) + typ + data + struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # type 6 = RGBA
    rgba = bytes(rgb) + b"\xff"
    raw = b"".join(b"\x00" + rgba * size for _ in range(size))
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")

def write(path, size):
    with open(path, "wb") as f:
        f.write(png(size))

def main():
    icon_dir = "src-tauri/icons"
    os.makedirs(icon_dir, exist_ok=True)
    write(f"{icon_dir}/32x32.png", 32)
    write(f"{icon_dir}/128x128.png", 128)
    write(f"{icon_dir}/128x128@2x.png", 256)
    write(f"{icon_dir}/app-icon.png", 512)

    # .icns via iconutil (macOS)
    iconset = f"{icon_dir}/icon.iconset"
    os.makedirs(iconset, exist_ok=True)
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    for s in sizes:
        write(f"{iconset}/icon_{s}x{s}.png", s)
    # Retina variants
    import shutil
    shutil.copy(f"{iconset}/icon_32x32.png",   f"{iconset}/icon_16x16@2x.png")
    shutil.copy(f"{iconset}/icon_64x64.png",   f"{iconset}/icon_32x32@2x.png")
    shutil.copy(f"{iconset}/icon_256x256.png", f"{iconset}/icon_128x128@2x.png")
    shutil.copy(f"{iconset}/icon_1024x1024.png", f"{iconset}/icon_512x512@2x.png")
    if sys.platform == "darwin":
        subprocess.run(["iconutil", "-c", "icns", iconset, "-o", f"{icon_dir}/icon.icns"], check=True)

    # .ico (Windows) — wraps one 32x32 PNG entry
    img = png(32)
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", 32, 32, 0, 0, 1, 32, len(img), 22)
    with open(f"{icon_dir}/icon.ico", "wb") as f:
        f.write(header + entry + img)

    print("icons regenerated (RGBA)")

if __name__ == "__main__":
    main()
