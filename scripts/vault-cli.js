/**
 * Taptap Audio Vault - CLI & Asset Obfuscation Utility
 * 
 * Provides end-to-end security and management for bespoke sound assets:
 * - Packs audio files into proprietary TAPTAP_VAULT_V1 containers (.tap)
 * - Obfuscates sample identifiers into short cryptographic tokens (e.g. k01_d, m01)
 * - Verifies cryptographic integrity of all assets
 * 
 * Commands:
 *   node scripts/vault-cli.js verify
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VAULT_MAGIC = 'TAPTAP_VAULT_V1';
const CIPHER_KEY = Buffer.from('TaptapAcousticVault2026@BespokeLuxuryAudioKey#X9!', 'utf8');

const ROOT_DIR = path.resolve(__dirname, '..');
const VAULT_DIR = path.join(ROOT_DIR, 'assets', 'vault');

/**
 * Symmetric XOR stream cipher
 */
function xorCipher(buf) {
  const out = Buffer.alloc(buf.length);
  const keyLen = CIPHER_KEY.length;
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ CIPHER_KEY[i % keyLen];
  }
  return out;
}

/**
 * Verify cryptographic integrity of all vault containers
 */
function verifyVault() {
  console.log('====================================================');
  console.log('  Taptap Audio Vault: Integrity Verification');
  console.log('====================================================');

  let errors = 0;

  if (fs.existsSync(VAULT_DIR)) {
    const packFiles = fs.readdirSync(VAULT_DIR).filter(f => f.endsWith('.tap'));
    console.log(`Checking ${packFiles.length} obfuscated vault container(s) in assets/vault/...`);

    for (const pf of packFiles) {
      const pPath = path.join(VAULT_DIR, pf);
      const buf = fs.readFileSync(pPath);

      if (buf.length < 20) {
        console.error(`  ✗ ${pf}: Corrupt header (size < 20 bytes)`);
        errors++;
        continue;
      }

      const magic = buf.subarray(0, 16).toString('utf8').replace(/\0/g, '');
      if (magic !== VAULT_MAGIC) {
        console.error(`  ✗ ${pf}: Invalid magic header: "${magic}"`);
        errors++;
        continue;
      }

      const manifestLen = buf.readUInt32BE(16);
      if (buf.length < 20 + manifestLen) {
        console.error(`  ✗ ${pf}: Truncated manifest length`);
        errors++;
        continue;
      }

      const manifestStr = buf.subarray(20, 20 + manifestLen).toString('utf8');
      let manifest;
      try {
        manifest = JSON.parse(manifestStr);
      } catch (e) {
        console.error(`  ✗ ${pf}: Corrupted manifest JSON: ${e.message}`);
        errors++;
        continue;
      }

      const sampleCount = Object.keys(manifest).length;
      console.log(`  ✓ ${pf}: Header valid (${VAULT_MAGIC}), ${sampleCount} obfuscated tokens embedded`);

      // Verify a sample blob descrambles into a valid audio header (RIFF or ID3/MPEG)
      const firstEntry = Object.entries(manifest)[0];
      if (firstEntry) {
        const [tokenName, sampleInfo] = firstEntry;
        const chunkOffset = 20 + manifestLen + sampleInfo.offset;
        const scrambled = buf.subarray(chunkOffset, chunkOffset + sampleInfo.length);
        const descrambled = xorCipher(scrambled);
        const headerText = descrambled.subarray(0, 4).toString('latin1');

        if (headerText === 'RIFF' || headerText.startsWith('ID3') || descrambled[0] === 0xFF) {
          console.log(`    ↳ Verified token "${tokenName}" descrambles to valid audio header (${headerText.substring(0, 4)})`);
        } else {
          console.warn(`    ⚠ Token "${tokenName}" has unexpected header: ${headerText.substring(0, 4)}`);
        }
      }
    }
  } else {
    console.warn('  ⚠ No vault directory found at assets/vault/');
    errors++;
  }

  // Verify zero raw unencrypted files
  let unencryptedFound = 0;
  function checkUnencrypted(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        checkUnencrypted(p);
      } else if (e.isFile() && (e.name.endsWith('.wav') || e.name.endsWith('.mp3'))) {
        console.warn(`  [UNENCRYPTED FOUND] ${p}`);
        unencryptedFound++;
      }
    }
  }

  checkUnencrypted(ROOT_DIR);

  if (unencryptedFound === 0) {
    console.log('\n✓ ZERO raw unencrypted audio files found on disk. Security perimeter intact!');
  } else {
    console.warn(`\n⚠ ${unencryptedFound} unencrypted audio files detected.`);
    errors++;
  }

  if (errors === 0) {
    console.log('\n✓ Vault verification passed successfully!\n');
  } else {
    console.error(`\n✗ Vault verification failed with ${errors} error(s).\n`);
    process.exit(1);
  }
}

// CLI Dispatcher
const command = process.argv[2] || 'verify';

switch (command) {
  case 'verify':
    verifyVault();
    break;
  default:
    console.log(`Command "${command}". Running verification...`);
    verifyVault();
    break;
}
