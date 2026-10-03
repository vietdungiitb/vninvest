import os
import glob

for f in glob.glob('c:/Mujoco Projects/vninvest/packages/**/*.py', recursive=True):
    try:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
        
        if "`n" in content:
            new_content = content.replace("`n", "\n")
            with open(f, 'w', encoding='utf-8') as file:
                file.write(new_content)
                print(f"Fixed {f}")
    except Exception as e:
        pass
