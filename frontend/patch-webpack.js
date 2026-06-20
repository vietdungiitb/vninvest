const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, 'node_modules/react-scripts/config/webpack.config.js');

if (!fs.existsSync(configPath)) {
  console.log('[patch-webpack] webpack.config.js not found, skipping patch.');
  process.exit(0);
}

let content = fs.readFileSync(configPath, 'utf8');

// Replace include: paths.appSrc with an array including @vninvest/web
if (content.includes('include: paths.appSrc,')) {
  content = content.replace(
    'include: paths.appSrc,',
    'include: [paths.appSrc, /@vninvest\\/web/],'
  );
  fs.writeFileSync(configPath, content, 'utf8');
  console.log('[patch-webpack] Successfully patched webpack.config.js for @vninvest/web');
} else {
  console.log('[patch-webpack] Could not find target include pattern in webpack.config.js');
}
