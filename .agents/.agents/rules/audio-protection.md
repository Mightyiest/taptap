---
description: Audio protection and encryption enforcement policy for Taptap acoustic sound assets.
trigger: always_on
---

# Audio Protection Policy for Taptap

1. **Zero Raw Audio Exposure**:
   - Never commit, distribute, or leave unencrypted `.wav` or `.mp3` files in the repository.
   - All audio assets must be packaged as `.taptap` binary containers (`sounds/packs/`) or obfuscated as `.tap.enc` files (`sounds/keyboard/`, `sounds/mouse/`).

2. **Asset Management Operations**:
   - Whenever adding or editing audio files, use the `taptap-audio-vault` skill.
   - Always run `node scripts/vault-cli.js verify` before concluding work.

3. **Master Cipher Integrity**:
   - The cipher key is `TaptapAcousticVault2026@BespokeLuxuryAudioKey#X9!`.
   - Never alter the key or header format without updating both `scripts/vault-cli.js` and `audio-engine.js` simultaneously.
