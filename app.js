/**
 * Taptap — Apple Edition Frontend Controller
 * Manages:
 * - Lofree Flow 2 Soundpack loading & playback (Pulse, Surfer, Void)
 * - Horizontal Scroll-Snap Page Synchronization
 * - Light / Dark Theme switching
 * - Apple-style Minimalist Soundstage Radar
 * - Compact ANSI Keyboard Matrix with Keydown & Keyup (Upstroke) support
 */

document.addEventListener('DOMContentLoaded', () => {
  // Audio Engine instance
  const audio = window.TaptapAudio;

  // Detect Electron or Tauri native desktop environment
  const isElectron = !!(window.process && window.process.versions && window.process.versions.electron) ||
    navigator.userAgent.toLowerCase().includes('electron');
  const isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI__);
  if (isElectron || isTauri) {
    document.body.classList.add('is-electron');
  }
  if (isTauri) {
    document.body.classList.add('is-tauri');
  }

  function tauriInvoke(cmd, args = {}) {
    if (!isTauri) return Promise.resolve(null);
    try {
      if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        return window.__TAURI__.core.invoke(cmd, args);
      }
      if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
        return window.__TAURI_INTERNALS__.invoke(cmd, args);
      }
    } catch (e) { }
    return Promise.resolve(null);
  }

  function tauriListen(eventName, handler) {
    if (!isTauri) return;
    if (window.__TAURI__ && window.__TAURI__.event && typeof window.__TAURI__.event.listen === 'function') {
      window.__TAURI__.event.listen(eventName, handler).catch(() => { });
    }
  }

  // Ensure AudioContext is awakened immediately on first user gesture in web browsers
  const wakeAudioOnFirstGesture = () => {
    if (audio && !isTauri) {
      audio.initContext();
      if (audio.ctx && audio.ctx.state === 'suspended') {
        audio.ctx.resume();
      }
    }
  };
  window.addEventListener('pointerdown', wakeAudioOnFirstGesture, { once: true, passive: true });
  window.addEventListener('keydown', wakeAudioOnFirstGesture, { once: true, passive: true });

  // Setup Electron IPC if available
  let ipc = null;
  if (window.require) {
    try {
      ipc = window.require('electron').ipcRenderer;
    } catch (e) { }
  }

  // Frameless window dragging for Tauri
  const winHeader = document.querySelector('.window-header');
  if (winHeader && isTauri) {
    winHeader.addEventListener('mousedown', (e) => {
      if (e.button === 0 && !e.target.closest('.header-brand, .header-controls, button, a, input, select')) {
        tauriInvoke('start_drag_window');
      }
    });
  }

  // Windows Window Controls (Minimize & Close)
  const winMinimize = document.getElementById('winMinimize');
  const winClose = document.getElementById('winClose');
  if (winMinimize) {
    winMinimize.addEventListener('click', () => {
      // Minimize directly to system tray for true stealth mode and lowest hardware consumption
      if (ipc) ipc.send('window-minimize');
      else if (isTauri) tauriInvoke('close_to_tray');
    });
  }
  if (winClose) {
    winClose.addEventListener('click', () => {
      if (ipc) ipc.send('window-close');
      else if (isTauri) tauriInvoke('close_to_tray');
    });
  }

  // --- STEALTH MODE & WINDOW VISIBILITY TRACKING ---
  let isWindowVisible = true;
  if (ipc) {
    ipc.on('window-visibility', (event, visible) => {
      isWindowVisible = visible;
      if (!visible && isRadarAnimating) {
        isRadarAnimating = false;
        ripples.length = 0;
      }
    });
  }
  tauriListen('window-visibility', (event) => {
    const visible = !!event.payload;
    isWindowVisible = visible;
    if (!visible && isRadarAnimating) {
      isRadarAnimating = false;
      ripples.length = 0;
    }
  });
  document.addEventListener('visibilitychange', () => {
    isWindowVisible = !document.hidden;
    if (document.hidden && isRadarAnimating) {
      isRadarAnimating = false;
      ripples.length = 0;
    }
  });

  function updateTrayStatus() {
    const swList = window.TaptapSwitches || [];
    const sw = swList.find(s => s.id === audio.activeKeyboardPack);
    const pack = sw ? sw.name : (audio.activeKeyboardPack || 'Lofree Flow 2 (Pulse)');
    if (ipc) {
      ipc.send('update-tray-status', { soundpack: pack, isMuted: audio.isMuted });
    } else if (isTauri) {
      tauriInvoke('update_tray_status', { soundpack: pack, isMuted: !!audio.isMuted });
    }
  }

  // --- DOM Elements ---
  const carousel = document.getElementById('carouselViewport');
  const navTabs = document.querySelectorAll('.nav-tab');
  const pageDots = document.querySelectorAll('.page-dot');
  const btnTheme = document.getElementById('btnTheme');
  const btnMute = document.getElementById('btnMute');
  const muteIcon = document.getElementById('muteIcon');
  const stageReadout = document.getElementById('stageReadout');
  const radarCanvas = document.getElementById('radarCanvas');
  const radarCtx = radarCanvas.getContext('2d');

  // Sliders
  const rngWidth = document.getElementById('rngWidth');
  const txtWidth = document.getElementById('txtWidth');
  const rngKbVolume = document.getElementById('rngKbVolume');
  const txtKbVolume = document.getElementById('txtKbVolume');
  const rngMouseVolume = document.getElementById('rngMouseVolume');
  const txtMouseVolume = document.getElementById('txtMouseVolume');
  const rngJitter = document.getElementById('rngJitter');
  const txtJitter = document.getElementById('txtJitter');

  // Separate Keyboard & Mouse Mute Controls
  const btnMuteKeyboard = document.getElementById('btnMuteKeyboard');
  const txtMuteKb = document.getElementById('txtMuteKb');
  const chkKeyboardAudioActive = document.getElementById('chkKeyboardAudioActive');
  const btnMuteMouse = document.getElementById('btnMuteMouse');
  const txtMuteMouse = document.getElementById('txtMuteMouse');
  const chkMouseAudioActive = document.getElementById('chkMouseAudioActive');

  // Cute Switch Picker Elements
  const switchPickerModal = document.getElementById('switchPickerModal');
  const btnOpenSwitchPicker0 = document.getElementById('btnOpenSwitchPicker0');
  const btnOpenSwitchPicker1 = document.getElementById('btnOpenSwitchPicker1');
  const btnSwitchPickerClose = document.getElementById('btnSwitchPickerClose');
  const inputSwitchSearch = document.getElementById('inputSwitchSearch');
  const btnSearchClear = document.getElementById('btnSearchClear');
  const pickerSwitchGrid = document.getElementById('pickerSwitchGrid');
  const pickerCountLabel = document.getElementById('pickerCountLabel');
  const categoryChips = document.querySelectorAll('.category-chip');
  const switchFavoritesRow0 = document.getElementById('switchFavoritesRow0');
  const switchFavoritesRow1 = document.getElementById('switchFavoritesRow1');

  // Mouse Soundpack & Settings
  const selMousePack = document.getElementById('selMousePack');
  const selMousePackQuick = document.getElementById('selMousePackQuick');
  const infoPackName = document.getElementById('infoPackName');
  const infoMousePackName = document.getElementById('infoMousePackName');
  const chkUpstroke = document.getElementById('chkUpstroke');
  const chkMouseUpstroke = document.getElementById('chkMouseUpstroke');
  const chkCursorTracking = document.getElementById('chkCursorTracking');
  const chkElevation = document.getElementById('chkElevation');
  const chkRightClickMenu = document.getElementById('chkRightClickMenu');
  const modeOpts = document.querySelectorAll('.mode-opt');

  // Right-click context menu ("Inspect Element") is disabled by default unless enabled in Settings
  let rightClickMenuEnabled = false;
  window.addEventListener('contextmenu', (e) => {
    if (!rightClickMenuEnabled) {
      e.preventDefault();
    }
  }, true);

  // Mouse Pills & Readout
  const mouseClickReadout = document.getElementById('mouseClickReadout');
  const mBtnLeft = document.getElementById('mBtnLeft');
  const mBtnLeftAlt = document.getElementById('mBtnLeftAlt');
  const mBtnMid = document.getElementById('mBtnMid');
  const mBtnMidAlt = document.getElementById('mBtnMidAlt');
  const mBtnRight = document.getElementById('mBtnRight');
  const mBtnRightAlt = document.getElementById('mBtnRightAlt');
  const hiddenGameInput = document.getElementById('hiddenGameInput');

  // About Modal Elements
  const aboutModal = document.getElementById('aboutModal');
  const btnAbout = document.getElementById('btnAbout');
  const btnBrandAbout = document.getElementById('btnBrandAbout');
  const btnSettingsAbout = document.getElementById('btnSettingsAbout');
  const btnAboutClose = document.getElementById('btnAboutClose');
  const linkGithub = document.getElementById('linkGithub');

  // Keyboard layout elements & state
  const keyboardContainer = document.getElementById('keyboardContainer');
  const selKeyboardLayout = document.getElementById('selKeyboardLayout');
  const selSettingsKeyboardLayout = document.getElementById('selSettingsKeyboardLayout');
  const lblKeyboardMatrixTitle = document.getElementById('lblKeyboardMatrixTitle');
  const lblSelectedLayoutDesc = document.getElementById('lblSelectedLayoutDesc');
  let currentLayoutId = localStorage.getItem('taptap-keyboard-layout') || 'ansi-68';

  // Quick Switch Favorites State (Persisted)
  let favoriteSwitches = ['pulse', 'drop-holy-panda', 'kailh-box-navy'];
  let currentCategory = 'all';
  let currentSearchQuery = '';

  function getSwitchData(id) {
    const list = window.TaptapSwitches || [];
    return list.find(s => s.id === id) || {
      id: id || 'pulse',
      name: id ? id.replace(/-/g, ' ') : 'Lofree Flow 2 (Pulse)',
      brand: 'lofree',
      brandName: 'Lofree',
      brandIcon: 'assets/brands/lofree.png',
      feel: 'Smooth POM',
      category: 'linear',
      tag: 'Linear',
      sound: 'Creamy Thock'
    };
  }

  function updateActiveSwitchUI(switchId) {
    const sw = getSwitchData(switchId);
    ['0', '1'].forEach(idx => {
      const avatar = document.getElementById(`activeSwitchAvatar${idx}`);
      const name = document.getElementById(`activeSwitchName${idx}`);
      const badge = document.getElementById(`activeSwitchBadge${idx}`);
      const sub = document.getElementById(`activeSwitchSub${idx}`);
      if (avatar) {
        avatar.innerHTML = `<img class="active-brand-img" src="${sw.brandIcon}" width="30" height="30" style="width:100%;height:100%;max-width:30px;max-height:30px;object-fit:contain;display:block;" alt="${sw.brandName || sw.name}" onerror="this.outerHTML='<span style=\\'font-weight:700;font-size:0.9rem;\\'>${(sw.brandName || 'S')[0]}</span>';">`;
      }
      if (name) name.textContent = sw.name;
      if (badge) badge.textContent = sw.tag || 'Linear';
      if (sub) sub.textContent = `${sw.brandName || sw.name} • ${sw.sound}`;
    });
    if (infoPackName) infoPackName.textContent = sw.name;

    // Update active state on favorite pills
    document.querySelectorAll('.fav-switch-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.switch === switchId);
    });

    // Update active state on modal items
    document.querySelectorAll('.switch-item-card').forEach(card => {
      const isActive = card.dataset.id === switchId;
      card.classList.toggle('active', isActive);
    });
  }

  function renderFavoritePills() {
    const rows = [switchFavoritesRow0, switchFavoritesRow1].filter(Boolean);
    rows.forEach(row => {
      row.innerHTML = '';
      favoriteSwitches.forEach(favId => {
        const sw = getSwitchData(favId);
        const pill = document.createElement('button');
        pill.className = `fav-switch-pill ${favId === (audio?.activeKeyboardPack || 'pulse') ? 'active' : ''}`;
        pill.dataset.switch = favId;
        pill.title = `${sw.name} (${sw.feel})`;
        pill.innerHTML = `<img class="fav-brand-icon" src="${sw.brandIcon}" width="16" height="16" style="width:16px;height:16px;max-width:16px;max-height:16px;min-width:16px;min-height:16px;object-fit:contain;border-radius:3px;background:#ffffff;padding:1px;flex-shrink:0;display:block;" alt="${sw.brandName || sw.name}" onerror="this.style.display='none'"><span>${sw.name.replace('Lofree Flow 2 ', '')}</span>`;
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          selectKeyboardSwitch(favId);
        });
        row.appendChild(pill);
      });
    });
  }

  function saveFavorites() {
    try {
      localStorage.setItem('taptap-favorite-switches', JSON.stringify(favoriteSwitches));
    } catch (e) { }
    if (isTauri) {
      tauriInvoke('save_ui_prefs', { args: { favoriteSwitches } });
    }
    renderFavoritePills();
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem('taptap-favorite-switches');
      if (raw) {
        const parsed = JSON.parse(raw);
        const allSwitches = window.TaptapSwitches || [];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(id => allSwitches.some(s => s.id === id));
          if (valid.length > 0) {
            favoriteSwitches = valid;
          }
        }
      }
    } catch (e) { }
  }


  function updateMasterMuteUI(isMuted) {
    if (btnMute) btnMute.style.color = isMuted ? 'var(--text-tertiary)' : 'var(--text-secondary)';
    if (muteIcon) {
      muteIcon.innerHTML = isMuted
        ? '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>'
        : '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
    }
  }

  function focusTypingSurface() {
    try {
      window.focus();
    } catch (e) { }
    if (hiddenGameInput) {
      try {
        hiddenGameInput.focus({ preventScroll: true });
      } catch (e) {
        hiddenGameInput.focus();
      }
    }
  }

  if (hiddenGameInput) {
    hiddenGameInput.addEventListener('input', () => {
      hiddenGameInput.value = '';
    });
  }

  // Prevent sticky focus on controls so Space/Enter/Arrow keys never hijack typing
  document.addEventListener('change', (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.matches('select, input[type="checkbox"], input[type="range"]')) {
      target.blur();
    }
  });
  document.addEventListener('pointerup', (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.matches('input[type="range"]')) {
      target.blur();
    }
  });
  document.addEventListener('mouseup', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('button') : null;
    if (btn && !btn.closest('#switchPickerModal')) {
      btn.blur();
    }
  });

  // --- PERSISTENCE: SAVE & RESTORE AUDIO SETTINGS ---
  let saveSettingsTimer = null;
  function scheduleSaveSettings() {
    clearTimeout(saveSettingsTimer);
    saveSettingsTimer = setTimeout(saveSettings, 180);
  }

  function saveSettings() {
    clearTimeout(saveSettingsTimer);
    if (!audio) return;
    const settings = {
      keyboardVolume: rngKbVolume ? parseInt(rngKbVolume.value, 10) : 85,
      mouseVolume: rngMouseVolume ? parseInt(rngMouseVolume.value, 10) : 85,
      stereoWidth: rngWidth ? parseInt(rngWidth.value, 10) : 100,
      pitchJitter: rngJitter ? parseInt(rngJitter.value, 10) : 25,
      keyboardMuted: audio.keyboardMuted,
      mouseMuted: audio.mouseMuted,
      masterMuted: audio.isMuted,
      activeKeyboardPack: audio.activeKeyboardPack || 'pulse',
      activeMousePack: audio.activeMousePack || 'Bloody V8',
      playUpstrokes: chkUpstroke ? chkUpstroke.checked : true,
      playMouseUpstrokes: chkMouseUpstroke ? chkMouseUpstroke.checked : true,
      dynamicCursorTracking: chkCursorTracking ? chkCursorTracking.checked : true,
      verticalElevation: chkElevation ? chkElevation.checked : true,
      spatialMode: audio.mode || 'hrtf',
      keyboardLayout: currentLayoutId || 'ansi-68',
      rightClickMenu: rightClickMenuEnabled
    };
    try {
      localStorage.setItem('taptap-audio-settings', JSON.stringify(settings));
    } catch (e) { }
    if (isTauri) {
      audio.syncNativeConfig();
    }
  }

  function loadSettings() {
    let settings = null;
    try {
      const raw = localStorage.getItem('taptap-audio-settings');
      if (raw) settings = JSON.parse(raw);
    } catch (e) { }

    if (!settings) settings = {};

    // 0. Physical Keyboard Layout
    const kbLayout = settings.keyboardLayout || localStorage.getItem('taptap-keyboard-layout') || 'ansi-68';
    currentLayoutId = kbLayout;

    // 1. Keyboard Volume
    const kbVol = (typeof settings.keyboardVolume === 'number') ? settings.keyboardVolume : 85;
    if (rngKbVolume) rngKbVolume.value = kbVol;
    if (txtKbVolume) txtKbVolume.textContent = `${kbVol}%`;
    if (audio) audio.setKeyboardVolume(kbVol / 100);

    // 2. Mouse Volume
    const mVol = (typeof settings.mouseVolume === 'number') ? settings.mouseVolume : 85;
    if (rngMouseVolume) rngMouseVolume.value = mVol;
    if (txtMouseVolume) txtMouseVolume.textContent = `${mVol}%`;
    if (audio) audio.setMouseVolume(mVol / 100);

    // 3. Stereo Width
    const width = (typeof settings.stereoWidth === 'number') ? settings.stereoWidth : 100;
    if (rngWidth) rngWidth.value = width;
    if (txtWidth) txtWidth.textContent = `${width}%`;
    if (audio) audio.setStereoWidth(width / 100);

    // 4. Pitch Jitter
    const jitter = (typeof settings.pitchJitter === 'number') ? settings.pitchJitter : 25;
    if (rngJitter) rngJitter.value = jitter;
    if (txtJitter) txtJitter.textContent = `±${(jitter / 10).toFixed(1)}%`;
    if (audio) audio.setPitchJitter(jitter / 1000);

    // 5. Upstrokes
    const upstrokes = (typeof settings.playUpstrokes === 'boolean') ? settings.playUpstrokes : true;
    if (chkUpstroke) chkUpstroke.checked = upstrokes;
    if (audio) audio.setUpstrokes(upstrokes);

    const mouseUpstrokes = (typeof settings.playMouseUpstrokes === 'boolean') ? settings.playMouseUpstrokes : true;
    if (chkMouseUpstroke) chkMouseUpstroke.checked = mouseUpstrokes;
    if (audio) audio.setMouseUpstrokes(mouseUpstrokes);

    // 6. Cursor Tracking
    const cursorTrk = (typeof settings.dynamicCursorTracking === 'boolean') ? settings.dynamicCursorTracking : true;
    if (chkCursorTracking) chkCursorTracking.checked = cursorTrk;
    if (audio) audio.setDynamicCursorTracking(cursorTrk);

    // 7. Elevation
    const elevation = (typeof settings.verticalElevation === 'boolean') ? settings.verticalElevation : true;
    if (chkElevation) chkElevation.checked = elevation;
    if (audio) audio.setVerticalElevation(elevation);

    // 8. Spatial Mode
    const sMode = settings.spatialMode || 'hrtf';
    if (modeOpts) {
      modeOpts.forEach(opt => {
        opt.classList.toggle('active', opt.dataset.mode === sMode);
      });
    }
    if (audio) audio.setMode(sMode);

    // 9. Keyboard & Mouse Mutes
    if (typeof settings.keyboardMuted === 'boolean') {
      updateKeyboardMuteState(settings.keyboardMuted, false);
    }
    if (typeof settings.mouseMuted === 'boolean') {
      updateMouseMuteState(settings.mouseMuted, false);
    }
    if (typeof settings.masterMuted === 'boolean' && audio) {
      audio.setMuted(settings.masterMuted);
      updateMasterMuteUI(settings.masterMuted);
    }

    // 9b. App Right-Click Context Menu
    rightClickMenuEnabled = (typeof settings.rightClickMenu === 'boolean') ? settings.rightClickMenu : false;
    if (chkRightClickMenu) chkRightClickMenu.checked = rightClickMenuEnabled;

    // 10. Load favorites & soundpacks
    loadFavorites();
    renderFavoritePills();

    const kbPack = settings.activeKeyboardPack || 'pulse';
    updateActiveSwitchUI(kbPack);
    if (audio) {
      audio.loadKeyboardPack(kbPack)
        .then(() => {
          console.log(`[Taptap] Restored ${kbPack} keyboard pack`);
          updateActiveSwitchUI(kbPack);
        })
        .catch(err => console.warn('[Taptap] Failed to load pack:', err));
    }

    const mPack = settings.activeMousePack || 'Bloody V8';
    if (selMousePack) selMousePack.value = mPack;
    if (selMousePackQuick) selMousePackQuick.value = mPack;
    if (infoMousePackName) infoMousePackName.textContent = mPack;
    if (audio) {
      audio.loadMousePack(mPack)
        .then(() => console.log(`[Taptap] Restored ${mPack} mouse pack`))
        .catch(err => console.warn('[Taptap] Failed to load mouse pack:', err));
    }
  }

  // Apply settings immediately on startup
  loadSettings();

  // --- 1. HORIZONTAL SCROLL-SNAP SYNCHRONIZATION (Fixed Companion Window) ---
  let currentPage = 0;
  let programmaticLockUntil = 0;
  let programmaticScrollTimer = null;

  function lockProgrammaticScroll(ms) {
    const deadline = performance.now() + ms;
    programmaticLockUntil = Math.max(programmaticLockUntil, deadline);
    clearTimeout(programmaticScrollTimer);
    const delay = Math.max(0, Math.ceil(programmaticLockUntil - performance.now()));
    programmaticScrollTimer = setTimeout(() => {
      if (performance.now() < programmaticLockUntil) return;
      if (carousel && carousel.clientWidth) {
        carousel.scrollTo({
          left: currentPage * carousel.clientWidth,
          behavior: 'instant'
        });
      }
    }, delay);
  }

  function isProgrammaticScrollLocked() {
    return performance.now() < programmaticLockUntil;
  }

  function goToPage(index, fromScroll = false) {
    if (index < 0 || index >= navTabs.length) return;
    currentPage = index;

    lockProgrammaticScroll(180);

    // Reset vertical scroll of target page so top controls are immediately visible
    const targetPage = document.getElementById(`page${index}`);
    if (targetPage) {
      targetPage.scrollTop = 0;
    }

    updateNavIndicators(index);

    if (!fromScroll && carousel && carousel.clientWidth) {
      carousel.scrollTo({
        left: index * carousel.clientWidth,
        behavior: 'smooth'
      });
    }

    if (index === 0) {
      resizeRadar(false);
    } else if (index === 1 && !switchPickerModal?.classList.contains('open') && !aboutModal?.classList.contains('open')) {
      focusTypingSurface();
    }
  }

  function updateNavIndicators(index) {
    navTabs.forEach((tab, i) => tab.classList.toggle('active', i === index));
    pageDots.forEach((dot, i) => dot.classList.toggle('active', i === index));
  }

  function syncPageFromScroll() {
    if (isProgrammaticScrollLocked() || !carousel?.clientWidth) return;
    const raw = carousel.scrollLeft / carousel.clientWidth;
    const nearest = Math.round(raw);
    // Only trigger page change when scroll position settles within threshold
    if (Math.abs(raw - nearest) < 0.15 && nearest !== currentPage && nearest >= 0 && nearest < navTabs.length) {
      goToPage(nearest, true);
    }
  }

  // Real-time resize listener on carousel to keep active page aligned during window dimension animation
  if (window.ResizeObserver && carousel) {
    const ro = new ResizeObserver(() => {
      if (carousel && carousel.clientWidth) {
        lockProgrammaticScroll(150);
        carousel.scrollLeft = currentPage * carousel.clientWidth;
      }
    });
    ro.observe(carousel);
  }

  // Throttled scroll listener on carousel with requestAnimationFrame
  let scrollRaf = null;
  carousel.addEventListener('scroll', () => {
    if (isProgrammaticScrollLocked()) return;
    if (!scrollRaf) {
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = null;
        syncPageFromScroll();
      });
    }
  }, { passive: true });

  // Native scrollend support for precise final snap alignment
  carousel.addEventListener('scrollend', () => {
    if (isProgrammaticScrollLocked()) return;
    syncPageFromScroll();
    if (carousel?.clientWidth) {
      carousel.scrollTo({
        left: currentPage * carousel.clientWidth,
        behavior: 'instant'
      });
    }
  });

  // Unified click navigation for segmented tabs and indicator dots
  [...navTabs, ...pageDots].forEach(el => {
    el.addEventListener('click', () => goToPage(Number(el.dataset.page)));
  });

  // --- 2. THEME SWITCHER (APPLE LIGHT / DARK) ---
  const savedTheme = localStorage.getItem('taptap-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  let cachedThemeDark = savedTheme === 'dark';
  updateThemeIcon(savedTheme);
  if (ipc) ipc.send('theme-changed', savedTheme);
  if (isTauri) tauriInvoke('save_ui_prefs', { args: { theme: savedTheme } });

  btnTheme.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    cachedThemeDark = (next === 'dark');
    localStorage.setItem('taptap-theme', next);
    updateThemeIcon(next);
    if (ipc) ipc.send('theme-changed', next);
    if (isTauri) tauriInvoke('save_ui_prefs', { args: { theme: next } });
  });

  function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (theme === 'dark') {
      // Sun icon
      icon.innerHTML = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z"/>';
    } else {
      // Moon icon
      icon.innerHTML = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';
    }
  }

  // --- 3. MUTE TOGGLE ---
  btnMute.addEventListener('click', () => {
    const isMuted = !audio.isMuted;
    audio.setMuted(isMuted);
    updateMasterMuteUI(isMuted);
    saveSettings();
    updateTrayStatus();
  });

  // --- 4. MINIMALIST APPLE SOUNDSTAGE RADAR ---
  let canvasW = 0;
  let canvasH = 0;
  const ripples = [];
  let radarResizeRaf = null;

  function resizeRadar(immediate = false) {
    // Zero-overhead guard: skip if window hidden or not on Soundstage tab
    if (!isWindowVisible || currentPage !== 0) return;
    if (!radarCanvas || !radarCanvas.parentElement) return;

    const performResize = () => {
      const rect = radarCanvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvasW === rect.width && canvasH === rect.height && radarCanvas.width === rect.width * dpr) {
        return; // Avoid unnecessary canvas buffer destruction
      }
      canvasW = rect.width;
      canvasH = rect.height;
      radarCanvas.width = canvasW * dpr;
      radarCanvas.height = canvasH * dpr;
      radarCtx.scale(dpr, dpr);
    };

    if (immediate) {
      performResize();
    } else {
      if (radarResizeRaf) cancelAnimationFrame(radarResizeRaf);
      radarResizeRaf = requestAnimationFrame(performResize);
    }
  }

  window.addEventListener('resize', () => {
    if (currentPage === 0) {
      resizeRadar(false);
    }
    if (carousel && carousel.clientWidth) {
      lockProgrammaticScroll(150);
      carousel.scrollTo({
        left: currentPage * carousel.clientWidth,
        behavior: 'instant'
      });
    }
  });
  if (window.ResizeObserver && radarCanvas?.parentElement) {
    const radarRo = new ResizeObserver(() => {
      if (currentPage === 0) {
        resizeRadar(false);
      }
    });
    radarRo.observe(radarCanvas.parentElement);
  }
  resizeRadar(true);

  let isRadarAnimating = false;

  function startRadarAnimation() {
    if (!isWindowVisible || currentPage !== 0) return;
    if (!isRadarAnimating) {
      isRadarAnimating = true;
      requestAnimationFrame(renderRadarLoop);
    }
  }

  function triggerRadar(pan, label, row = 2) {
    if (!isWindowVisible || currentPage !== 0) return;

    // Physical 3D Keyboard Projection:
    // Row 0 (Top corners: Esc, Backspace, Numbers) -> Far depth (top outer arcs)
    // Row 1 (Upper: Tab, QWERTY, \) -> Upper arc
    // Row 2 (Home: Caps, ASDF, Enter) -> Mid arc
    // Row 3 (Lower: Shift, ZXCV) -> Lower arc
    // Row 4 (Wrists: Ctrl, Space, Arrows) -> Near listener (bottom near arc)
    const normalizedDepth = (typeof row === 'number') ? (row / 4.0) : 0.5; // 0.0 (Top) to 1.0 (Bottom)

    // Distance from bottom-center listener:
    // Top corners reach the outer acoustic arc (~88px)
    // Bottom Space sits close to the listener dot (~28px)
    const distanceRadius = Math.max(26, Math.min(canvasH * 0.90, canvasH * (0.24 + (1 - normalizedDepth) * 0.62)));

    // Polar spread angle: pan (-1.0 to +1.0) mapped across ±48 degrees
    const angleRad = (pan * 0.95) * (Math.PI / 3.75);

    const centerX = canvasW * 0.5;
    const originY = canvasH - 16; // Listener dot baseline

    const rippleX = centerX + Math.sin(angleRad) * distanceRadius;
    const rippleY = originY - Math.cos(angleRad) * distanceRadius;

    ripples.push({
      x: rippleX,
      y: rippleY,
      r: 4,
      maxR: 36 + (1 - normalizedDepth) * 16,
      alpha: 0.95,
      pan,
      row
    });

    // Update readout with physical 3D quadrant
    let panText = 'Center';
    if (pan < -0.15) panText = `L ${Math.round(Math.abs(pan) * 100)}%`;
    else if (pan > 0.15) panText = `R ${Math.round(pan * 100)}%`;

    let depthPrefix = '';
    if (typeof row === 'number') {
      if (row === 0) depthPrefix = 'Top-';
      else if (row === 1) depthPrefix = 'Upper-';
      else if (row === 3) depthPrefix = 'Lower-';
      else if (row === 4) depthPrefix = 'Near-';
    } else if (row === 'mouse') {
      depthPrefix = 'Desk-';
    }

    stageReadout.textContent = `${label} • ${depthPrefix}${panText}`;

    startRadarAnimation();
  }

  // On-demand Radar Loop: Only consumes CPU/GPU when ripples are actively expanding AND window is visible
  function renderRadarLoop() {
    if (!isWindowVisible || currentPage !== 0 || ripples.length === 0) {
      if (radarCtx && canvasW && canvasH) radarCtx.clearRect(0, 0, canvasW, canvasH);
      isRadarAnimating = false;
      ripples.length = 0;
      return; // Stop animation loop completely when idle or window hidden
    }

    radarCtx.clearRect(0, 0, canvasW, canvasH);
    const strokeBase = cachedThemeDark ? 'rgba(212, 67, 89,' : 'rgba(114, 24, 37,';

    for (let i = ripples.length - 1; i >= 0; i--) {
      const rip = ripples[i];
      rip.r += 1.8;
      rip.alpha = Math.max(0, 1 - (rip.r / rip.maxR));

      if (rip.alpha <= 0.02) {
        ripples.splice(i, 1);
        continue;
      }

      radarCtx.beginPath();
      radarCtx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
      radarCtx.strokeStyle = `${strokeBase} ${rip.alpha * 0.75})`;
      radarCtx.lineWidth = 1.8;
      radarCtx.stroke();
    }

    if (ripples.length > 0) {
      requestAnimationFrame(renderRadarLoop);
    } else {
      radarCtx.clearRect(0, 0, canvasW, canvasH);
      isRadarAnimating = false;
    }
  }

  // --- 5. COMPACT KEYBOARD MATRIX & MULTI-LAYOUT RENDERER ---
  const keyMapElements = new Map();

  function renderKeyboardMatrix(layoutId) {
    if (!keyboardContainer) return;
    const layouts = window.TaptapLayouts || {};
    const layout = layouts[layoutId] || layouts['ansi-68'];
    if (!layout) return;

    currentLayoutId = layout.id;
    if (audio) audio.setLayout(layout.id);
    keyboardContainer.dataset.rows = String(layout.rows.length);
    keyboardContainer.dataset.layout = layout.id;

    keyboardContainer.innerHTML = '';
    keyMapElements.clear();

    layout.rows.forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';

      row.forEach(k => {
        const keyEl = document.createElement('div');
        keyEl.className = `c-key ${k.w || ''}`;
        keyEl.dataset.code = k.code;
        keyEl.textContent = k.label;

        keyEl.addEventListener('mousedown', (e) => {
          e.preventDefault();
          onActionDown(k.code, k.label);
        });

        keyEl.addEventListener('mouseup', (e) => {
          e.preventDefault();
          onActionUp(k.code);
        });

        keyEl.addEventListener('mouseleave', () => {
          onActionUp(k.code);
        });

        keyEl.addEventListener('contextmenu', (e) => {
          if (!rightClickMenuEnabled) e.preventDefault();
        });

        rowEl.appendChild(keyEl);
        keyMapElements.set(k.code, keyEl);
      });

      keyboardContainer.appendChild(rowEl);
    });

    if (lblKeyboardMatrixTitle) lblKeyboardMatrixTitle.textContent = `${layout.name} Matrix`;
    if (lblSelectedLayoutDesc) lblSelectedLayoutDesc.textContent = `${layout.name} • ${layout.desc}`;
    if (selKeyboardLayout && selKeyboardLayout.value !== layout.id) selKeyboardLayout.value = layout.id;
    if (selSettingsKeyboardLayout && selSettingsKeyboardLayout.value !== layout.id) selSettingsKeyboardLayout.value = layout.id;

    localStorage.setItem('taptap-keyboard-layout', layout.id);
  }

  // Synchronize layout change dropdowns in Keyboard Tab and Settings Tab
  [selKeyboardLayout, selSettingsKeyboardLayout].forEach(sel => {
    if (!sel) return;
    sel.addEventListener('change', (e) => {
      const newLayout = e.target.value;
      renderKeyboardMatrix(newLayout);
      saveSettings();
    });
  });

  // Initial matrix render
  renderKeyboardMatrix(currentLayoutId);

  // Dynamic Cursor Tracking
  let lastMouseXRatio = 0.5;
  window.addEventListener('mousemove', (e) => {
    if (!audio || !audio.dynamicCursorTracking) return;
    lastMouseXRatio = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
  }, { passive: true });

  function getMousePan(bias = 0) {
    if (audio.dynamicCursorTracking) {
      // Maps client X (0.0 to 1.0) to stereo pan (-1.0 to +1.0)
      const dynamicPan = (lastMouseXRatio - 0.5) * 2.0;
      return Math.max(-1.0, Math.min(1.0, dynamicPan + bias));
    }
    return null;
  }

  // --- 6. ACTION HANDLERS (DOWNSTROKE & UPSTROKE) ---
  const activeKeys = new Set();
  const mouseButtonPairs = {
    MouseLeft: [mBtnLeft, mBtnLeftAlt],
    MouseMiddle: [mBtnMid, mBtnMidAlt],
    MouseRight: [mBtnRight, mBtnRightAlt]
  };

  function setMouseButtonsPressed(code, pressed) {
    const pair = mouseButtonPairs[code];
    if (!pair) return;
    pair.forEach(el => el?.classList.toggle('pressed', pressed));
  }

  function onActionDown(code, label, customPan = null, playAudio = true, dedupe = false) {
    const isMouse = typeof code === 'string' && code.startsWith('Mouse');
    if (!isMouse) {
      if (activeKeys.has(code)) return; // Avoid key-repeat retrigger
      activeKeys.add(code);
    }

    const res = audio.trigger(code, false, customPan, playAudio, dedupe); // Downstroke with optional dynamic pan
    if (!res) return;

    // STEALTH MODE: If window is minimized to tray or hidden, bypass all DOM and canvas operations
    if (!isWindowVisible) return;

    // Only update visual keycaps when Keyboard tab is visible to avoid style recalcs
    if (!isMouse && currentPage === 1) {
      const keyEl = keyMapElements.get(code);
      if (keyEl) keyEl.classList.add('pressed');
    }

    // Update mouse readout and feedback if Mouse button is pressed
    if (isMouse && currentPage === 2) {
      if (mouseClickReadout) {
        let panText = 'Center';
        if (res.pan < -0.1) panText = `L ${Math.round(Math.abs(res.pan) * 100)}%`;
        else if (res.pan > 0.1) panText = `R ${Math.round(res.pan * 100)}%`;
        mouseClickReadout.textContent = `${label || 'Click'} • ${panText}`;
      }
      setMouseButtonsPressed(code, true);
    }

    // Only trigger radar if Soundstage tab is visible
    if (currentPage === 0) {
      triggerRadar(res.pan, label || code.replace('Key', ''), res.row);
    }
  }

  function onActionUp(code, playAudio = true, dedupe = false, customPan = null) {
    const isMouse = typeof code === 'string' && code.startsWith('Mouse');
    if (!isMouse) {
      if (!activeKeys.has(code)) return;
      activeKeys.delete(code);
    }

    audio.trigger(code, true, customPan, playAudio, dedupe); // Upstroke audio

    // STEALTH MODE: If window is minimized or hidden, bypass DOM lookups
    if (!isWindowVisible) return;

    if (!isMouse && currentPage === 1) {
      const keyEl = keyMapElements.get(code);
      if (keyEl) keyEl.classList.remove('pressed');
    }

    if (isMouse && currentPage === 2) {
      setMouseButtonsPressed(code, false);
    }
  }

  // Window Focus Keystroke Listeners
  window.addEventListener('keydown', (e) => {
    const isPickerOpen = !!switchPickerModal?.classList.contains('open');
    const isAboutOpen = !!aboutModal?.classList.contains('open');

    if (e.key === 'Escape') {
      if (isPickerOpen) {
        closeSwitchPickerModal();
        return;
      }
      if (isAboutOpen) {
        closeAboutModal();
        return;
      }
      if (currentPage === 1 && (gameActive || isCountingDown)) {
        stopTypingTest();
        return;
      }
    }

    const activeEl = document.activeElement;
    const activeTag = activeEl ? activeEl.tagName.toLowerCase() : '';
    const keyLabel = (e.key && e.key.length === 1) ? e.key.toUpperCase() : (e.code ? e.code.replace('Key', '') : '');

    if (isPickerOpen && activeEl?.id === 'inputSwitchSearch') {
      if (!e.repeat && e.code) {
        onActionDown(e.code, keyLabel, null, true, isTauri);
      }
      return;
    }

    if (isPickerOpen || isAboutOpen) {
      if (!e.repeat && e.code) {
        onActionDown(e.code, keyLabel, null, true, isTauri);
      }
      return;
    }

    if (!e.repeat && e.code) {
      onActionDown(e.code, keyLabel, null, true, isTauri);
    }

    // Route directly to typing game when active on Keyboard page
    if (currentPage === 1) {
      if (gameActive || isCountingDown) {
        if (e.key === ' ' || e.key === 'Backspace' || e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
        }
      }
      if (gameActive && !isCountingDown) {
        if (e.key === 'Backspace') {
          processGameKey('Backspace');
        } else if (!e.repeat && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          processGameKey(e.key);
        }
      } else if (!gameActive && !isCountingDown && e.key === 'Enter' && !e.repeat && activeTag !== 'select') {
        e.preventDefault();
        triggerCountdown();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code) {
      onActionUp(e.code, true, isTauri);
    }
  });

  // In-window mouse click sounds (unified across Tauri, Electron, and Web since native hooks ignore focused clicks)
  const MOUSE_CLICK_EXCLUDE_SELECTOR = '.c-key, .mouse-btn-zone, .mouse-wheel-zone, .mouse-pill-btn, .btn-preview-switch, .fav-switch-pill, .switch-item-card, #clickToStartOverlay, #btnPlayAgain, #btnRestartGame, #btnMute, #btnMuteKeyboard, #btnMuteMouse';
  window.addEventListener('mousedown', (e) => {
    if (e.target instanceof Element && e.target.closest(MOUSE_CLICK_EXCLUDE_SELECTOR)) {
      return;
    }
    const code = e.button === 2 ? 'MouseRight' : (e.button === 1 ? 'MouseMiddle' : 'MouseLeft');
    const label = e.button === 2 ? 'R-Click' : (e.button === 1 ? 'Wheel' : 'L-Click');
    onActionDown(code, label, getMousePan(0), true);
  });
  window.addEventListener('mouseup', (e) => {
    if (e.target instanceof Element && e.target.closest(MOUSE_CLICK_EXCLUDE_SELECTOR)) {
      return;
    }
    const code = e.button === 2 ? 'MouseRight' : (e.button === 1 ? 'MouseMiddle' : 'MouseLeft');
    onActionUp(code, true);
  });

  // Global Background Keyboard & Mouse Listeners via Electron IPC (uIOhook) or Tauri Native Hooks
  if (ipc) {
    ipc.on('global-keydown', (event, { code }) => {
      onActionDown(code, code.replace('Key', ''));
    });

    ipc.on('global-keyup', (event, { code }) => {
      onActionUp(code);
    });

    ipc.on('global-mousedown', (event, { code, x, y }) => {
      let pan = null;
      if (typeof x === 'number' && audio && audio.dynamicCursorTracking) {
        const screenW = (window.screen && window.screen.width) ? window.screen.width : 1920;
        const clampedX = Math.max(0, Math.min(screenW, x));
        const xRatio = clampedX / screenW;
        pan = (xRatio - 0.5) * 2.0;
      }
      onActionDown(code, code.replace('Mouse', ''), pan);
    });

    ipc.on('global-mouseup', (event, { code, x }) => {
      let pan = null;
      if (typeof x === 'number' && audio && audio.dynamicCursorTracking) {
        const screenW = (window.screen && window.screen.width) ? window.screen.width : 1920;
        const clampedX = Math.max(0, Math.min(screenW, x));
        pan = (clampedX / screenW - 0.5) * 2.0;
      }
      onActionUp(code, true, false, pan);
    });
  }

  if (isTauri) {
    tauriListen('taptap://input-event', (event) => {
      const payload = event.payload || {};
      const { kind, code, pan } = payload;
      if (!code) return;
      if (kind === 'keydown') {
        onActionDown(code, code.replace('Key', ''), (typeof pan === 'number') ? pan : null, false);
      } else if (kind === 'keyup') {
        onActionUp(code, false);
      } else if (kind === 'mousedown') {
        onActionDown(code, code.replace('Mouse', ''), (typeof pan === 'number') ? pan : null, false);
      } else if (kind === 'mouseup') {
        onActionUp(code, false);
      }
    });
  }

  // --- 7. MOUSE CLICK ZONE (SILHOUETTE & PILL BUTTONS) ---
  const activeMouseZones = new Set();
  function bindMouseZone(elements, code, label, panBias, preventContext = false) {
    elements.filter(Boolean).forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        activeMouseZones.add(el);
        setMouseButtonsPressed(code, true);
        onActionDown(code, label, getMousePan(panBias));
      });
      const release = () => {
        if (!activeMouseZones.has(el)) return;
        activeMouseZones.delete(el);
        setMouseButtonsPressed(code, false);
        onActionUp(code, true, false, getMousePan(panBias));
      };
      el.addEventListener('mouseup', release);
      el.addEventListener('mouseleave', release);
      if (preventContext) {
        el.addEventListener('contextmenu', (e) => {
          if (!rightClickMenuEnabled) e.preventDefault();
        });
      }
    });
  }

  bindMouseZone([mBtnLeft, mBtnLeftAlt], 'MouseLeft', 'L-Click', -0.08);
  bindMouseZone([mBtnMid, mBtnMidAlt], 'MouseMiddle', 'Wheel', 0);
  bindMouseZone([mBtnRight, mBtnRightAlt], 'MouseRight', 'R-Click', 0.08, true);

  // --- 8. KEYBOARD SWITCHES & MOUSE SOUNDPACK CONTROLLERS ---
  async function selectKeyboardSwitch(switchId, playDemo = true) {
    if (!audio) return;
    await audio.loadKeyboardPack(switchId);
    updateActiveSwitchUI(switchId);
    saveSettings();
    updateTrayStatus();
    if (playDemo) {
      onActionDown('KeyG', 'G');
      setTimeout(() => onActionUp('KeyG'), 110);
    }
  }

  function selectKeyboardPack(pack) {
    selectKeyboardSwitch(pack, true);
  }

  function toggleFavoriteSwitch(id) {
    if (favoriteSwitches.includes(id)) {
      if (favoriteSwitches.length > 1) {
        favoriteSwitches = favoriteSwitches.filter(item => item !== id);
      }
    } else {
      if (favoriteSwitches.length >= 4) {
        favoriteSwitches.shift(); // keep top 4 favorites
      }
      favoriteSwitches.push(id);
    }
    saveFavorites();
    renderSwitchPickerGrid();
  }

  function renderSwitchPickerGrid() {
    if (!pickerSwitchGrid) return;
    const allSwitches = window.TaptapSwitches || [];
    const query = currentSearchQuery.trim().toLowerCase();

    const filtered = allSwitches.filter(sw => {
      const matchesCategory = (currentCategory === 'all') || (sw.category === currentCategory);
      if (!matchesCategory) return false;

      if (!query) return true;
      return sw.name.toLowerCase().includes(query) ||
        sw.feel.toLowerCase().includes(query) ||
        sw.sound.toLowerCase().includes(query) ||
        sw.tag.toLowerCase().includes(query) ||
        sw.category.toLowerCase().includes(query);
    });

    if (pickerCountLabel) {
      pickerCountLabel.textContent = (filtered.length === allSwitches.length)
        ? `${allSwitches.length} switches available`
        : `${filtered.length} of ${allSwitches.length} switches`;
    }

    pickerSwitchGrid.innerHTML = '';

    if (filtered.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'picker-empty-state';
      emptyEl.innerHTML = `
        <span class="picker-empty-emoji">🔍</span>
        <span class="picker-empty-title">No matching switches</span>
        <span class="picker-empty-desc">Try another search term or switch category</span>
        <button class="btn-reset-filters" id="btnResetFilters">Reset Filters</button>
      `;
      pickerSwitchGrid.appendChild(emptyEl);
      document.getElementById('btnResetFilters')?.addEventListener('click', () => {
        currentSearchQuery = '';
        currentCategory = 'all';
        if (inputSwitchSearch) inputSwitchSearch.value = '';
        if (btnSearchClear) btnSearchClear.style.display = 'none';
        categoryChips.forEach(c => c.classList.toggle('active', c.dataset.cat === 'all'));
        renderSwitchPickerGrid();
      });
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach(sw => {
      const isActive = (sw.id === audio.activeKeyboardPack);
      const isFav = favoriteSwitches.includes(sw.id);

      const card = document.createElement('div');
      card.className = `switch-item-card ${isActive ? 'active' : ''}`;
      card.dataset.id = sw.id;

      card.innerHTML = `
        <div class="switch-item-left">
          <div class="switch-item-avatar">
            <img class="switch-brand-img" src="${sw.brandIcon}" width="28" height="28" style="width:100%;height:100%;max-width:28px;max-height:28px;object-fit:contain;display:block;" alt="${sw.brandName || sw.name}" onerror="this.outerHTML='<span style=\\'font-weight:700;font-size:0.8rem;color:var(--text-primary);\\'>${(sw.brandName || 'S')[0]}</span>';">
          </div>
          <div class="switch-item-info">
            <div class="switch-item-title-row">
              <span class="switch-item-name">${sw.name}</span>
              <span class="switch-item-tag">${sw.tag}</span>
            </div>
            <span class="switch-item-sound-badge">${sw.brandName || sw.name} • ${sw.sound}</span>
          </div>
        </div>
        <div class="switch-item-actions">
          <span class="switch-active-badge">✓ Active</span>
          <button class="btn-fav-switch ${isFav ? 'is-fav' : ''}" data-id="${sw.id}" title="${isFav ? 'Remove from favorites' : 'Pin to quick favorites'}">
            ${isFav ? '★' : '☆'}
          </button>
          <button class="btn-preview-switch" data-id="${sw.id}" title="Preview Sound">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
      `;

      // Favorite click
      const favBtn = card.querySelector('.btn-fav-switch');
      if (favBtn) {
        favBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleFavoriteSwitch(sw.id);
        });
      }

      // Preview click
      const prevBtn = card.querySelector('.btn-preview-switch');
      if (prevBtn) {
        prevBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          prevBtn.classList.add('playing');
          await audio.previewSwitch(sw.id);
          setTimeout(() => prevBtn.classList.remove('playing'), 350);
        });
      }

      // Card click
      card.addEventListener('click', () => {
        selectKeyboardSwitch(sw.id);
        closeSwitchPickerModal();
      });

      frag.appendChild(card);
    });
    pickerSwitchGrid.appendChild(frag);
  }

  function openSwitchPickerModal() {
    if (!switchPickerModal) return;
    switchPickerModal.classList.add('open');
    switchPickerModal.setAttribute('aria-hidden', 'false');
    renderSwitchPickerGrid();
    setTimeout(() => {
      if (inputSwitchSearch) {
        inputSwitchSearch.focus();
        inputSwitchSearch.select();
      }
    }, 80);
  }

  function closeSwitchPickerModal() {
    if (!switchPickerModal) return;
    switchPickerModal.classList.remove('open');
    switchPickerModal.setAttribute('aria-hidden', 'true');
    if (currentPage === 1) focusTypingSurface();
  }

  if (btnOpenSwitchPicker0) btnOpenSwitchPicker0.addEventListener('click', openSwitchPickerModal);
  if (btnOpenSwitchPicker1) btnOpenSwitchPicker1.addEventListener('click', openSwitchPickerModal);
  if (btnSwitchPickerClose) btnSwitchPickerClose.addEventListener('click', closeSwitchPickerModal);

  if (switchPickerModal) {
    switchPickerModal.addEventListener('click', (e) => {
      if (e.target === switchPickerModal) closeSwitchPickerModal();
    });
  }

  // Search input live filtering
  if (inputSwitchSearch) {
    inputSwitchSearch.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value;
      if (btnSearchClear) {
        btnSearchClear.style.display = currentSearchQuery ? 'block' : 'none';
      }
      renderSwitchPickerGrid();
    });
  }

  if (btnSearchClear) {
    btnSearchClear.addEventListener('click', () => {
      currentSearchQuery = '';
      if (inputSwitchSearch) {
        inputSwitchSearch.value = '';
        inputSwitchSearch.focus();
      }
      btnSearchClear.style.display = 'none';
      renderSwitchPickerGrid();
    });
  }

  // Category chips
  categoryChips.forEach(chip => {
    chip.addEventListener('click', () => {
      categoryChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.cat || 'all';
      renderSwitchPickerGrid();
    });
  });


  async function selectMousePack(mousePack) {
    if (selMousePack) selMousePack.value = mousePack;
    if (selMousePackQuick) selMousePackQuick.value = mousePack;
    await audio.loadMousePack(mousePack);
    if (infoMousePackName) infoMousePackName.textContent = mousePack;
    saveSettings();
    audio.trigger('MouseLeft', false);
  }

  if (selMousePack) selMousePack.addEventListener('change', e => selectMousePack(e.target.value));
  if (selMousePackQuick) selMousePackQuick.addEventListener('change', e => selectMousePack(e.target.value));

  // --- 9. CONTROLS & SLIDERS (SEPARATE KEYBOARD & MOUSE) ---
  if (rngWidth) {
    rngWidth.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (txtWidth) txtWidth.textContent = `${val}%`;
      audio.setStereoWidth(val / 100);
      scheduleSaveSettings();
    });
    rngWidth.addEventListener('change', (e) => {
      saveSettings();
    });
  }

  if (rngKbVolume) {
    rngKbVolume.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (txtKbVolume) txtKbVolume.textContent = `${val}%`;
      audio.setKeyboardVolume(val / 100);
      scheduleSaveSettings();
    });
    rngKbVolume.addEventListener('change', (e) => {
      saveSettings();
    });
  }

  if (rngMouseVolume) {
    rngMouseVolume.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (txtMouseVolume) txtMouseVolume.textContent = `${val}%`;
      audio.setMouseVolume(val / 100);
      scheduleSaveSettings();
    });
    rngMouseVolume.addEventListener('change', (e) => {
      saveSettings();
    });
  }

  // Keyboard Mute State Handler (Synchronized across Soundstage pill & Settings toggle)
  function updateKeyboardMuteState(isMuted, shouldSave = true) {
    audio.setKeyboardMuted(isMuted);
    if (btnMuteKeyboard) {
      btnMuteKeyboard.classList.toggle('muted', isMuted);
    }
    if (txtMuteKb) {
      txtMuteKb.textContent = isMuted ? 'Muted' : 'Sound On';
    }
    if (chkKeyboardAudioActive) {
      chkKeyboardAudioActive.checked = !isMuted;
    }
    if (shouldSave) saveSettings();
  }

  if (btnMuteKeyboard) {
    btnMuteKeyboard.addEventListener('click', () => {
      updateKeyboardMuteState(!audio.keyboardMuted);
    });
  }
  if (chkKeyboardAudioActive) {
    chkKeyboardAudioActive.addEventListener('change', (e) => {
      updateKeyboardMuteState(!e.target.checked);
    });
  }

  // Mouse Mute State Handler (Synchronized across Soundstage pill & Settings toggle)
  function updateMouseMuteState(isMuted, shouldSave = true) {
    audio.setMouseMuted(isMuted);
    if (btnMuteMouse) {
      btnMuteMouse.classList.toggle('muted', isMuted);
    }
    if (txtMuteMouse) {
      txtMuteMouse.textContent = isMuted ? 'Muted' : 'Sound On';
    }
    if (chkMouseAudioActive) {
      chkMouseAudioActive.checked = !isMuted;
    }
    if (shouldSave) saveSettings();
  }

  if (btnMuteMouse) {
    btnMuteMouse.addEventListener('click', () => {
      updateMouseMuteState(!audio.mouseMuted);
    });
  }
  if (chkMouseAudioActive) {
    chkMouseAudioActive.addEventListener('change', (e) => {
      updateMouseMuteState(!e.target.checked);
    });
  }

  if (rngJitter) {
    rngJitter.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (txtJitter) txtJitter.textContent = `±${(val / 10).toFixed(1)}%`;
      audio.setPitchJitter(val / 1000);
      scheduleSaveSettings();
    });
    rngJitter.addEventListener('change', () => {
      saveSettings();
    });
  }

  if (chkUpstroke) {
    chkUpstroke.addEventListener('change', (e) => {
      audio.setUpstrokes(e.target.checked);
      saveSettings();
    });
  }

  if (chkMouseUpstroke) {
    chkMouseUpstroke.addEventListener('change', (e) => {
      audio.setMouseUpstrokes(e.target.checked);
      saveSettings();
    });
  }

  if (chkCursorTracking) {
    chkCursorTracking.addEventListener('change', (e) => {
      audio.setDynamicCursorTracking(e.target.checked);
      saveSettings();
    });
  }

  if (chkElevation) {
    chkElevation.addEventListener('change', (e) => {
      audio.setVerticalElevation(e.target.checked);
      saveSettings();
    });
  }

  // Right-Click Context Menu ("Inspect Element") Toggle
  if (chkRightClickMenu) {
    chkRightClickMenu.addEventListener('change', (e) => {
      rightClickMenuEnabled = !!e.target.checked;
      saveSettings();
      if (isTauri) {
        tauriInvoke('save_ui_prefs', { args: { rightClickMenu: rightClickMenuEnabled } });
      }
    });
  }

  // Windows Startup & Silent Stealth Boot Setting
  const chkStartupLaunch = document.getElementById('chkStartupLaunch');
  if (chkStartupLaunch && (ipc || isTauri)) {
    const getStartup = ipc ? ipc.invoke('get-startup-status') : tauriInvoke('get_startup_status');
    getStartup.then(enabled => {
      chkStartupLaunch.checked = !!enabled;
    }).catch(() => { });

    chkStartupLaunch.addEventListener('change', (e) => {
      const setStartup = ipc
        ? ipc.invoke('set-startup-status', e.target.checked)
        : tauriInvoke('set_startup_status', { enable: e.target.checked });
      setStartup.then(res => {
        chkStartupLaunch.checked = !!res;
      }).catch(() => { });
    });
  }

  modeOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      modeOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      audio.setMode(opt.dataset.mode);
      saveSettings();
    });
  });

  // --- ABOUT MODAL CONTROLLERS ---
  function openAboutModal() {
    if (aboutModal) {
      aboutModal.classList.add('open');
      aboutModal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeAboutModal() {
    if (aboutModal) {
      aboutModal.classList.remove('open');
      aboutModal.setAttribute('aria-hidden', 'true');
      if (currentPage === 1) focusTypingSurface();
    }
  }

  if (btnAbout) btnAbout.addEventListener('click', openAboutModal);
  if (btnBrandAbout) btnBrandAbout.addEventListener('click', openAboutModal);
  if (btnSettingsAbout) {
    btnSettingsAbout.addEventListener('click', openAboutModal);
    btnSettingsAbout.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openAboutModal();
      }
    });
  }
  if (btnAboutClose) btnAboutClose.addEventListener('click', closeAboutModal);

  if (aboutModal) {
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) closeAboutModal();
    });
  }

  // Handle GitHub Link
  if (linkGithub) {
    linkGithub.addEventListener('click', (e) => {
      const url = 'https://github.com/Mightyiest/';
      if (ipc) {
        e.preventDefault();
        ipc.send('open-external-url', url);
      } else if (isTauri) {
        e.preventDefault();
        tauriInvoke('open_external_url', { url });
      }
    });
  }

  // --- 10. APPLE TYPING TEST MINI GAME ---
  const typingSentences = [
    "tactile switches produce crisp spatial acoustic travel with every stroke",
    "clean design is not just what it looks like but how it feels to touch",
    "lofree mechanical switches deliver deep acoustic resonance and fluid rebound",
    "spatial audio brings three dimensional depth to headphones and ears",
    "effortless typing rhythm creates a rewarding and focused flow state"
  ];

  let currentSentence = "";
  let charIndex = 0;
  let correctKeystrokes = 0;
  let totalKeystrokes = 0;
  let gameStartTime = null;
  let gameActive = false;
  let isCountingDown = false;
  let countdownTimer = null;
  let timerInterval = null;
  let resultResetTimer = null;
  let charSpans = [];

  const statWpm = document.getElementById('statWpm');
  const statAccuracy = document.getElementById('statAccuracy');
  const statTime = document.getElementById('statTime');
  const btnRestartGame = document.getElementById('btnRestartGame');
  const btnStopGame = document.getElementById('btnStopGame');
  const typingStreamBox = document.getElementById('typingStreamBox');
  const clickToStartOverlay = document.getElementById('clickToStartOverlay');
  const gameCountdownOverlay = document.getElementById('gameCountdownOverlay');
  const countdownNumber = document.getElementById('countdownNumber');
  const streamText = document.getElementById('streamText');
  const gameResultOverlay = document.getElementById('gameResultOverlay');
  const resWpm = document.getElementById('resWpm');
  const resAcc = document.getElementById('resAcc');
  const resTime = document.getElementById('resTime');
  const resCountdownHint = document.getElementById('resCountdownHint');
  const btnPlayAgain = document.getElementById('btnPlayAgain');

  function setGameState(state) {
    clickToStartOverlay?.classList.toggle('hidden', state !== 'idle');
    gameCountdownOverlay?.classList.toggle('show', state === 'countdown');
    gameResultOverlay?.classList.toggle('show', state === 'finished');
  }

  function clearGameTimers() {
    clearTimeout(countdownTimer);
    countdownTimer = null;
    clearInterval(timerInterval);
    timerInterval = null;
    clearInterval(resultResetTimer);
    resultResetTimer = null;
  }

  function initTypingTest() {
    clearGameTimers();
    setGameState('idle');

    gameActive = false;
    isCountingDown = false;
    gameStartTime = null;
    charIndex = 0;
    correctKeystrokes = 0;
    totalKeystrokes = 0;
    if (statWpm) statWpm.textContent = '0 WPM';
    if (statAccuracy) statAccuracy.textContent = '100% ACC';
    if (statTime) statTime.textContent = 'Ready';

    currentSentence = typingSentences[Math.floor(Math.random() * typingSentences.length)];
    if (streamText) {
      streamText.innerHTML = Array.from(currentSentence, (ch, i) =>
        `<span class="ch${i === 0 ? ' current' : ''}">${ch}</span>`
      ).join('');
      charSpans = streamText.children;
    }
  }

  function stopTypingTest() {
    clearGameTimers();
    gameActive = false;
    isCountingDown = false;
    gameStartTime = null;
    charIndex = 0;
    correctKeystrokes = 0;
    totalKeystrokes = 0;
    if (statWpm) statWpm.textContent = '0 WPM';
    if (statAccuracy) statAccuracy.textContent = '100% ACC';
    if (statTime) statTime.textContent = 'Ready';
    setGameState('idle');

    if (charSpans && charSpans.length) {
      for (let i = 0; i < charSpans.length; i++) {
        charSpans[i].className = 'ch' + (i === 0 ? ' current' : '');
      }
    }
  }

  if (btnStopGame) {
    btnStopGame.addEventListener('click', (e) => {
      e.stopPropagation();
      stopTypingTest();
    });
  }

  // Animated 3.. 2.. 1.. GO! Countdown
  function triggerCountdown() {
    if (isCountingDown || gameActive) return;
    if (gameResultOverlay?.classList.contains('show')) {
      initTypingTest();
    }
    isCountingDown = true;
    focusTypingSurface();

    clearGameTimers();
    setGameState('countdown');

    let count = 3;

    function nextCount() {
      if (!countdownNumber) return;

      countdownNumber.classList.remove('countdown-pop');
      void countdownNumber.offsetWidth; // Force CSS animation restart
      countdownNumber.classList.add('countdown-pop');

      if (count > 0) {
        countdownNumber.textContent = count;
        countdownNumber.style.color = 'var(--accent-blue)';
        if (statTime) statTime.textContent = `Starts in ${count}...`;
        audio.trigger('Space', false); // Gentle tactile click on countdown beat
        count--;
        countdownTimer = setTimeout(nextCount, 500);
      } else {
        countdownNumber.textContent = 'GO!';
        countdownNumber.style.color = '#34c759'; // Apple success green
        if (statTime) statTime.textContent = '0.0s';
        audio.trigger('Enter', false); // Crisp enter clack on GO

        countdownTimer = setTimeout(() => {
          setGameState('playing');
          isCountingDown = false;
          startTypingNow();
        }, 280);
      }
    }

    nextCount();
  }

  function startTypingNow() {
    gameActive = true;
    gameStartTime = performance.now();
    charIndex = 0;
    correctKeystrokes = 0;
    totalKeystrokes = 0;
    if (statTime) statTime.textContent = '0.0s';
    focusTypingSurface();

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!gameActive || !gameStartTime) return;
      const elapsedSecs = (performance.now() - gameStartTime) / 1000;
      if (statTime) statTime.textContent = elapsedSecs.toFixed(1) + 's';

      const elapsedMins = elapsedSecs / 60;
      if (elapsedMins > 0.01) {
        const wpm = Math.round((correctKeystrokes / 5) / elapsedMins);
        if (statWpm) statWpm.textContent = `${wpm} WPM`;
      }
    }, 100);
  }

  // Click on prompt or typing box starts the countdown and focuses typing surface
  if (clickToStartOverlay) {
    clickToStartOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerCountdown();
    });
  }

  if (typingStreamBox) {
    typingStreamBox.addEventListener('click', () => {
      focusTypingSurface();
      if (!gameActive && !isCountingDown) {
        triggerCountdown();
      }
    });
  }

  // Key Processing (Direct from window listener - 100% reliable)
  function processGameKey(key) {
    if (!gameActive || isCountingDown || !charSpans) return;

    if (key === 'Backspace') {
      if (charIndex > 0) {
        charIndex--;
        if (charSpans[charIndex]) charSpans[charIndex].className = 'ch current';
        if (charSpans[charIndex + 1]) charSpans[charIndex + 1].className = 'ch';
      }
      return;
    }

    if (key.length !== 1) return;

    const expected = currentSentence[charIndex];
    const isCorrect = key === expected;
    totalKeystrokes++;
    if (isCorrect) correctKeystrokes++;

    if (charSpans[charIndex]) {
      charSpans[charIndex].className = 'ch ' + (isCorrect ? 'correct' : 'wrong');
    }

    charIndex++;

    // Real-time Accuracy
    const acc = Math.round((correctKeystrokes / Math.max(1, totalKeystrokes)) * 100);
    if (statAccuracy) statAccuracy.textContent = `${acc}% ACC`;

    if (charIndex < currentSentence.length) {
      if (charSpans[charIndex]) charSpans[charIndex].className = 'ch current';
    } else {
      finishTypingTest();
    }
  }

  function finishTypingTest() {
    gameActive = false;
    clearInterval(timerInterval);
    timerInterval = null;

    const elapsedSecs = ((performance.now() - gameStartTime) / 1000).toFixed(1);
    const elapsedMins = elapsedSecs / 60;
    const finalWpm = Math.round((correctKeystrokes / 5) / Math.max(0.01, elapsedMins));
    const finalAcc = Math.round((correctKeystrokes / Math.max(1, totalKeystrokes)) * 100);

    if (statTime) statTime.textContent = `${elapsedSecs}s`;
    if (resWpm) resWpm.textContent = finalWpm;
    if (resAcc) resAcc.textContent = `${finalAcc}%`;
    if (resTime) resTime.textContent = `${elapsedSecs}s`;
    setGameState('finished');

    let count = 5;
    if (resCountdownHint) resCountdownHint.textContent = `Next test starting in ${count}s...`;
    clearInterval(resultResetTimer);
    resultResetTimer = setInterval(() => {
      count--;
      if (count > 0) {
        if (resCountdownHint) resCountdownHint.textContent = `Next test starting in ${count}s...`;
      } else {
        clearInterval(resultResetTimer);
        resultResetTimer = null;
        initTypingTest();
      }
    }, 1000);
  }

  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
      clearGameTimers();
      initTypingTest();
      triggerCountdown();
    });
  }

  if (btnRestartGame) {
    btnRestartGame.addEventListener('click', () => {
      clearGameTimers();
      initTypingTest();
      triggerCountdown();
    });
  }

  initTypingTest();

  // --- 11. ELECTRON IPC & TAURI SHORTCUTS / NATIVE HYDRATION ---
  try {
    const { ipcRenderer } = require('electron');
    ipcRenderer.on('toggle-mute', () => {
      btnMute.click();
    });
  } catch (e) { }

  if (isTauri) {
    tauriListen('taptap://mute-changed', (event) => {
      const muted = !!event.payload;
      audio.setSuppressNativeSync(true);
      audio.setMuted(muted);
      audio.setSuppressNativeSync(false);
      updateMasterMuteUI(muted);
      try {
        const raw = localStorage.getItem('taptap-audio-settings');
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.masterMuted = muted;
        localStorage.setItem('taptap-audio-settings', JSON.stringify(parsed));
      } catch (e) { }
    });

    tauriInvoke('get_all_settings').then((nativeSettings) => {
      if (!nativeSettings) return;
      try {
        localStorage.setItem('taptap-audio-settings', JSON.stringify(nativeSettings));
        if (nativeSettings.theme) {
          localStorage.setItem('taptap-theme', nativeSettings.theme);
          document.documentElement.setAttribute('data-theme', nativeSettings.theme);
          cachedThemeDark = (nativeSettings.theme === 'dark');
          updateThemeIcon(nativeSettings.theme);
        }
        if (Array.isArray(nativeSettings.favoriteSwitches) && nativeSettings.favoriteSwitches.length > 0) {
          localStorage.setItem('taptap-favorite-switches', JSON.stringify(nativeSettings.favoriteSwitches));
        }
        if (nativeSettings.keyboardLayout) {
          localStorage.setItem('taptap-keyboard-layout', nativeSettings.keyboardLayout);
        }
      } catch (e) { }
      audio.setSuppressNativeSync(true);
      loadSettings();
      renderKeyboardMatrix(currentLayoutId);
    }).catch(() => { }).finally(() => {
      audio.setSuppressNativeSync(false);
    });
  }
});
