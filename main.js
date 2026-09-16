const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// --- Single Instance Lock (Enforce Exactly 1 Active Instance) ---
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  console.log('[Taptap] Another instance is already running. Quitting redundant instance.');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Focus existing window when a second instance tries to launch
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

// --- Persistent Application Configuration (GPU Acceleration & Performance) ---
function getConfigPath() {
  return path.join(app.getPath('userData'), 'taptap-config.json');
}

function loadAppConfig() {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.warn('[Taptap] Config load error:', e.message);
  }
  return { gpuAcceleration: true, startupLaunch: false };
}

function saveAppConfig(config) {
  try {
    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Taptap] Config save error:', e.message);
  }
}

const appConfig = loadAppConfig();

// --- Robust Windows Startup (Registry & Electron LoginItem Integration) ---
function getAutoStartExecutablePath() {
  if (app.isPackaged) {
    return `"${process.execPath}" --hidden`;
  }
  return `"${process.execPath}" "${path.resolve(__dirname)}" --hidden`;
}

function checkWindowsAutoStart() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      try {
        return resolve(!!app.getLoginItemSettings().openAtLogin);
      } catch (e) {
        return resolve(false);
      }
    }

    exec('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Taptap"', (err, stdout) => {
      if (!err && stdout && stdout.includes('Taptap')) {
        return resolve(true);
      }
      exec('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "electron.app.Taptap"', (err2, stdout2) => {
        if (!err2 && stdout2 && stdout2.includes('Taptap')) {
          return resolve(true);
        }
        try {
          const s = app.getLoginItemSettings();
          resolve(!!s.openAtLogin);
        } catch (e) {
          resolve(!!appConfig.startupLaunch);
        }
      });
    });
  });
}

