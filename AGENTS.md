# Antigravity Agent Guidelines for Taptap

Welcome to **Taptap** — the bespoke spatial surround audio companion for mechanical keyboards and mouse clicks.

## Project Structure
- `index.html`: Frameless luxury interface with centered branding, horizontal scroll-snapping carousel, and typing test.
- `styles.css`: Bespoke Beige & Maroon luxury aesthetic, Cinzel serif typography, light/dark themes.
- `audio-engine.js`: Web Audio API spatial surround audio engine with in-memory `.taptap` vault descrambler and HRTF/stereo panning.
- `app.js`: UI controllers, keyboard listener, canvas soundstage radar, typing mini-game with countdown.
- `main.js`: Electron main process with frameless window, system tray stealth mode, and global mute shortcut (`Ctrl+Shift+M`).
- `assets/vault/`: Proprietary `.tap` binary containers containing encrypted and tokenized soundpacks (`vk_pls.tap`, `vk_srf.tap`, `vk_voi.tap`, `vm_all.tap`).
- `scripts/vault-cli.js`: Asset encryption, packing, and unscrambling utility.
- `.agents/skills/taptap-audio-vault/`: Skill documentation for managing and operating the acoustic vault.

## Critical Instructions
- **Audio Asset Protection**: All sound assets are encrypted. NEVER commit or expose unencrypted `.wav` or `.mp3` files.
- **Skill Usage**: Refer to `.agents/skills/taptap-audio-vault/SKILL.md` whenever managing soundpacks.
- **Luxury Theme**: Maintain the Beige & Maroon aesthetic (`Cinzel` and `Plus Jakarta Sans` fonts, warm alabaster linen, royal bordeaux accents).
