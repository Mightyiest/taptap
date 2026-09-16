---
name: taptap-audio-vault
description: Tooling, cryptographic specifications, and operational runbooks to manage, pack, scramble, and descramble Taptap luxury acoustic soundpacks and proprietary .taptap containers.
---

# Taptap Audio Vault Skill

The **Taptap Audio Vault** is a proprietary asset protection and packaging system designed for the **Taptap** spatial audio desktop application. It ensures that bespoke acoustic assets (Lofree Flow 2 mechanical switches and premium gaming mouse clicks) cannot be played, inspected, or ripped by standard media players (VLC, Audacity, Windows Media Player) while providing instant, zero-latency Web Audio decoding in memory.

---

## 1. Cryptographic Specification

- **Vault Header Magic**: `TAPTAP_VAULT_V1` (16 bytes UTF-8 ASCII, null-padded)
- **Master Secret Cipher Key**:
  ```
  TaptapAcousticVault2026@BespokeLuxuryAudioKey#X9!
  ```
- **Encryption Algorithm**: High-throughput symmetric XOR stream cipher with rotating byte indexing:
  ```javascript
  output[i] = input[i] ^ CIPHER_KEY[i % keyLength];
  ```
- **Container Binary Structure (`.taptap`)**:
  ```
  +-----------------------------------------------------------+
  | 16 Bytes: Magic Header ("TAPTAP_VAULT_V1")                |
  +-----------------------------------------------------------+
  | 4 Bytes (UInt32BE): Byte length of Manifest JSON (N)       |
  +-----------------------------------------------------------+
  | N Bytes: Manifest JSON (offsets, sample lengths, mime)    |
  +-----------------------------------------------------------+
  | Concatenated Scrambled Audio Data Blobs (XOR-encrypted)   |
  +-----------------------------------------------------------+
  ```

---

## 2. Directory Layout & File Extension Convention

```
sounds/
├── packs/
│   ├── lofree-flow-2-pulse.taptap     <- Production encrypted keyboard vault
│   ├── lofree-flow-2-surfer.taptap    <- Production encrypted keyboard vault
│   ├── lofree-flow-2-void.taptap      <- Production encrypted keyboard vault
│   └── mouse-vault.taptap             <- Production encrypted mouse vault (8 mice)
├── keyboard/
│   ├── lofree-flow-2-pulse/*.tap.enc  <- Scrambled & token-renamed source samples
│   ├── lofree-flow-2-surfer/*.tap.enc
│   └── lofree-flow-2-void/*.tap.enc
├── mouse/
│   └── <Mouse Model>/click.*.tap.enc  <- Scrambled mouse click samples
└── .vault-index.enc                   <- Master encrypted index (original names & hashes)
```

> [!NOTE]
> All loose files on disk use the `.tap.enc` extension with a 10-character SHA-256 integrity token in the filename (e.g. `alpha_down_01.a0fa431de6.tap.enc`). ZERO unencrypted `.wav` or `.mp3` files exist in the repository.

---

## 3. Vault CLI Operations

All audio vault operations are managed via `scripts/vault-cli.js`.

### A. Packaging Production Vaults
Packs all keyboard sound folders and mouse models into self-contained `.taptap` archives:
```bash
node scripts/vault-cli.js pack
```
- Consolidates 32 samples into a single HTTP request per keyboard pack.
- Builds `mouse-vault.taptap` containing all 8 mouse audio profiles.

### B. Scrambling Loose Source Audio
Encrypts all `.wav` and `.mp3` files, calculates integrity hashes, renames them to `.tap.enc`, updates the encrypted `.vault-index.enc`, and securely deletes raw audio files:
```bash
node scripts/vault-cli.js scramble
```

### C. Unscrambling / Restoring for Audio Editing
Restores all `.tap.enc` files back to readable `.wav` and `.mp3` files when the team or creator needs to add or re-record sound assets:
```bash
node scripts/vault-cli.js unscramble
```
*(After making audio edits, always run `pack` and `scramble` again before committing).*

### D. Cryptographic Verification
Verifies container headers, manifest structures, sample integrity, and checks for any leaked unencrypted audio files:
```bash
node scripts/vault-cli.js verify
```

---

## 4. Web Audio Runtime Integration (`audio-engine.js`)

At runtime in the Electron companion or browser, `TaptapAudioEngine` decrypts audio buffers in RAM in < 2ms without ever touching the disk:

```javascript
descrambleBytes(uint8Array) {
  const output = new Uint8Array(uint8Array.length);
  const keyLen = VAULT_KEY.length;
  for (let i = 0; i < uint8Array.length; i++) {
    output[i] = uint8Array[i] ^ VAULT_KEY[i % keyLen];
  }
  return output.buffer;
}
```

Once descrambled, `ctx.decodeAudioData(rawBuffer)` decodes the PCM data directly into high-performance `AudioBuffer` objects ready for HRTF spatial surround rendering.
