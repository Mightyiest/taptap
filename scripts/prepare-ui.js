/**
 * Prepares the minimal frontend distribution directory (`ui-dist/`) for Tauri.
 * Copies only the active companion UI files and brand icons, keeping `node_modules/`,
 * `src-tauri/target/`, and `assets/vault/*.tap` out of the compiled WebView asset bundle.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const UI_DIST = path.join(ROOT_DIR, 'ui-dist');

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function prepareUi() {
  fs.rmSync(UI_DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(UI_DIST, 'assets'), { recursive: true });

  const appHtmlSrc = path.join(ROOT_DIR, 'app.html');
  fs.copyFileSync(appHtmlSrc, path.join(UI_DIST, 'app.html'));
  fs.copyFileSync(appHtmlSrc, path.join(UI_DIST, 'index.html'));

  const topFiles = ['styles.css', 'audio-engine.js', 'app.js'];
  for (const file of topFiles) {
    fs.copyFileSync(path.join(ROOT_DIR, file), path.join(UI_DIST, file));
  }

  for (const icon of ['icon.png', 'icon.ico']) {
    const src = path.join(ROOT_DIR, 'assets', icon);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(UI_DIST, 'assets', icon));
    }
  }

  copyDirRecursive(
    path.join(ROOT_DIR, 'assets', 'brands'),
    path.join(UI_DIST, 'assets', 'brands')
  );

  console.log('[Taptap UI] Prepared minimal ui-dist/ bundle for Tauri.');
}

prepareUi();
