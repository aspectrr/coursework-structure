#!/usr/bin/env python3
"""Generate placeholder RGBA PNG icons for Tauri (and .icns via iconutil)."""
from PIL import Image
import struct, os, subprocess, sys

def write(path, size):
    with open(path, "wb") as f:
        f.write(png(size))

def main():
    icon_dir = "src-tauri/icons"
    os.makedirs(icon_dir, exist_ok=True)

    # Generate the 1024 master via the dedicated icon script, then derive sizes.
    import subprocess, sys
    here = os.path.dirname(os.path.abspath(__file__))
    master_script = os.path.join(here, "make-icon.py")
    if os.path.exists(master_script):
        subprocess.run([sys.executable, master_script], check=True)

    master = Image.open(f"{icon_dir}/app-icon.png").convert("RGBA")
    def write(path, size):
        master.resize((size, size), Image.LANCZOS).save(path)

    write(f"{icon_dir}/32x32.png", 32)
    write(f"{icon_dir}/128x128.png", 128)
    write(f"{icon_dir}/128x128@2x.png", 256)

    # .icns via iconutil (macOS)
    iconset = f"{icon_dir}/icon.iconset"
    os.makedirs(iconset, exist_ok=True)
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    for s in sizes:
        write(f"{iconset}/icon_{s}x{s}.png", s)
    import shutil
    shutil.copy(f"{iconset}/icon_32x32.png",   f"{iconset}/icon_16x16@2x.png")
    shutil.copy(f"{iconset}/icon_64x64.png",   f"{iconset}/icon_32x32@2x.png")
    shutil.copy(f"{iconset}/icon_256x256.png", f"{iconset}/icon_128x128@2x.png")
    shutil.copy(f"{iconset}/icon_1024x1024.png", f"{iconset}/icon_512x512@2x.png")
    if sys.platform == "darwin":
        subprocess.run(["iconutil", "-c", "icns", iconset, "-o", f"{icon_dir}/icon.icns"], check=True)

    # .ico (Windows) — wraps a 32x32 entry
    img32 = master.resize((32, 32), Image.LANCZOS)
    import io
    buf = io.BytesIO()
    img32.save(buf, format="PNG")
    img_bytes = buf.getvalue()
    import struct
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", 32, 32, 0, 0, 1, 32, len(img_bytes), 22)
    with open(f"{icon_dir}/icon.ico", "wb") as f:
        f.write(header + entry + img_bytes)

    print("icons regenerated (RGBA)")

if __name__ == "__main__":
    main()
