with open(r'C:\Mujoco Projects\vninvest\packages\web\src\pages\ScreenerPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the EMPTY_CONST line and the following blank line
content = content.replace(
    "const EMPTY_COND: ScreenerCondition = { field: 'rsi_14', op: 'lt', value: 30, logic: 'AND' };\n\n",
    ""
)

with open(r'C:\Mujoco Projects\vninvest\packages\web\src\pages\ScreenerPage.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print('Done')