/**
 * Taptap Audio Vault - Asset Packing & Obfuscation Tool
 * Encrypts and bundles raw WAV/MP3 sound files into proprietary .taptap binary containers.
 * 
 * Usage:
 *   node scripts/pack-sounds.js
 */

const fs = require('fs');
const path = require('path');

// Proprietary Vault Magic Header & Cipher Key (Known only to Taptap Engine)
const VAULT_MAGIC = 'TAPTAP_VAULT_V1';
const CIPHER_KEY = Buffer.from('TaptapAcousticVault2026@BespokeLuxuryAudioKey#X9!', 'utf8');

function xorScramble(buffer) {
  const output = Buffer.alloc(buffer.length);
  const keyLen = CIPHER_KEY.length;
  for (let i = 0; i < buffer.length; i++) {
    output[i] = buffer[i] ^ CIPHER_KEY[i % keyLen];
  }
  return output;
}

/**
 * Pack a folder of audio files into a single .taptap vault container
 */
function packDirectoryToVault(inputDir, outputFile) {
  console.log(`[Vault] Packing directory: ${inputDir} -> ${outputFile}`);
  
  if (!fs.existsSync(inputDir)) {
    console.warn(`[Vault] Directory does not exist: ${inputDir}`);
    return;
  }

  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.wav') || f.endsWith('.mp3'));
  if (files.length === 0) {
    console.warn(`[Vault] No audio files found in: ${inputDir}`);
    return;
  }

  const manifest = {};
  const audioChunks = [];
  let currentOffset = 0;

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const rawData = fs.readFileSync(filePath);
    
    // Scramble the raw audio bytes
    const scrambled = xorScramble(rawData);

    manifest[file] = {
      offset: currentOffset,
      length: scrambled.length,
      mime: file.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav'
    };

    audioChunks.push(scrambled);
    currentOffset += scrambled.length;
  }

  // Build Binary Container:
  // [16 bytes: MAGIC] + [4 bytes: Manifest JSON length] + [Manifest JSON] + [Concatenated Audio Blobs]
  const manifestJsonBuffer = Buffer.from(JSON.stringify(manifest), 'utf8');
  const manifestLenBuffer = Buffer.alloc(4);
  manifestLenBuffer.writeUInt32BE(manifestJsonBuffer.length, 0);

  const magicBuffer = Buffer.alloc(16);
  magicBuffer.write(VAULT_MAGIC, 0, 'utf8');

  const combinedPayload = Buffer.concat([
    magicBuffer,
    manifestLenBuffer,
    manifestJsonBuffer,
    ...audioChunks
  ]);

  // Ensure output directory exists
  const outDir = path.dirname(outputFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, combinedPayload);
  console.log(`[Vault] Successfully created: ${outputFile} (${(combinedPayload.length / 1024).toFixed(1)} KB, ${files.length} audio samples embedded)`);
}

/**
 * Pack all mouse sound packs into a single mouse-vault.taptap container
 */
function packMousePacksToVault(mouseBaseDir, outputFile) {
  console.log(`[Vault] Packing mouse sound library from: ${mouseBaseDir}`);
  if (!fs.existsSync(mouseBaseDir)) return;

  const mouseDirs = fs.readdirSync(mouseBaseDir).filter(f => {
    return fs.statSync(path.join(mouseBaseDir, f)).isDirectory();
  });

  const manifest = {};
  const audioChunks = [];
  let currentOffset = 0;

  for (const mDir of mouseDirs) {
    const clickFile = path.join(mouseBaseDir, mDir, 'click.mp3');
    if (fs.existsSync(clickFile)) {
      const rawData = fs.readFileSync(clickFile);
      const scrambled = xorScramble(rawData);

      manifest[mDir] = {
        offset: currentOffset,
        length: scrambled.length,
        mime: 'audio/mpeg'
      };

      audioChunks.push(scrambled);
      currentOffset += scrambled.length;
    }
  }

  const manifestJsonBuffer = Buffer.from(JSON.stringify(manifest), 'utf8');
  const manifestLenBuffer = Buffer.alloc(4);
  manifestLenBuffer.writeUInt32BE(manifestJsonBuffer.length, 0);

  const magicBuffer = Buffer.alloc(16);
  magicBuffer.write(VAULT_MAGIC, 0, 'utf8');

  const combinedPayload = Buffer.concat([
    magicBuffer,
    manifestLenBuffer,
    manifestJsonBuffer,
    ...audioChunks
  ]);

  const outDir = path.dirname(outputFile);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(outputFile, combinedPayload);
  console.log(`[Vault] Successfully created mouse vault: ${outputFile} (${(combinedPayload.length / 1024).toFixed(1)} KB, ${mouseDirs.length} mouse profiles)`);
}

// Execute Packing Workflow
function run() {
  const rootDir = path.resolve(__dirname, '..');
  const soundsDir = path.join(rootDir, 'sounds');
  const packsDir = path.join(rootDir, 'sounds', 'packs');

  console.log('=== Taptap Audio Vault Obfuscation & Packing ===');

  // 1. Pack Keyboard Soundpacks
  const kbDir = path.join(soundsDir, 'keyboard');
  if (fs.existsSync(kbDir)) {
    const packs = ['lofree-flow-2-pulse', 'lofree-flow-2-surfer', 'lofree-flow-2-void'];
    for (const p of packs) {
      packDirectoryToVault(path.join(kbDir, p), path.join(packsDir, `${p}.taptap`));
    }
  }

  // 2. Pack Mouse Soundpacks
  const mouseDir = path.join(soundsDir, 'mouse');
  if (fs.existsSync(mouseDir)) {
    packMousePacksToVault(mouseDir, path.join(packsDir, 'mouse-vault.taptap'));
  }

  console.log('=== Audio Obfuscation Complete! ===');
}

run();
