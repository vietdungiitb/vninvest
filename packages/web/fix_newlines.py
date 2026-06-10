import os
import glob

for f in glob.glob('c:/Mujoco Projects/vninvest/packages/web/src/**/*.js', recursive=True):
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # We want to replace the literal string "
" (backtick followed by n)
    # Since backtick is not special in Python strings, we can just use "
"
    if "
" in content:
        new_content = content.replace("
", "\n")
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
            print(f"Fixed {f}")
