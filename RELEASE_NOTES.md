# ✦ Taptap v2.0.0 — Native Rust Engine & 95% Lower Memory Release ✦

Welcome to **Taptap v2.0.0** — our biggest architectural leap yet. Taptap's desktop runtime has been **rebuilt from the ground up in native Rust + Tauri v2**, replacing the Chromium-bundled Electron runtime to cut background memory usage from **`70–100+ MB` down to `~5 MB`** (~95% reduction) and shrink the Windows installer from **`~74.7 MB` down to `4.71 MB`**.

---

### ⚡ Electron (`v1.1.0`) vs. Native Rust (`v2.0.0`) at a Glance

| Metric | Electron (`v1.1.0`) | Native Rust + Tauri (`v2.0.0`) | Improvement |
| :--- | :---: | :---: | :---: |
| **Background Stealth / Tray RAM** | `70 MB – 100+ MB` | **`~5 MB`** | **~95% Less Memory** |
| **Windows Installer Size** | `~74.7 MB` | **`4.71 MB`** | **93.7% Smaller** |
| **Standalone Portable `.exe`** | `~74.4 MB` | **`11.07 MB`** | **85.1% Smaller** |
| **Audio Mixing Engine** | Chromium Web Audio API | **Native Rust `cpal` (WASAPI) + `symphonia`** | **Lock-free, sub-ms latency** |
| **Global Input Capture** | Node `uiohook-napi` + IPC | **Direct Win32 `WH_KEYBOARD_LL` / `WH_MOUSE_LL`** | **Zero IPC overhead in tray** |
| **WebView Lifecycle** | Always resident in RAM | **Destroyed on minimize-to-tray, instant re-open** | **Zero idle browser overhead** |

---

### ✨ What's New in v2.0.0

- **🦀 Native Rust Spatial Audio Engine (`cpal` + `symphonia`)**:
  - Dedicated lock-free 64-voice native WASAPI audio mixer running directly in Rust — zero Chromium or V8 garbage-collection pauses.
  - Full parity with Taptap's signature acoustic modeling: equal-power stereo panning, binaural HRTF interaural time difference (ITD) & head-shadow filtering, vertical keyboard row elevation, and randomized micro-pitch jitter.
  - All **23 encrypted `TAPTAP_VAULT_V1` (`.tap`) soundpacks** (22 mechanical switches + 8 mouse profiles) are embedded directly inside the Rust binary and descrambled in memory on demand.

- **🪶 True ~5 MB Stealth Tray Architecture**:
  - Closing the Taptap window (`×`) completely tears down the WebView2 UI process while keeping the native Rust audio mixer and Win32 hooks active in the Windows System Tray at **~5 MB RAM**.
  - Clicking the tray icon reconstructs the UI window in milliseconds at your exact saved screen coordinates.

- **🪟 Native Win32 Low-Level Input Hooks & Focus Deduplication**:
  - Direct Win32 `WH_KEYBOARD_LL` and `WH_MOUSE_LL` hooks with multi-monitor virtual desktop cursor panning and global <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> mute hotkey.
  - Smart window-focus deduplication prevents double mouse sounds when clicking interactive UI controls while keeping physical typing, virtual keycaps, and the built-in **Typing Test** responsive when focused.

- **🎨 Fixed Borderless DWM Frame & Responsive Luxury UI**:
  - Locked `540 × 650` companion window with native Windows 11 DWM rounded corners (`DWMWCP_ROUND`), immersive dark/maroon frame styling, and zero edge border bleed.
  - Fluid layout across all 4 tabs (*Soundstage*, *Keyboard*, *Mouse*, *Settings*) so every control and *About Taptap* fit cleanly without clipping.
  - Refined compact slider thumbs (`10px–11px`) with label clearance and custom Royal Bordeaux scrollbars.
  - **New Setting — Right-Click Context Menu Toggle**: Disabled by default for a clean native app feel (hiding browser `Inspect` menus), with an instant toggle in **Settings → System** whenever needed.

---

### 📦 Included Release Packages

| File | Type | Size | Description |
| :--- | :---: | :---: | :--- |
| **`Taptap_2.0.0_x64-setup.exe`** | `NSIS Installer` | `4.71 MB` | Native Rust Windows x64 installer with Start Menu integration, clean uninstaller, and Windows startup support. |
| **`Taptap_2.0.0_x64-portable.exe`** | `Portable Binary` | `11.07 MB` | True single-file standalone executable with all 23 encrypted soundpacks statically embedded. Zero installation or extraction required. |

---

### 🔒 Cryptographic Checksums (SHA-256)

```text
A32B761ACB148D9142A8D0A271D2070B77F068DEA8C0428E7256751396B516D5  Taptap_2.0.0_x64-setup.exe
C608E37308A32552E23A882B5D846B03314F3F1DEAFF2245D25E32E56C404AF9  Taptap_2.0.0_x64-portable.exe
```

---

### 🌐 Instant Web Playground

Want to try Taptap in your browser without installing anything?
👉 **[Launch Live Web Demo](https://mightyiest.github.io/taptap/)**

---

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
