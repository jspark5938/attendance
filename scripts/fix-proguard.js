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

// Fix: Credential Manager requires Activity context, not Application context
// getContext() returns Application context in Capacitor → Credential Manager never calls back → infinite loading
const credentialManagerFix = {
  file: 'node_modules/@capacitor-firebase/authentication/android/src/main/java/io/capawesome/capacitorjs/plugins/firebase/authentication/handlers/GoogleAuthProviderHandler.java',
  from: 'credentialManager.getCredentialAsync(\n                pluginImplementation.getPlugin().getContext(),',
  to:   'credentialManager.getCredentialAsync(\n                pluginImplementation.getPlugin().getActivity(),',
};

const cmPath = path.join(__dirname, '..', credentialManagerFix.file);
if (fs.existsSync(cmPath)) {
  let content = fs.readFileSync(cmPath, 'utf8');
  if (content.includes(credentialManagerFix.from)) {
    content = content.replace(credentialManagerFix.from, credentialManagerFix.to);
    fs.writeFileSync(cmPath, content);
    console.log('Fixed: GoogleAuthProviderHandler.java (getContext → getActivity)');
  } else if (content.includes(credentialManagerFix.to)) {
    console.log('Already patched: GoogleAuthProviderHandler.java');
  } else {
    console.warn('WARNING: GoogleAuthProviderHandler.java patch target not found — manual check required');
  }
}