function setWindowsAutoStart(enable) {
  return new Promise((resolve) => {
    appConfig.startupLaunch = !!enable;
    saveAppConfig(appConfig);

    try {
      app.setLoginItemSettings({
        openAtLogin: !!enable,
        openAsHidden: true,
        path: process.execPath,
        args: ['--hidden']
      });
    } catch (e) {
      console.warn('[Taptap] Electron setLoginItemSettings error:', e.message);
    }

    if (process.platform === 'win32') {
      if (enable) {
        const targetCmd = getAutoStartExecutablePath();
        const regCmd = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Taptap" /t REG_SZ /d "${targetCmd.replace(/"/g, '\\"')}" /f`;
        exec(regCmd, (err) => {
          if (err) {
            console.warn('[Taptap] Registry autostart write error:', err.message);
          } else {
            console.log('[Taptap] Successfully enabled Windows Startup in registry:', targetCmd);
          }
          resolve(true);
        });
      } else {
        const regDel1 = 'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Taptap" /f';
        const regDel2 = 'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "electron.app.Taptap" /f';
        exec(`${regDel1} & ${regDel2}`, () => {
          console.log('[Taptap] Successfully disabled Windows Startup in registry.');
          resolve(false);
        });
      }
    } else {
      resolve(!!enable);
    }
  });
}

// Prevent background audio latency and timer throttling when typing in other apps
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Apply GPU Hardware Acceleration based on user configuration
if (appConfig.gpuAcceleration === false) {
  app.disableHardwareAcceleration();
  console.log('[Taptap] GPU Hardware Acceleration disabled by user setting.');
} else {
  // High-performance GPU rasterization flags for silky 60/120/144+ FPS rendering
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  console.log('[Taptap] GPU Hardware Acceleration active (60/120/144+ FPS mode).');
}

let mainWindow = null;
let tray = null;
let isTrayMode = false;
app.isQuitting = false;

// Global background keyboard & mouse input hook via uiohook-napi
let uIOhook = null;
let UiohookKey = null;
try {
  const uio = require('uiohook-napi');
  uIOhook = uio.uIOhook;
  UiohookKey = uio.UiohookKey;
} catch (e) {
  console.warn('[Taptap] uiohook-napi load notice:', e.message);
}

function buildUiohookKeyMap(uKeys) {
  if (!uKeys) return {};
  const map = {};
  for (const [name, code] of Object.entries(uKeys)) {
    if (name.length === 1 && name >= 'A' && name <= 'Z') {
      map[code] = `Key${name}`;
    } else if (name.length === 1 && name >= '0' && name <= '9') {
      map[code] = `Digit${name}`;
    } else if (name === 'Shift' || name === 'ShiftLeft') {
      map[code] = 'ShiftLeft';
    } else if (name === 'ShiftRight') {
      map[code] = 'ShiftRight';
    } else if (name === 'Ctrl' || name === 'CtrlLeft' || name === 'ControlLeft') {
      map[code] = 'ControlLeft';
    } else if (name === 'CtrlRight' || name === 'ControlRight') {
      map[code] = 'ControlRight';
    } else if (name === 'Alt' || name === 'AltLeft') {
      map[code] = 'AltLeft';
    } else if (name === 'AltRight') {
      map[code] = 'AltRight';
    } else if (name === 'Meta' || name === 'MetaLeft') {
      map[code] = 'MetaLeft';
    } else if (name === 'MetaRight') {
      map[code] = 'MetaRight';
    } else if (name === 'Return') {
      map[code] = 'Enter';
    } else if (name === 'Grave' || name === 'Tilde') {
      map[code] = 'Backquote';
    } else {
      map[code] = name;
    }
  }
  return map;
}

function getTrayIcon() {
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  const pngPath = path.join(__dirname, 'assets', 'icon.png');
  if (process.platform === 'win32' && fs.existsSync(icoPath)) {
    return nativeImage.createFromPath(icoPath);
  } else if (fs.existsSync(pngPath)) {
    return nativeImage.createFromPath(pngPath).resize({ width: 16, height: 16 });
  }
  return nativeImage.createEmpty();
}

function createTray() {
  const icon = getTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Taptap — Spatial Acoustic Companion');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Taptap',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: 'separator' },
    {
      label: 'Mute / Unmute (Ctrl+Shift+M)',
      click: () => {
        mainWindow.webContents.send('toggle-mute');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Taptap',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  const isSilentStartup = process.argv.includes('--hidden') ||
    (app.getLoginItemSettings && app.getLoginItemSettings().wasOpenedAsHidden);

  mainWindow = new BrowserWindow({
    width: 440,
    height: 605,
    minWidth: 440,
    minHeight: 480,
    maxWidth: 900,
    maxHeight: 950,
    icon: process.platform === 'win32'
      ? path.join(__dirname, 'assets', 'icon.ico')
      : path.join(__dirname, 'assets', 'icon.png'),
    resizable: true,
    show: !isSilentStartup,
    frame: false, // Clean frameless minimalist aesthetic
    transparent: false,
    backgroundColor: '#fbf8f2',
    hasShadow: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false // Continuous audio playback in background
    }
  });

  mainWindow.loadFile('app.html');

  // Intercept window close: hide to system tray instead of exiting
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Notify renderer when window is hidden or shown to pause/resume rendering loops
  mainWindow.on('hide', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-visibility', false);
    }
  });

  mainWindow.on('show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-visibility', true);
    }
  });

  mainWindow.on('minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-visibility', false);
    }
  });

  mainWindow.on('restore', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-visibility', true);
    }
  });

  // Windows window controls
  ipcMain.on('window-close', () => {
    if (!app.isQuitting) {
      mainWindow.hide();
    } else {
      mainWindow.close();
    }
  });

  // Minimize directly to system tray for true stealth mode and lowest hardware consumption
  ipcMain.on('window-minimize', () => {
    mainWindow.hide();
  });

  ipcMain.on('theme-changed', (event, theme) => {
    if (mainWindow) {
      mainWindow.setBackgroundColor(theme === 'dark' ? '#1e0f14' : '#fbf8f2');
    }
  });

  ipcMain.on('update-tray-status', (event, { soundpack, isMuted }) => {
    if (tray) {
      const muteStr = isMuted ? ' • Muted' : '';
      const packStr = soundpack ? ` — ${soundpack}` : '';
      tray.setToolTip(`Taptap${packStr}${muteStr} (Stealth Mode)`);
    }
  });

  // GPU Hardware Acceleration Status & Settings
  ipcMain.handle('get-gpu-status', () => {
    return appConfig.gpuAcceleration !== false;
  });

  ipcMain.handle('set-gpu-status', (event, enabled) => {
    appConfig.gpuAcceleration = !!enabled;
    saveAppConfig(appConfig);
    return appConfig.gpuAcceleration;
  });

  // Smooth App Restart Trigger
  ipcMain.on('restart-app', () => {
    app.relaunch();
    app.exit(0);
  });

  // Windows Startup & Login Item Settings
  ipcMain.handle('get-startup-status', async () => {
    return await checkWindowsAutoStart();
  });

  ipcMain.handle('set-startup-status', async (event, enable) => {
    return await setWindowsAutoStart(enable);
  });

  // High-performance direct window resize (zero DWM swapchain tearing, 60/120/144+ FPS)
  ipcMain.on('resize-window', (event, { targetWidth, targetHeight }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [startW, startH] = mainWindow.getSize();
    if (startW === targetWidth && startH === targetHeight) return;
    mainWindow.setSize(targetWidth, targetHeight);
  });

  // Open external URL in user's default web browser
  ipcMain.on('open-external-url', (event, url) => {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
  createWindow();
  createTray();

  // If user has enabled startup launch, verify and sync registry path on launch
  if (appConfig.startupLaunch) {
    setWindowsAutoStart(true).catch(() => {});
  }

  // Register Global Shortcut for stealth mute/unmute
  try {
    globalShortcut.register('CommandOrControl+Shift+M', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('toggle-mute');
      }
    });
  } catch (e) {
    console.log('Global shortcut registration failed:', e);
  }

  // Start Global Background Keyboard & Mouse Hook
  if (uIOhook && UiohookKey) {
    const keyMap = buildUiohookKeyMap(UiohookKey);

    uIOhook.on('keydown', (e) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const code = keyMap[e.keycode] || 'KeyA';
        mainWindow.webContents.send('global-keydown', { code });
      }
    });

    uIOhook.on('keyup', (e) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const code = keyMap[e.keycode] || 'KeyA';
        mainWindow.webContents.send('global-keyup', { code });
      }
    });

    uIOhook.on('mousedown', (e) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        let code = 'MouseLeft';
        if (e.button === 2) code = 'MouseRight';
        else if (e.button === 3) code = 'MouseMiddle';
        mainWindow.webContents.send('global-mousedown', { code, x: e.x, y: e.y });
      }
    });

    uIOhook.on('mouseup', (e) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        let code = 'MouseLeft';
        if (e.button === 2) code = 'MouseRight';
        else if (e.button === 3) code = 'MouseMiddle';
        mainWindow.webContents.send('global-mouseup', { code });
      }
    });

    try {
      uIOhook.start();
      console.log('[Taptap] Global background keyboard & mouse hook started successfully!');
    } catch (err) {
      console.warn('[Taptap] uIOhook start notice:', err.message);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (uIOhook) {
    try {
      uIOhook.stop();
    } catch (e) { }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // If tray is active, keep running in background
    if (!tray) {
      app.quit();
    }
  }
});
