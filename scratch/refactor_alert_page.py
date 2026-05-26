import os
import re

file_path = r"c:\Mujoco Projects\vninvest\packages\web\src\pages\AlertCenterPage.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Locate and extract the CSS inside e("style", { key: "styles" }, `...`)
# The block starts with e("style", { key: "styles" }, `
# and ends with `),
style_pattern = re.compile(
    r'e\("style",\s*{\s*key:\s*"styles"\s*},\s*`([\s\S]*?)`\),', 
    re.MULTILINE
)

match = style_pattern.search(content)
if not match:
    print("Error: Could not find style block in AlertCenterPage.js")
    exit(1)

css_content = match.group(1)

# Remove the style block from the render list
content_no_style = style_pattern.sub("", content)

# 2. Insert the useEffect hook in AlertCenterPage
# Let's find a good place, for example after the pageStats useState:
# const [pageStats, setPageStats] = useState(1);
target_use_state = "const [pageStats, setPageStats] = useState(1);"
hook_code = """const [pageStats, setPageStats] = useState(1);

  // Inject style block on mount and clean up on unmount to prevent browser style-reflow flashes
  useEffect(() => {
    const styleId = "core-alert-center-page-styles";
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.textContent = CORE_STYLES;
      document.head.appendChild(styleEl);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) {
        el.remove();
      }
    };
  }, []);"""

if target_use_state not in content_no_style:
    print("Error: Could not find pageStats state declaration to insert useEffect hook")
    exit(1)

content_with_hook = content_no_style.replace(target_use_state, hook_code)

# 3. Append the CORE_STYLES declaration at the end of the file
css_declaration = f'\n\nconst CORE_STYLES = `\n{css_content.strip()}\n`;\n'
final_content = content_with_hook + css_declaration

with open(file_path, "w", encoding="utf-8") as f:
    f.write(final_content)

print("Successfully refactored AlertCenterPage.js style block!")
