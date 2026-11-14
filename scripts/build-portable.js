/**
 * Builds the single-file standalone Rust Portable executable
 * (`dist/Taptap_<version>_x64-portable.exe`) and stages the NSIS installer
 * (`dist/Taptap_<version>_x64-setup.exe`) alongside it in `dist/` for easy testing.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PKG_JSON = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
const VERSION = PKG_JSON.version || '2.0.0';

function resolveCargoBinDir() {
  if (process.env.CARGO_HOME) {
    return path.join(process.env.CARGO_HOME, 'bin');
  }
  return path.join(os.homedir(), '.cargo', 'bin');
}

function findMinGWBinDirs() {
  if (process.platform !== 'win32') return [];
  const candidates = [];
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const wingetPackagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');

  if (fs.existsSync(wingetPackagesDir)) {
    try {
      for (const entry of fs.readdirSync(wingetPackagesDir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.startsWith('BrechtSanders.WinLibs')) {
          candidates.push(path.join(wingetPackagesDir, entry.name, 'mingw64', 'bin'));
        }
      }
    } catch {
      // Ignore unreadable directories.
    }
  }
  candidates.push('C:\\msys64\\mingw64\\bin', 'C:\\mingw64\\bin');
  return candidates.filter((d) => fs.existsSync(d));
}

function prependToolPaths(extraDirs) {
  const current = (process.env.PATH || process.env.Path || '').split(path.delimiter).filter(Boolean);
  const seen = new Set(current.map((p) => p.toLowerCase()));
  const prefix = [];
  for (const dir of extraDirs) {
    if (fs.existsSync(dir) && !seen.has(dir.toLowerCase())) {
      seen.add(dir.toLowerCase());
      prefix.push(dir);
    }
  }
  if (prefix.length > 0) {
    process.env.PATH = [...prefix, ...current].join(path.delimiter);
  }
}

function findExecutable(name, searchDirs) {
  const exeName = process.platform === 'win32' && !name.endsWith('.exe') ? `${name}.exe` : name;
  for (const dir of searchDirs) {
    const candidate = path.join(dir, exeName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return exeName;
}

function escapeRustPath(p) {
  return p.replace(/\\/g, '/');
}

function main() {
  const cargoBin = resolveCargoBinDir();
  const mingwDirs = findMinGWBinDirs();
  const toolDirs = [cargoBin, ...mingwDirs];
  prependToolPaths(toolDirs);

  const releaseDir = path.join(ROOT_DIR, 'src-tauri', 'target', 'release');
  const appExePath = path.join(releaseDir, 'taptap.exe');
  const loaderDllPath = path.join(releaseDir, 'WebView2Loader.dll');

  if (!fs.existsSync(appExePath)) {
    console.error(`[Taptap Portable] Missing release binary at ${appExePath}. Run \`npm run rust:build\` or \`npm run rust:installer\` first.`);
    process.exit(1);
  }

  const distDir = path.join(ROOT_DIR, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  const portableOut = path.join(distDir, `Taptap_${VERSION}_x64-portable.exe`);

  const nsisSrc = path.join(
    releaseDir,
    'bundle',
    'nsis',
    `Taptap_${VERSION}_x64-setup.exe`
  );
  const nsisDest = path.join(distDir, `Taptap_${VERSION}_x64-setup.exe`);
  if (fs.existsSync(nsisSrc)) {
    fs.copyFileSync(nsisSrc, nsisDest);
    console.log(`[Taptap Portable] Staged NSIS installer -> ${nsisDest}`);
  }

  const appBytes = fs.readFileSync(appExePath);
  const needsExternalLoaderDll = appBytes.includes(Buffer.from('WebView2Loader.dll'));

  // On MSVC toolchains (e.g. GitHub Actions windows-latest), WebView2LoaderStatic.lib is linked
  // statically and all 23 encrypted .tap vaults + icon resources are already embedded in taptap.exe.
  if (!needsExternalLoaderDll) {
    fs.copyFileSync(appExePath, portableOut);
    const portableSizeMB = (fs.statSync(portableOut).size / (1024 * 1024)).toFixed(2);
    console.log(`[Taptap Portable] Static MSVC build detected — standalone Portable EXE ready (${portableSizeMB} MiB): ${portableOut}`);
    return;
  }

  if (!fs.existsSync(loaderDllPath)) {
    console.error(`[Taptap Portable] Missing WebView2Loader.dll at ${loaderDllPath}.`);
    process.exit(1);
  }

  const dllBytes = fs.readFileSync(loaderDllPath);
  const buildHash = crypto
    .createHash('sha256')
    .update(appBytes)
    .update(dllBytes)
    .digest('hex')
    .slice(0, 10);

  // Build temp workspace in OS temp dir (avoids spaces in Windows windres paths)
  const tmpBuildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taptap-portable-'));
  try {
    const stagedExe = path.join(tmpBuildDir, 'taptap_payload.exe');
    const stagedDll = path.join(tmpBuildDir, 'WebView2Loader.dll');
    const stagedIco = path.join(tmpBuildDir, 'icon.ico');
    fs.copyFileSync(appExePath, stagedExe);
    fs.copyFileSync(loaderDllPath, stagedDll);

    const iconSrc = path.join(ROOT_DIR, 'assets', 'icon.ico');
    const linkArgs = [];
    if (fs.existsSync(iconSrc)) {
      fs.copyFileSync(iconSrc, stagedIco);
      const rcPath = path.join(tmpBuildDir, 'portable.rc');
      const resObjPath = path.join(tmpBuildDir, 'portable_icon.o');
      fs.writeFileSync(rcPath, `1 ICON "${escapeRustPath(stagedIco)}"\n`, 'utf8');
      const windres = findExecutable('windres', mingwDirs);
      try {
        execFileSync(windres, [rcPath, '-O', 'coff', '-o', resObjPath], { stdio: 'inherit' });
        if (fs.existsSync(resObjPath)) {
          linkArgs.push('-C', `link-arg=${resObjPath}`);
        }
      } catch (err) {
        console.warn('[Taptap Portable] windres icon embed skipped:', err.message);
      }
    }

    const stubRsPath = path.join(tmpBuildDir, 'portable_launcher.rs');
    const stubSource = `#![windows_subsystem = "windows"]

use std::env;
use std::fs;
use std::io::Write;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;

const APP_BYTES: &[u8] = include_bytes!("${escapeRustPath(stagedExe)}");
const DLL_BYTES: &[u8] = include_bytes!("${escapeRustPath(stagedDll)}");
const RUNTIME_FOLDER: &str = "portable-${VERSION}-${buildHash}";
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn ensure_file(dest: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Ok(meta) = fs::metadata(dest) {
        if meta.len() == bytes.len() as u64 {
            return Ok(());
        }
    }
    let tmp = dest.with_extension("tmp");
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.flush()?;
    }
    let _ = fs::rename(&tmp, dest).or_else(|_| fs::copy(&tmp, dest).map(|_| ()));
    let _ = fs::remove_file(&tmp);
    Ok(())
}

fn runtime_dir() -> PathBuf {
    let base = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir);
    base.join("com.taptap.companion").join(RUNTIME_FOLDER)
}

fn main() {
    let dir = runtime_dir();
    if fs::create_dir_all(&dir).is_err() {
        return;
    }

    let app_dest = dir.join("Taptap.exe");
    let dll_dest = dir.join("WebView2Loader.dll");

    // If Taptap.exe is already running in tray, ensure_file may see a locked binary of matching size (handled above)
    let _ = ensure_file(&dll_dest, DLL_BYTES);
    let _ = ensure_file(&app_dest, APP_BYTES);

    let portable_self = env::current_exe().unwrap_or_else(|_| app_dest.clone());
    let args: Vec<_> = env::args_os().skip(1).collect();

    let _ = Command::new(&app_dest)
        .args(&args)
        .current_dir(&dir)
        .env("TAPTAP_PORTABLE_EXE", &portable_self)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}
`;

    fs.writeFileSync(stubRsPath, stubSource, 'utf8');

    const rustc = findExecutable('rustc', [cargoBin]);
    console.log(`[Taptap Portable] Compiling single-file portable executable -> ${portableOut}`);

    execFileSync(
      rustc,
      [
        '--edition=2021',
        '-C', 'opt-level=3',
        '-C', 'strip=symbols',
        '-C', 'panic=abort',
        ...linkArgs,
        stubRsPath,
        '-o',
        portableOut,
      ],
      { stdio: 'inherit' }
    );

    const portableSizeMB = (fs.statSync(portableOut).size / (1024 * 1024)).toFixed(2);
    console.log(`[Taptap Portable] Success! Portable EXE ready (${portableSizeMB} MiB): ${portableOut}`);
  } finally {
    fs.rmSync(tmpBuildDir, { recursive: true, force: true });
  }
}

main();
