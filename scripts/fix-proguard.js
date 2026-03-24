const fs = require('fs');
const path = require('path');

const files = [
  'node_modules/@capacitor-community/admob/android/build.gradle',
];

for (const file of files) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes("proguard-android.txt'")) {
    content = content.replace(/proguard-android\.txt'/g, "proguard-android-optimize.txt'");
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${file}`);
  }
}
