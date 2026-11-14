/**
 * Executes `cargo` with automatic toolchain PATH discovery.
 * Ensures newly installed Cargo and WinLibs MinGW directories work inside
 * existing IDE terminals whose inherited PATH has not yet refreshed.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function resolveCargoBinDir() {
  if (process.env.CARGO_HOME) {
    return path.join(process.env.CARGO_HOME, 'bin');
  }
  return path.join(os.homedir(), '.cargo', 'bin');
}

function findMinGWBinDirs() {
  if (process.platform !== 'win32') return [];

  const candidates = [];
  const localAppData =
    process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const wingetPackagesDir = path.join(
    localAppData,
    'Microsoft',
    'WinGet',
    'Packages'
  );

  if (fs.existsSync(wingetPackagesDir)) {
    try {
      for (const entry of fs.readdirSync(wingetPackagesDir, {
        withFileTypes: true,
      })) {
        if (entry.isDirectory() && entry.name.startsWith('BrechtSanders.WinLibs')) {
          candidates.push(path.join(wingetPackagesDir, entry.name, 'mingw64', 'bin'));
        }
      }
    } catch {
      // Ignore unreadable WinGet package directories and continue to fallbacks.
    }
  }

  candidates.push('C:\\msys64\\mingw64\\bin', 'C:\\mingw64\\bin');
  return candidates;
}

function prependExistingToolPaths(extraDirs) {
  const currentPath = process.env.PATH || process.env.Path || '';
  const currentEntries = currentPath.split(path.delimiter).filter(Boolean);
  const normalize = (p) =>
    process.platform === 'win32' ? p.toLowerCase() : p;
  const seen = new Set(currentEntries.map(normalize));

  const additions = [];
  for (const dir of extraDirs) {
    if (!dir || !fs.existsSync(dir)) continue;
    const key = normalize(dir);
    if (!seen.has(key)) {
      seen.add(key);
      additions.push(dir);
    }
  }

  if (additions.length > 0) {
    process.env.PATH = [...additions, ...currentEntries].join(path.delimiter);
  }
}

function main() {
  const cargoBin = resolveCargoBinDir();
  const extraDirs = [cargoBin, ...findMinGWBinDirs()];
  prependExistingToolPaths(extraDirs);

  const args = process.argv.slice(2);
  let cmdExe;
  let cmdArgs;

  if (args[0] === '--tauri') {
    const tauriEntry = path.resolve(
      __dirname,
      '..',
      'node_modules',
      '@tauri-apps',
      'cli',
      'tauri.js'
    );
    if (!fs.existsSync(tauriEntry)) {
      console.error(
        `[Taptap Rust] @tauri-apps/cli not found at "${tauriEntry}". Run \`npm install\` first.`
      );
      process.exit(1);
    }
    cmdExe = process.execPath;
    cmdArgs = [tauriEntry, ...args.slice(1)];
  } else {
    const cargoCandidate = path.join(
      cargoBin,
      process.platform === 'win32' ? 'cargo.exe' : 'cargo'
    );
    cmdExe = fs.existsSync(cargoCandidate) ? cargoCandidate : 'cargo';
    cmdArgs = args;
  }

  const child = spawn(cmdExe, cmdArgs, {
    stdio: 'inherit',
    windowsHide: false,
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      try {
        child.kill(signal);
      } catch {
        // Ignore if child already exited.
      }
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('error', (err) => {
    console.error(
      `[Taptap Rust] Failed to launch "${cmdExe}": ${err.message}`
    );
    console.error(
      '[Taptap Rust] Install Rust via rustup or verify Cargo is on your PATH.'
    );
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });
}

main();
