with open(r'C:\Mujoco Projects\vninvest\packages\web\src\pages\ScreenerPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = """}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return '\u2014';
  return typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v);
}

export function ScreenerPage() {"""

new = """}

export function ScreenerPage() {"""

content = content.replace(old, new)

with open(r'C:\Mujoco Projects\vninvest\packages\web\src\pages\ScreenerPage.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print('Done')