/**
 * Build script: copies web assets into www/ for Capacitor
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC = __dirname;
const DEST = path.join(__dirname, 'www');

const INCLUDE = ['index.html', 'manifest.json', 'sw.js', 'css', 'js', 'assets'];
const EXCLUDE = new Set(['node_modules', 'android', 'www', '.git']);

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (!EXCLUDE.has(entry)) {
        copyRecursive(path.join(src, entry), path.join(dest, entry));
      }
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Clean www/
fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST);

for (const name of INCLUDE) {
  const src = path.join(SRC, name);
  if (fs.existsSync(src)) {
    copyRecursive(src, path.join(DEST, name));
    console.log(`copied: ${name}`);
  }
}

// Compute content hash of all built files (excluding sw.js itself)
function computeHash(dir) {
  const hash = crypto.createHash('md5');
  function walk(d) {
    for (const entry of fs.readdirSync(d).sort()) {
      const fullPath = path.join(d, entry);
      if (entry === 'sw.js') continue;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) walk(fullPath);
      else hash.update(fs.readFileSync(fullPath));
    }
  }
  walk(dir);
  return hash.digest('hex').slice(0, 8);
}

const contentHash = computeHash(DEST);
const cacheName = `attendance-app-${contentHash}`;

// Inject cache version into www/sw.js
const swPath = path.join(DEST, 'sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');
swContent = swContent.replace(
  /const CACHE_NAME = ['"]attendance-app-[^'"]+['"]/,
  `const CACHE_NAME = '${cacheName}'`
);
fs.writeFileSync(swPath, swContent);

// Inject ?v=<hash> into local CSS/JS references in www/index.html
const htmlPath = path.join(DEST, 'index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');
// Match href/src pointing to local files (starting with css/, js/, assets/, or /)
htmlContent = htmlContent.replace(
  /(href|src)="((?:css|js|assets|sw)[^"]*?)"/g,
  (_, attr, url) => {
    const base = url.split('?')[0];
    return `${attr}="${base}?v=${contentHash}"`;
  }
);
fs.writeFileSync(htmlPath, htmlContent);

console.log(`Cache version: ${cacheName}`);
console.log('Build complete → www/');
