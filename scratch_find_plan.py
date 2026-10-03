import os
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

workspace_docs = r"c:\Mujoco Projects\vninvest\docs"

print("Searching for files containing 'vietdungiitb' in c:\\Mujoco Projects\\vninvest\\docs...")
found_files = []
for file in os.listdir(workspace_docs):
    if file.endswith(".md"):
        filepath = os.path.join(workspace_docs, file)
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if "vietdungiitb" in content.lower() or "vnstockcharts" in content.lower():
                    found_files.append((file, len(content)))
        except Exception:
            pass

print(f"\nFound {len(found_files)} files in docs/ containing 'vietdungiitb' or 'vnstockcharts':")
for name, size in found_files:
    print(f" - docs/{name} ({size} bytes)")
