<div align="center">

# ✦ T A P T A P ✦

### *Bespoke Spatial Surround Sound Companion for Mechanical Keyboards & Mice*

[![Release](https://img.shields.io/badge/Release-v1.0.0-721825.svg?style=for-the-badge)](https://github.com)
[![Electron](https://img.shields.io/badge/Electron-33.2.0-241917.svg?style=for-the-badge&logo=electron)](https://www.electronjs.org/)
[![Web Audio API](https://img.shields.io/badge/Audio%20Engine-HRTF%203D%20Spatial-a02b3d.svg?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Vault Security](https://img.shields.io/badge/Vault-TAPTAP__VAULT__V1-29151c.svg?style=for-the-badge)](scripts/vault-cli.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-e6dfd3.svg?style=for-the-badge)](LICENSE)

<br />

<p align="center">
  <b>Taptap</b> elevates your daily typing and mouse interactions into a rich, three-dimensional acoustic experience. Engineered with Web Audio API HRTF spatial algorithms, bespoke luxury acoustics, and low-latency system-wide hooks, Taptap delivers authentic mechanical switch reverberation mapped dynamically across your soundstage.
</p>

---

</div>

## ✧ Highlights & Features

- **🌐 3D Binaural Soundstage**: Realistic spatial audio positioning using Web Audio API `PannerNode` with HRTF panning and Z-axis vertical elevation. Every keystroke is dynamically rendered across a 3D stereo acoustic field corresponding to keyboard physical key positions.
- **🛡️ Cryptographic Acoustic Vault (`.tap`)**: Proprietary `TAPTAP_VAULT_V1` container architecture with symmetric in-memory descrambling and tokenized sample indexing. Audio assets remain encrypted with zero raw audio exposure.
- **⌨️ 18+ Curated Luxury Switch Acoustics**: Handcrafted acoustic profiles spanning Linear, Tactile, Clicky, and Muted/Novelty switches, plus high-fidelity tactile mouse clicks.
- **🎨 Bespoke Luxury Aesthetic**: Warm alabaster linen (`#f4f0e6`) and royal bordeaux (`#721825`) palette, Cinzel classical typography, fluid light & dark themes, and a frameless glass-inspired window.
- **⚡ Ultra Low-Latency Native Hooks**: Backed by `uiohook-napi` for global, non-intrusive background key and mouse event interception across any application.
- **🎯 Interactive Typing Test & Soundstage Radar**: Real-time canvas radar visualizer tracking acoustic trajectory, paired with a live typing speed mini-game featuring 3-second countdowns, real-time WPM, accuracy tracking, and acoustic feedback.
- **🪟 Stealth Mode & Tray Integration**: Seamless Windows system tray integration, background execution, and global instant mute toggle (`Ctrl+Shift+M`).

---

## 🏛️ Acoustic Switch Soundpack Library

| Switch Profile | Brand | Category | Acoustic Feel | Sonic Signature | Vault Container |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Lofree Flow 2 (Pulse)** | Lofree | Linear | Smooth POM | Creamy Thock | `vk_pls.tap` |
| **Lofree Flow 2 (Surfer)** | Lofree | Linear | Linear Clean | Clean Linear | `vk_srf.tap` |
| **Lofree Flow 2 (Void)** | Lofree | Muted | Silent Linear | Muted Whispers | `vk_voi.tap` |
| **Akko Piano Pro** | Akko | Linear | Deep Creamy | Creamy Thock | `vk_akko_piano_pro.tap` |
| **Akko V3 Cream Yellow** | Akko | Linear | Thocky Linear | Deep Thock | `vk_akko_cream_yellow.tap` |
| **Akko CS Jelly Black** | Akko | Linear | Deep Clack | Solid Clack | `vk_akko_jelly_black.tap` |
| **Akko Clicky Pink** | Akko | Clicky | Bright Clicky | Bright Pop | `vk_akko_pink.tap` |
| **Gateron Ink Black** | Gateron | Linear | Heavy Smooth | Deep Thock | `vk_gateron_ink_black.tap` |
| **Gateron Ink Red** | Gateron | Linear | Light Smooth | Soft Linear | `vk_gateron_ink_red.tap` |
| **Gateron Tealios** | Gateron | Linear | Crisp Linear | Crisp Smooth | `vk_gateron_tealios.tap` |
| **NovelKeys Cream** | NovelKeys | Linear | POM Cream | Classic Cream | `vk_novelkeys_cream.tap` |
| **Keychron K2 Red** | Keychron | Linear | Standard Linear | Clean Rebound | `vk_keychron_red.tap` |
| **Keychron K2 Brown** | Keychron | Tactile | Gentle Bumpy | Gentle Tactile | `vk_keychron_brown.tap` |
| **Drop Holy Panda** | Drop | Tactile | Snappy Pop | Heavy Thock | `vk_holy_panda.tap` |
| **Kailh Box Navy** | Kailh | Clicky | Thick Clickbar | Deep Click | `vk_kailh_navy.tap` |
| **IQUNIX MQ80** | IQUNIX | Muted | Gasket Thock | Gasket Acoustic | `vk_iqunix_mq80.tap` |
| **Lizard Pop** | Lizard Pop | Novelty | Playful Pop | Bubble Pop | `vk_lizard.tap` |
| **Tactile Mouse Suite** | Taptap | Mouse | Crisp Click | Micro Switch | `vm_all.tap` |

---

## 🎧 Architecture & Signal Pipeline

```
┌────────────────────────────────────────────────────────┐
│               Global System-Wide Input                 │
│         (Keyboard & Mouse via uiohook-napi)            │
└───────────────────────────┬────────────────────────────┘
                            │ (Low-latency IPC)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Taptap Electron Renderer                 │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │             Acoustic Vault Descrambler           │  │
│  │   • In-Memory XOR Cipher Stream                  │  │
│  │   • Tokenized Sample Hash Lookup                 │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           │                             │
│                           ▼                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Web Audio API Spatial Engine           │  │
│  │   • HRTF Spatial Panner (X/Y/Z Coordinates)      │  │
│  │   • Dynamic Stereo Spread & Micro-Pitch Variance │  │
│  │   • Gain Normalization & Anti-Clipping Limiter   │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           │                             │
│                           ▼                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │               Soundstage Radar Visualizer        │  │
│  │   • 60 FPS HTML5 Canvas Coordinate Renderer      │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
           [ 3D Binaural Spatial Audio Output ]
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18.0 or higher recommended)
- `npm` (bundled with Node.js)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/taptap.git
   cd taptap
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Launch Taptap in Development Mode:**
   ```bash
   npm start
   ```

---

## 📦 Building & Distribution

Compile standalone production installers and portable binaries using `electron-builder`:

```bash
# Build complete Windows distribution (NSIS Installer + Portable)
npm run dist

# Build NSIS Setup Installer only
npm run dist:nsis

# Build Single-File Portable Executable only
npm run dist:portable
```

Built executables and installation packages will be placed into the `dist/` directory.

---

## 🔒 Acoustic Vault CLI Utilities

Taptap includes a built-in cryptographic asset manager:

```bash
# Verify integrity of all encrypted sound containers and security perimeter
npm run vault:verify

# Pack raw sound directories into .tap binary containers
npm run vault:pack
```

> [!NOTE]
> **Audio Protection Notice**: All audio samples are tokenized and protected inside proprietary `.tap` containers. Raw audio files (`.wav`, `.mp3`) are strictly excluded from version control to protect asset provenance.

---

## ⌨️ Global Shortcuts & Controls

| Shortcut / Control | Function |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> | Global Toggle Mute / Unmute |
| <kbd>Window Close [✕]</kbd> | Minimizes smoothly to System Tray |
| <kbd>Tray Double-Click</kbd> | Restores Taptap window to focus |
| <kbd>Spatial Spread Slider</kbd> | Adjusts binaural stereo separation width (0% – 200%) |
| <kbd>Elevation Toggle</kbd> | Enables 3D vertical soundstage acoustics (Z-axis) |

---

## 📁 Repository Structure

```
Taptap/
├── .agents/                 # AI Agent guidelines and audio protection rules
├── assets/
│   ├── brands/              # High-resolution brand and manufacturer badges
│   ├── vault/               # Encrypted .tap binary soundpack containers
│   ├── icon.ico             # Windows application icon
│   └── icon.png             # Application logo
├── scripts/
│   ├── pack-sounds.js       # Vault packager
│   └── vault-cli.js         # Vault verification and encryption CLI
├── app.js                   # UI controllers, radar canvas, typing test engine
├── audio-engine.js          # Web Audio API spatial engine and vault descrambler
├── main.js                  # Electron main process, tray, frameless IPC
├── index.html               # Luxury frameless application interface
├── styles.css               # Luxury Beige & Maroon design system & themes
├── package.json             # Project metadata, build specs, dependencies
└── README.md                # Project documentation
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Crafted with meticulous attention to acoustic fidelity and bespoke design.</sub>
</div>
