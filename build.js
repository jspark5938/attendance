/**
 * Build script: copies web assets into www/ for Capacitor
 */
const fs = require('fs');
const path = require('path');

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

console.log('Build complete → www/');
