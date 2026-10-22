# ✦ Taptap v1.1.0 — Performance & Sound Library Release ✦

Welcome to **Taptap v1.1.0**, featuring major performance optimizations, comprehensive audio graph leak fixes, reliable Windows startup integration, and an expanded library of 22 verified acoustic switch profiles.

---

### ✨ What's New in v1.1.0

- **🚀 In-Memory Audio Buffer Cache (`packCache`)**:
  - Soundpacks and switch previews now cache decoded `AudioBuffer` objects in memory.
  - Switching between switches or previewing in the library is now instantaneous (0 ms, zero disk I/O, zero CPU re-decode).
  - Eliminates redundant file reading when toggling between favorites.

- **🎹 5 New Switch Profiles (Total 22 Switches)**:
  - *Durock Alpaca V2* (Smooth Linear)
  - *Topre Realforce 45g* (Electro-Capacitive Tactile)
  - *Alps SKCM Blue* (Vintage Tactile Click)
  - *IBM Model M* (Membrane Buckling Spring)
  - *Ticks Mechanical* (Precision Clockwork Novelty)

- **⚡ Fast Zero-Modulo In-Memory XOR Descrambler**:
  - Replaced modulo arithmetic (`% keyLen`) in the cryptographic stream descrambler with an incrementing index counter, achieving **~3–4× faster sample unpacking**.
  - Asynchronous non-blocking file loading via Node `fs.promises.readFile` in Electron.

- **🪟 Windows Startup & Multi-Monitor Fixes**:
  - Added support for `PORTABLE_EXECUTABLE_FILE` so Windows registry autostart (`HKCU\...\Run`) correctly targets the actual portable `.exe` instead of temporary extraction paths.
  - Normalized cursor coordinate mapping across multi-monitor displays so desktop-wide cursor panning no longer clamps prematurely on secondary screens.

- **🧹 Audio Graph Lifecycle & Memory Leak Fix**:
  - Fixed a node leak in Stereo Mode with Vertical Elevation where `BiquadFilterNode` remained attached to `masterGain`.
  - Upgraded node disposal to native Web Audio API `source.onended` cleanup callbacks, removing per-keystroke `setTimeout` timer allocations.
  - Fixed duplicate audio trigger when the app window is focused by gating `uIOhook` background IPC forwarding.
  - Enhanced keycode translation in `buildUiohookKeyMap` for Arrow keys (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`) and punctuation.

- **🏎️ Debounced Settings Persistence**:
  - Slider adjustments (`Width`, `Keyboard Volume`, `Mouse Volume`, `Micro-Pitch Jitter`) now debounce `localStorage` serialization (180ms) rather than writing synchronously on every high-refresh-rate mouse tick.

---

### 📦 Included Release Packages

| File | Type | Size | Description |
| :--- | :---: | :---: | :--- |
| **`Taptap Setup 1.1.0.exe`** | `NSIS Installer` | ~74.7 MB | Full Windows installer with Start Menu & Desktop shortcuts, clean uninstall, and startup registration. |
| **`Taptap 1.1.0.exe`** | `Portable Binary` | ~74.4 MB | Single-file zero-install executable. Runs immediately anywhere on Windows. |

---

### 🔒 Cryptographic Checksums (SHA-256)

```text
2221F06324EECFB32BA8891EA533E61B4AB9F13593FA997ED8816399B3558754  Taptap Setup 1.1.0.exe
DF50F00F7BD9C2405711C0913BCCEBA1711371D045CD16B960603A7E9844DAFF  Taptap 1.1.0.exe
```

---

### 🌐 Instant Web Playground

Want to try Taptap in your browser without installing anything?
👉 **[Launch Live Web Demo](https://mightyiest.github.io/taptap/)**

---

# ✦ Taptap v1.0.0 — The Debut Release ✦

Welcome to the initial official release of **Taptap** — a bespoke spatial surround sound companion that transforms every keystroke and mouse click into a rich, three-dimensional acoustic experience.

### ✨ Highlights & Innovations

- **🌐 3D Binaural HRTF Soundstage**:
  - Dynamically renders acoustic coordinates matching physical key positions across a 3D stereo field.
  - Interactive Soundstage Radar visualizer tracking acoustic trajectory in real-time at 60 FPS.
  - Configurable spatial stereo spread (0%–200%) and Z-axis elevation simulation.

- **⌨️ 17 Curated Luxury Switch Acoustics**:
  - **Linear & Smooth**: *Lofree Flow 2 (Pulse), Lofree Flow 2 (Surfer), Akko Piano Pro, Akko V3 Cream Yellow, Akko CS Jelly Black, Gateron Ink Black, Gateron Ink Red, Gateron Tealios, NovelKeys Cream, Keychron K2 Red*.
  - **Tactile & Thocky**: *Drop Holy Panda, Keychron K2 Brown*.
  - **Crisp Clicky**: *Kailh Box Navy, Akko Clicky Pink*.
  - **Muted & Novelty**: *Lofree Flow 2 (Void), IQUNIX MQ80 Gasket, Lizard Pop*.

- **🖱️ 8 Tactile Mouse Click Profiles**:
  - *Bloody V8, Logitech Superlight, Razer DeathAdder V2 Pro, Glorious Model O, Logitech G203, IntelliMouse Optical, Rapture Venom, Trust GXT 152*.

- **🛡️ Proprietary Cryptographic Acoustic Vault (`.tap`)**:
  - Encrypted `TAPTAP_VAULT_V1` container architecture with symmetric in-memory stream descrambling.
  - Tokenized sample identifiers ensuring zero raw audio exposure.

- **🪟 Desktop Companion & Stealth Mode**:
  - System-wide low-latency input capture via native hardware hooks (`uiohook-napi`).
  - Single-instance process lock preventing duplicate windows and conflicting audio engines.
  - Windows System Tray integration with instant global mute toggle (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd>).

- **🎯 Built-in Typing Test Mini-Game**:
  - Real-time WPM calculation, accuracy tracking, and 3-second countdown timer.
  - Instant tactile and acoustic feedback for practice and switch testing.

- **🎨 Bespoke Beige & Royal Bordeaux Aesthetics**:
  - Frameless glassmorphic interface inspired by luxury Swiss horology and bespoke craftsmanship.
  - Fluid Light & Dark themes with tailored warm alabaster linen and royal bordeaux accents.
