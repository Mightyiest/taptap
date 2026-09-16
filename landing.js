/**
 * Taptap — Luxury Website Controller (landing.js)
 * Manages live interactive soundstage, switch previews, canvas radar, and theme.
 */

document.addEventListener('DOMContentLoaded', () => {
  const audio = window.TaptapAudio;

  // --- 1. THEME SWITCHER ---
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const savedTheme = localStorage.getItem('taptap-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('taptap-theme', next);
      updateThemeIcon(next);
    });
  }

  function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIconSvg');
    if (!icon) return;
    if (theme === 'dark') {
      icon.innerHTML = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z"/>';
    } else {
      icon.innerHTML = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';
    }
  }

  // --- 2. FAST AUDIO WAKE ON FIRST USER GESTURE ---
  const wakeAudio = () => {
    if (audio) {
      audio.initContext();
      if (audio.ctx && audio.ctx.state === 'suspended') {
        audio.ctx.resume();
      }
    }
  };
  window.addEventListener('pointerdown', wakeAudio, { once: true, passive: true });
  window.addEventListener('keydown', wakeAudio, { once: true, passive: true });

  // --- 3. SWITCH REGISTRY & ACTIVE SWITCH STATE ---
  const switches = window.TaptapSwitches || [];
  let currentSwitchId = 'pulse';

  const switchAvatar = document.getElementById('demoSwitchAvatar');
  const switchName = document.getElementById('demoSwitchName');
  const switchSub = document.getElementById('demoSwitchSub');
  const demoSwitchPills = document.getElementById('demoSwitchPills');

  function setSwitch(switchId) {
    currentSwitchId = switchId;
    const sw = switches.find(s => s.id === switchId) || {
      id: 'pulse',
      name: 'Lofree Flow 2 (Pulse)',
      brandIcon: 'assets/brands/lofree.png',
      sound: 'Creamy Thock',
      tag: 'Linear'
    };

    if (switchAvatar) {
      switchAvatar.innerHTML = `<img src="${sw.brandIcon}" alt="${sw.name}" />`;
    }
    if (switchName) switchName.textContent = sw.name;
    if (switchSub) switchSub.textContent = `${sw.tag || 'Linear'} • ${sw.sound || 'Creamy Thock'}`;

    // Update active pill styling
    document.querySelectorAll('.demo-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.switch === switchId);
    });

    if (audio) {
      audio.loadKeyboardPack(switchId)
        .then(() => console.log(`[Taptap Web] Loaded ${switchId}`))
        .catch(err => console.warn('[Taptap Web] Load error:', err));
    }
  }

  // Load default switch
  setSwitch('pulse');
  if (audio) audio.loadMousePack('Bloody V8');

  // Switch pill click handlers
  if (demoSwitchPills) {
    demoSwitchPills.querySelectorAll('.demo-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setSwitch(btn.dataset.switch);
      });
    });
  }

  // Switch cards "Test Switch" buttons
  document.querySelectorAll('.btn-test-switch').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const swId = btn.dataset.switch;
      setSwitch(swId);
      // Play a demo triple chord
      setTimeout(() => audio?.trigger('KeyA'), 60);
      setTimeout(() => audio?.trigger('KeyS'), 160);
      setTimeout(() => audio?.trigger('KeyD'), 260);

      // Scroll smoothly to demo if far away
      const demoEl = document.getElementById('demo');
      if (demoEl && window.scrollY > demoEl.offsetTop + 600) {
        demoEl.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // --- 4. 60 FPS SOUNDSTAGE RADAR VISUALIZER ---
  const radarCanvas = document.getElementById('demoRadarCanvas');
  const stageReadout = document.getElementById('demoStageReadout');
  const ripples = [];
  let radarCtx = null;
  let canvasW = 0;
  let canvasH = 0;
  let isRadarAnimating = false;

  if (radarCanvas) {
    radarCtx = radarCanvas.getContext('2d');
    function resizeRadar() {
      const rect = radarCanvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvasW = rect.width;
      canvasH = rect.height;
      radarCanvas.width = canvasW * dpr;
      radarCanvas.height = canvasH * dpr;
      radarCtx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resizeRadar);
    setTimeout(resizeRadar, 100);
  }

  function startRadarLoop() {
    if (!isRadarAnimating) {
      isRadarAnimating = true;
      requestAnimationFrame(renderRadar);
    }
  }

  function renderRadar() {
    if (!radarCtx) return;
    radarCtx.clearRect(0, 0, canvasW, canvasH);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const centerX = canvasW * 0.5;
    const originY = canvasH - 14;

    // Draw reference radial arcs
    radarCtx.lineWidth = 1;
    radarCtx.strokeStyle = isDark ? 'rgba(220, 95, 115, 0.12)' : 'rgba(114, 24, 37, 0.10)';

    [canvasH * 0.35, canvasH * 0.65, canvasH * 0.88].forEach(radius => {
      radarCtx.beginPath();
      radarCtx.arc(centerX, originY, radius, Math.PI * 1.15, Math.PI * 1.85);
      radarCtx.stroke();
    });

    // Draw listener anchor
    radarCtx.fillStyle = isDark ? '#d44359' : '#721825';
    radarCtx.beginPath();
    radarCtx.arc(centerX, originY, 4, 0, Math.PI * 2);
    radarCtx.fill();

    // Render ripple waves
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.radius += 1.8;
      r.alpha *= 0.94;

      if (r.alpha < 0.01 || r.radius > r.maxRadius) {
        ripples.splice(i, 1);
        continue;
      }

      radarCtx.beginPath();
      radarCtx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      radarCtx.strokeStyle = isDark
        ? `rgba(212, 67, 89, ${r.alpha * 0.85})`
        : `rgba(114, 24, 37, ${r.alpha * 0.85})`;
      radarCtx.lineWidth = 2;
      radarCtx.stroke();
    }

    if (ripples.length > 0) {
      requestAnimationFrame(renderRadar);
    } else {
      isRadarAnimating = false;
    }
  }

  function triggerRadar(pan, label, row = 2) {
    if (!radarCanvas || !radarCtx) return;
    const normalizedDepth = (typeof row === 'number') ? (row / 4.0) : 0.5;
    const distanceRadius = Math.max(26, Math.min(canvasH * 0.88, canvasH * (0.24 + (1 - normalizedDepth) * 0.62)));
    const angleRad = (pan * 0.95) * (Math.PI / 3.75);

    const centerX = canvasW * 0.5;
    const originY = canvasH - 14;

    const rippleX = centerX + Math.sin(angleRad) * distanceRadius;
    const rippleY = originY - Math.cos(angleRad) * distanceRadius;

    ripples.push({
      x: rippleX,
      y: rippleY,
      radius: 4,
      maxRadius: 36 + (1 - normalizedDepth) * 16,
      alpha: 0.95
    });

    if (stageReadout) {
      let panText = 'Center';
      if (pan < -0.15) panText = `L ${Math.round(Math.abs(pan) * 100)}%`;
      else if (pan > 0.15) panText = `R ${Math.round(pan * 100)}%`;
      stageReadout.textContent = `${label} • ${panText}`;
    }

    startRadarLoop();
  }

  // --- 5. KEYBOARD & MOUSE EVENT DISPATCH ---
  const activeKeys = new Set();
  const keyMapElements = new Map();
  document.querySelectorAll('.kb-key').forEach(el => {
    if (el.dataset.code) keyMapElements.set(el.dataset.code, el);
  });

  function playKeyAction(code, isUpstroke = false) {
    if (!audio) return;
    const res = audio.trigger(code, isUpstroke);
    if (res && !isUpstroke) {
      triggerRadar(res.pan, code.replace('Key', ''), res.row);
    }
  }

  // Physical keyboard listeners (works anywhere on page!)
  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

    if (!activeKeys.has(e.code)) {
      activeKeys.add(e.code);
      const keyEl = keyMapElements.get(e.code);
      if (keyEl) keyEl.classList.add('pressed');
      playKeyAction(e.code, false);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (activeKeys.has(e.code)) {
      activeKeys.delete(e.code);
      const keyEl = keyMapElements.get(e.code);
      if (keyEl) keyEl.classList.remove('pressed');
      playKeyAction(e.code, true);
    }
  });

  // On-screen visual keyboard keys
  keyMapElements.forEach((el, code) => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      el.classList.add('pressed');
      playKeyAction(code, false);
    });
    const release = () => {
      el.classList.remove('pressed');
      playKeyAction(code, true);
    };
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release);
  });

  // Mouse click test buttons
  const mLeft = document.getElementById('demoMouseLeft');
  const mMid = document.getElementById('demoMouseMid');
  const mRight = document.getElementById('demoMouseRight');

  if (mLeft) {
    mLeft.addEventListener('mousedown', () => {
      mLeft.classList.add('pressed');
      playKeyAction('MouseLeft');
    });
    mLeft.addEventListener('mouseup', () => mLeft.classList.remove('pressed'));
    mLeft.addEventListener('mouseleave', () => mLeft.classList.remove('pressed'));
  }

  if (mMid) {
    mMid.addEventListener('mousedown', () => {
      mMid.classList.add('pressed');
      playKeyAction('MouseMiddle');
    });
    mMid.addEventListener('mouseup', () => mMid.classList.remove('pressed'));
    mMid.addEventListener('mouseleave', () => mMid.classList.remove('pressed'));
  }

  if (mRight) {
    mRight.addEventListener('mousedown', () => {
      mRight.classList.add('pressed');
      playKeyAction('MouseRight');
    });
    mRight.addEventListener('mouseup', () => mRight.classList.remove('pressed'));
    mRight.addEventListener('mouseleave', () => mRight.classList.remove('pressed'));
  }

  // --- 6. SPATIAL SLIDERS & CONTROLS ---
  const rngWidth = document.getElementById('demoRngWidth');
  const txtWidth = document.getElementById('demoTxtWidth');
  const chkElevation = document.getElementById('demoChkElevation');

  if (rngWidth && txtWidth) {
    rngWidth.addEventListener('input', () => {
      const val = parseInt(rngWidth.value, 10);
      txtWidth.textContent = `${val}%`;
      if (audio) audio.setStereoWidth(val / 100);
    });
  }

  if (chkElevation) {
    chkElevation.addEventListener('change', () => {
      if (audio) audio.setVerticalElevation(chkElevation.checked);
    });
  }
});
