with open(r'C:\Mujoco Projects\vninvest\packages\web\src\pages\ScreenerPage.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove the duplicate fmtNum function (second occurrence around line 179)
new_lines = []
skip = False
for i, line in enumerate(lines):
    if i == 178:  # line 179 (0-indexed 178)
        skip = True
        continue
    if skip and i == 179:
        skip = False
        continue
    if skip and i == 180:
        skip = False
        continue
    if skip and i == 181:
        skip = False
        continue
    if skip and i == 182:
        skip = False
        continue
    new_lines.append(line)

with open(r'C:\Mujoco Projects\vninvest\packages\web\src\pages\ScreenerPage.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.writelines(new_lines)
print('Done')