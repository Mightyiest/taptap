/**
 * Taptap - Spatial Audio Engine (Apple / Luxury Edition)
 * Features:
 * - Proprietary TAPTAP_VAULT_V1 Encrypted Audio Container Loader
 * - In-memory XOR descrambler for .taptap soundpack archives
 * - Dynamic cursor-tracking mouse panning
 * - Downstroke & Upstroke playback
 * - Web Audio API HRTF 3D spatial panning & Stereo panning
 * - Micro-pitch randomization
 */

const VAULT_MAGIC = 'TAPTAP_VAULT_V1';
const VAULT_KEY = new TextEncoder().encode('TaptapAcousticVault2026@BespokeLuxuryAudioKey#X9!');

// Curated Registry of 17 Acoustic Mechanical Keyboard Switches
const KEYBOARD_SWITCHES = [
  // Linear
  { id: 'pulse', name: 'Lofree Flow 2 (Pulse)', brand: 'lofree', brandName: 'Lofree', brandIcon: 'assets/brands/lofree.png', feel: 'Smooth POM', category: 'linear', tag: 'Linear', sound: 'Creamy Thock', file: 'vk_pls.tap' },
  { id: 'surfer', name: 'Lofree Flow 2 (Surfer)', brand: 'lofree', brandName: 'Lofree', brandIcon: 'assets/brands/lofree.png', feel: 'Linear Clean', category: 'linear', tag: 'Linear', sound: 'Clean Linear', file: 'vk_srf.tap' },
  { id: 'akko-piano-pro', name: 'Akko Piano Pro', brand: 'akko', brandName: 'Akko', brandIcon: 'assets/brands/akko.png', feel: 'Deep Creamy', category: 'linear', tag: 'Linear', sound: 'Creamy Thock', file: 'vk_akko_piano_pro.tap' },
  { id: 'akko-v3-pro-cream-yellow', name: 'Akko V3 Cream Yellow', brand: 'akko', brandName: 'Akko', brandIcon: 'assets/brands/akko.png', feel: 'Thocky Linear', category: 'linear', tag: 'Linear', sound: 'Deep Thock', file: 'vk_akko_cream_yellow.tap' },
  { id: 'akko-cs-jelly-black', name: 'Akko CS Jelly Black', brand: 'akko', brandName: 'Akko', brandIcon: 'assets/brands/akko.png', feel: 'Deep Clack', category: 'linear', tag: 'Linear', sound: 'Solid Clack', file: 'vk_akko_jelly_black.tap' },
  { id: 'gateron-ink-black', name: 'Gateron Ink Black', brand: 'gateron', brandName: 'Gateron', brandIcon: 'assets/brands/gateron.png', feel: 'Heavy Smooth', category: 'linear', tag: 'Linear', sound: 'Deep Thock', file: 'vk_gateron_ink_black.tap' },
  { id: 'gateron-ink-red', name: 'Gateron Ink Red', brand: 'gateron', brandName: 'Gateron', brandIcon: 'assets/brands/gateron.png', feel: 'Light Smooth', category: 'linear', tag: 'Linear', sound: 'Soft Linear', file: 'vk_gateron_ink_red.tap' },
  { id: 'gateron-turquoise-tealios', name: 'Gateron Tealios', brand: 'gateron', brandName: 'Gateron', brandIcon: 'assets/brands/gateron.png', feel: 'Crisp Linear', category: 'linear', tag: 'Linear', sound: 'Crisp Smooth', file: 'vk_gateron_tealios.tap' },
  { id: 'novelkeys-cream', name: 'NovelKeys Cream', brand: 'novelkeys', brandName: 'NovelKeys', brandIcon: 'assets/brands/novelkeys.webp', feel: 'POM Cream', category: 'linear', tag: 'Linear', sound: 'Classic Cream', file: 'vk_novelkeys_cream.tap' },
  { id: 'keychron-k2-max-red', name: 'Keychron K2 Red', brand: 'keychron', brandName: 'Keychron', brandIcon: 'assets/brands/keychron.png', feel: 'Standard Linear', category: 'linear', tag: 'Linear', sound: 'Clean Rebound', file: 'vk_keychron_red.tap' },

  // Tactile
  { id: 'drop-holy-panda', name: 'Drop Holy Panda', brand: 'drop', brandName: 'Drop', brandIcon: 'assets/brands/drop.png', feel: 'Snappy Pop', category: 'tactile', tag: 'Tactile', sound: 'Heavy Thock', file: 'vk_holy_panda.tap' },
  { id: 'keychron-k2-max-brown', name: 'Keychron K2 Brown', brand: 'keychron', brandName: 'Keychron', brandIcon: 'assets/brands/keychron.png', feel: 'Gentle Bumpy', category: 'tactile', tag: 'Tactile', sound: 'Gentle Tactile', file: 'vk_keychron_brown.tap' },

  // Clicky
  { id: 'kailh-box-navy', name: 'Kailh Box Navy', brand: 'kailh', brandName: 'Kailh', brandIcon: 'assets/brands/kailh.jpg', feel: 'Thick Clickbar', category: 'clicky', tag: 'Clicky', sound: 'Deep Click', file: 'vk_kailh_navy.tap' },
  { id: 'akko-clicky-pink', name: 'Akko Clicky Pink', brand: 'akko', brandName: 'Akko', brandIcon: 'assets/brands/akko.png', feel: 'Bright Clicky', category: 'clicky', tag: 'Clicky', sound: 'Bright Pop', file: 'vk_akko_pink.tap' },

  // Muted & Novelty
  { id: 'void', name: 'Lofree Flow 2 (Void)', brand: 'lofree', brandName: 'Lofree', brandIcon: 'assets/brands/lofree.png', feel: 'Silent Linear', category: 'novelty', tag: 'Muted', sound: 'Muted Whispers', file: 'vk_voi.tap' },
  { id: 'iqunix-mq80', name: 'IQUNIX MQ80', brand: 'iqunix', brandName: 'IQUNIX', brandIcon: 'assets/brands/IQUNIX.png', feel: 'Gasket Thock', category: 'novelty', tag: 'Muted', sound: 'Gasket Acoustic', file: 'vk_iqunix_mq80.tap' },
  { id: 'lizard', name: 'Lizard Pop', brand: 'lizard', brandName: 'Lizard Pop', brandIcon: 'assets/brands/lizard.jpg', feel: 'Playful Pop', category: 'novelty', tag: 'Novelty', sound: 'Bubble Pop', file: 'vk_lizard.tap' }
];

// Curated Keyboard Layout Registry
const KEYBOARD_LAYOUTS = {
  'ansi-68': {
    id: 'ansi-68',
    name: 'ANSI 65% (68-Key)',
    tag: '65% Standard',
    desc: 'Esc top-left, `~ top-right, arrows cluster, 68 keys',
    rows: [
      // Row 0 (16u)
      [
        { code: 'Escape', label: 'esc', u: 1.0, w: 'w-10' },
        { code: 'Digit1', label: '1', u: 1.0 },
        { code: 'Digit2', label: '2', u: 1.0 },
        { code: 'Digit3', label: '3', u: 1.0 },
        { code: 'Digit4', label: '4', u: 1.0 },
        { code: 'Digit5', label: '5', u: 1.0 },
        { code: 'Digit6', label: '6', u: 1.0 },
        { code: 'Digit7', label: '7', u: 1.0 },
        { code: 'Digit8', label: '8', u: 1.0 },
        { code: 'Digit9', label: '9', u: 1.0 },
        { code: 'Digit0', label: '0', u: 1.0 },
        { code: 'Minus', label: '-', u: 1.0 },
        { code: 'Equal', label: '=', u: 1.0 },
        { code: 'Backspace', label: 'backspace', u: 2.0, w: 'w-20' },
        { code: 'Backquote', label: '` ~', u: 1.0, w: 'w-10' }
      ],
      // Row 1 (16u)
      [
        { code: 'Tab', label: 'tab', u: 1.5, w: 'w-15' },
        { code: 'KeyQ', label: 'Q', u: 1.0 },
        { code: 'KeyW', label: 'W', u: 1.0 },
        { code: 'KeyE', label: 'E', u: 1.0 },
        { code: 'KeyR', label: 'R', u: 1.0 },
        { code: 'KeyT', label: 'T', u: 1.0 },
        { code: 'KeyY', label: 'Y', u: 1.0 },
        { code: 'KeyU', label: 'U', u: 1.0 },
        { code: 'KeyI', label: 'I', u: 1.0 },
        { code: 'KeyO', label: 'O', u: 1.0 },
        { code: 'KeyP', label: 'P', u: 1.0 },
        { code: 'BracketLeft', label: '[', u: 1.0 },
        { code: 'BracketRight', label: ']', u: 1.0 },
        { code: 'Backslash', label: '\\', u: 1.5, w: 'w-15' },
        { code: 'PageUp', label: 'pgup', u: 1.0, w: 'w-10' }
      ],
      // Row 2 (16u)
      [
        { code: 'CapsLock', label: 'caps', u: 1.75, w: 'w-175' },
        { code: 'KeyA', label: 'A', u: 1.0 },
        { code: 'KeyS', label: 'S', u: 1.0 },
        { code: 'KeyD', label: 'D', u: 1.0 },
        { code: 'KeyF', label: 'F', u: 1.0 },
        { code: 'KeyG', label: 'G', u: 1.0 },
        { code: 'KeyH', label: 'H', u: 1.0 },
        { code: 'KeyJ', label: 'J', u: 1.0 },
        { code: 'KeyK', label: 'K', u: 1.0 },
        { code: 'KeyL', label: 'L', u: 1.0 },
        { code: 'Semicolon', label: ';', u: 1.0 },
        { code: 'Quote', label: "'", u: 1.0 },
        { code: 'Enter', label: 'enter', u: 2.25, w: 'w-225' },
        { code: 'PageDown', label: 'pgdn', u: 1.0, w: 'w-10' }
      ],
      // Row 3 (16u)
      [
        { code: 'ShiftLeft', label: 'shift', u: 2.25, w: 'w-225' },
        { code: 'KeyZ', label: 'Z', u: 1.0 },
        { code: 'KeyX', label: 'X', u: 1.0 },
        { code: 'KeyC', label: 'C', u: 1.0 },
        { code: 'KeyV', label: 'V', u: 1.0 },
        { code: 'KeyB', label: 'B', u: 1.0 },
        { code: 'KeyN', label: 'N', u: 1.0 },
        { code: 'KeyM', label: 'M', u: 1.0 },
        { code: 'Comma', label: ',', u: 1.0 },
        { code: 'Period', label: '.', u: 1.0 },
        { code: 'Slash', label: '/', u: 1.0 },
        { code: 'ShiftRight', label: 'shift', u: 1.75, w: 'w-175' },
        { code: 'ArrowUp', label: '▲', u: 1.0, w: 'w-10' },
        { code: 'Delete', label: 'del', u: 1.0, w: 'w-10' }
      ],
      // Row 4 (16u)
      [
        { code: 'ControlLeft', label: 'ctrl', u: 1.25, w: 'w-12' },
        { code: 'MetaLeft', label: 'win', u: 1.25, w: 'w-12' },
        { code: 'AltLeft', label: 'alt', u: 1.25, w: 'w-12' },
        { code: 'Space', label: 'space', u: 6.25, w: 'w-space-65' },
        { code: 'AltRight', label: 'alt', u: 1.0, w: 'w-10' },
        { code: 'Fn', label: 'fn', u: 1.0, w: 'w-10' },
        { code: 'ControlRight', label: 'ctrl', u: 1.0, w: 'w-10' },
        { code: 'ArrowLeft', label: '◀', u: 1.0, w: 'w-10' },
        { code: 'ArrowDown', label: '▼', u: 1.0, w: 'w-10' },
        { code: 'ArrowRight', label: '▶', u: 1.0, w: 'w-10' }
      ]
    ]
  },
  'ansi-60': {
    id: 'ansi-60',
    name: 'ANSI 60% (61-Key)',
    tag: '60% Ultra-Compact',
    desc: '`~ top-left, no dedicated arrow keys, 61 keys',
    rows: [
      // Row 0 (15u)
      [
        { code: 'Backquote', label: '` ~', u: 1.0, w: 'w-10' },
        { code: 'Digit1', label: '1', u: 1.0 },
        { code: 'Digit2', label: '2', u: 1.0 },
        { code: 'Digit3', label: '3', u: 1.0 },
        { code: 'Digit4', label: '4', u: 1.0 },
        { code: 'Digit5', label: '5', u: 1.0 },
        { code: 'Digit6', label: '6', u: 1.0 },
        { code: 'Digit7', label: '7', u: 1.0 },
        { code: 'Digit8', label: '8', u: 1.0 },
        { code: 'Digit9', label: '9', u: 1.0 },
        { code: 'Digit0', label: '0', u: 1.0 },
        { code: 'Minus', label: '-', u: 1.0 },
        { code: 'Equal', label: '=', u: 1.0 },
        { code: 'Backspace', label: 'backspace', u: 2.0, w: 'w-20' }
      ],
      // Row 1 (15u)
      [
        { code: 'Tab', label: 'tab', u: 1.5, w: 'w-15' },
        { code: 'KeyQ', label: 'Q', u: 1.0 },
        { code: 'KeyW', label: 'W', u: 1.0 },
        { code: 'KeyE', label: 'E', u: 1.0 },
        { code: 'KeyR', label: 'R', u: 1.0 },
        { code: 'KeyT', label: 'T', u: 1.0 },
        { code: 'KeyY', label: 'Y', u: 1.0 },
        { code: 'KeyU', label: 'U', u: 1.0 },
        { code: 'KeyI', label: 'I', u: 1.0 },
        { code: 'KeyO', label: 'O', u: 1.0 },
        { code: 'KeyP', label: 'P', u: 1.0 },
        { code: 'BracketLeft', label: '[', u: 1.0 },
        { code: 'BracketRight', label: ']', u: 1.0 },
        { code: 'Backslash', label: '\\', u: 1.5, w: 'w-15' }
      ],
      // Row 2 (15u)
      [
        { code: 'CapsLock', label: 'caps', u: 1.75, w: 'w-175' },
        { code: 'KeyA', label: 'A', u: 1.0 },
        { code: 'KeyS', label: 'S', u: 1.0 },
        { code: 'KeyD', label: 'D', u: 1.0 },
        { code: 'KeyF', label: 'F', u: 1.0 },
        { code: 'KeyG', label: 'G', u: 1.0 },
        { code: 'KeyH', label: 'H', u: 1.0 },
        { code: 'KeyJ', label: 'J', u: 1.0 },
        { code: 'KeyK', label: 'K', u: 1.0 },
        { code: 'KeyL', label: 'L', u: 1.0 },
        { code: 'Semicolon', label: ';', u: 1.0 },
        { code: 'Quote', label: "'", u: 1.0 },
        { code: 'Enter', label: 'enter', u: 2.25, w: 'w-225' }
      ],
      // Row 3 (15u)
      [
        { code: 'ShiftLeft', label: 'shift', u: 2.25, w: 'w-225' },
        { code: 'KeyZ', label: 'Z', u: 1.0 },
        { code: 'KeyX', label: 'X', u: 1.0 },
        { code: 'KeyC', label: 'C', u: 1.0 },
        { code: 'KeyV', label: 'V', u: 1.0 },
        { code: 'KeyB', label: 'B', u: 1.0 },
        { code: 'KeyN', label: 'N', u: 1.0 },
        { code: 'KeyM', label: 'M', u: 1.0 },
        { code: 'Comma', label: ',', u: 1.0 },
        { code: 'Period', label: '.', u: 1.0 },
        { code: 'Slash', label: '/', u: 1.0 },
        { code: 'ShiftRight', label: 'shift', u: 2.75, w: 'w-275' }
      ],
      // Row 4 (15u)
      [
        { code: 'ControlLeft', label: 'ctrl', u: 1.25, w: 'w-12' },
        { code: 'MetaLeft', label: 'win', u: 1.25, w: 'w-12' },
        { code: 'AltLeft', label: 'alt', u: 1.25, w: 'w-12' },
        { code: 'Space', label: 'space', u: 6.25, w: 'w-space-60' },
        { code: 'AltRight', label: 'alt', u: 1.25, w: 'w-12' },
        { code: 'MetaRight', label: 'win', u: 1.25, w: 'w-12' },
        { code: 'Fn', label: 'fn', u: 1.25, w: 'w-12' },
        { code: 'ControlRight', label: 'ctrl', u: 1.25, w: 'w-12' }
      ]
    ]
  },
  'ansi-75': {
    id: 'ansi-75',
    name: 'ANSI 75% (84-Key)',
    tag: '75% Compact',
    desc: 'Dedicated F-row, arrow cluster & nav column, 84 keys',
    rows: [
      // Row 0 (16u - F-Row)
      [
        { code: 'Escape', label: 'esc', u: 1.0, w: 'w-10' },
        { code: 'F1', label: 'F1', u: 1.0 },
        { code: 'F2', label: 'F2', u: 1.0 },
        { code: 'F3', label: 'F3', u: 1.0 },
        { code: 'F4', label: 'F4', u: 1.0 },
        { code: 'F5', label: 'F5', u: 1.0 },
        { code: 'F6', label: 'F6', u: 1.0 },
        { code: 'F7', label: 'F7', u: 1.0 },
        { code: 'F8', label: 'F8', u: 1.0 },
        { code: 'F9', label: 'F9', u: 1.0 },
        { code: 'F10', label: 'F10', u: 1.0 },
        { code: 'F11', label: 'F11', u: 1.0 },
        { code: 'F12', label: 'F12', u: 1.0 },
        { code: 'PrintScreen', label: 'prt', u: 1.0, w: 'w-10' },
        { code: 'Pause', label: 'pause', u: 1.0, w: 'w-10' },
        { code: 'Delete', label: 'del', u: 1.0, w: 'w-10' }
      ],
      // Row 1 (16u - Number Row)
      [
        { code: 'Backquote', label: '` ~', u: 1.0, w: 'w-10' },
        { code: 'Digit1', label: '1', u: 1.0 },
        { code: 'Digit2', label: '2', u: 1.0 },
        { code: 'Digit3', label: '3', u: 1.0 },
        { code: 'Digit4', label: '4', u: 1.0 },
        { code: 'Digit5', label: '5', u: 1.0 },
        { code: 'Digit6', label: '6', u: 1.0 },
        { code: 'Digit7', label: '7', u: 1.0 },
        { code: 'Digit8', label: '8', u: 1.0 },
        { code: 'Digit9', label: '9', u: 1.0 },
        { code: 'Digit0', label: '0', u: 1.0 },
        { code: 'Minus', label: '-', u: 1.0 },
        { code: 'Equal', label: '=', u: 1.0 },
        { code: 'Backspace', label: 'backspace', u: 2.0, w: 'w-20' },
        { code: 'Home', label: 'home', u: 1.0, w: 'w-10' }
      ],
      // Row 2 (16u)
      [
        { code: 'Tab', label: 'tab', u: 1.5, w: 'w-15' },
        { code: 'KeyQ', label: 'Q', u: 1.0 },
        { code: 'KeyW', label: 'W', u: 1.0 },
        { code: 'KeyE', label: 'E', u: 1.0 },
        { code: 'KeyR', label: 'R', u: 1.0 },
        { code: 'KeyT', label: 'T', u: 1.0 },
        { code: 'KeyY', label: 'Y', u: 1.0 },
        { code: 'KeyU', label: 'U', u: 1.0 },
        { code: 'KeyI', label: 'I', u: 1.0 },
        { code: 'KeyO', label: 'O', u: 1.0 },
        { code: 'KeyP', label: 'P', u: 1.0 },
        { code: 'BracketLeft', label: '[', u: 1.0 },
        { code: 'BracketRight', label: ']', u: 1.0 },
        { code: 'Backslash', label: '\\', u: 1.5, w: 'w-15' },
        { code: 'PageUp', label: 'pgup', u: 1.0, w: 'w-10' }
      ],
      // Row 3 (16u)
      [
        { code: 'CapsLock', label: 'caps', u: 1.75, w: 'w-175' },
        { code: 'KeyA', label: 'A', u: 1.0 },
        { code: 'KeyS', label: 'S', u: 1.0 },
        { code: 'KeyD', label: 'D', u: 1.0 },
        { code: 'KeyF', label: 'F', u: 1.0 },
        { code: 'KeyG', label: 'G', u: 1.0 },
        { code: 'KeyH', label: 'H', u: 1.0 },
        { code: 'KeyJ', label: 'J', u: 1.0 },
        { code: 'KeyK', label: 'K', u: 1.0 },
        { code: 'KeyL', label: 'L', u: 1.0 },
        { code: 'Semicolon', label: ';', u: 1.0 },
        { code: 'Quote', label: "'", u: 1.0 },
        { code: 'Enter', label: 'enter', u: 2.25, w: 'w-225' },
        { code: 'PageDown', label: 'pgdn', u: 1.0, w: 'w-10' }
      ],
      // Row 4 (16u)
      [
        { code: 'ShiftLeft', label: 'shift', u: 2.25, w: 'w-225' },
        { code: 'KeyZ', label: 'Z', u: 1.0 },
        { code: 'KeyX', label: 'X', u: 1.0 },
        { code: 'KeyC', label: 'C', u: 1.0 },
        { code: 'KeyV', label: 'V', u: 1.0 },
        { code: 'KeyB', label: 'B', u: 1.0 },
        { code: 'KeyN', label: 'N', u: 1.0 },
        { code: 'KeyM', label: 'M', u: 1.0 },
        { code: 'Comma', label: ',', u: 1.0 },
        { code: 'Period', label: '.', u: 1.0 },
        { code: 'Slash', label: '/', u: 1.0 },
        { code: 'ShiftRight', label: 'shift', u: 1.75, w: 'w-175' },
        { code: 'ArrowUp', label: '▲', u: 1.0, w: 'w-10' },
        { code: 'End', label: 'end', u: 1.0, w: 'w-10' }
      ],
      // Row 5 (16u)
      [
        { code: 'ControlLeft', label: 'ctrl', u: 1.25, w: 'w-12' },
        { code: 'MetaLeft', label: 'win', u: 1.25, w: 'w-12' },
        { code: 'AltLeft', label: 'alt', u: 1.25, w: 'w-12' },
        { code: 'Space', label: 'space', u: 6.25, w: 'w-space-65' },
        { code: 'AltRight', label: 'alt', u: 1.0, w: 'w-10' },
        { code: 'Fn', label: 'fn', u: 1.0, w: 'w-10' },
        { code: 'ControlRight', label: 'ctrl', u: 1.0, w: 'w-10' },
        { code: 'ArrowLeft', label: '◀', u: 1.0, w: 'w-10' },
        { code: 'ArrowDown', label: '▼', u: 1.0, w: 'w-10' },
        { code: 'ArrowRight', label: '▶', u: 1.0, w: 'w-10' }
      ]
    ]
  },
  'apple-65': {
    id: 'apple-65',
    name: 'Apple Mac 65%',
    tag: 'macOS Layout',
    desc: 'Cmd/Opt modifiers, Esc top-left, `~ top-right, 68 keys',
    rows: [
      // Row 0 (16u)
      [
        { code: 'Escape', label: 'esc', u: 1.0, w: 'w-10' },
        { code: 'Digit1', label: '1', u: 1.0 },
        { code: 'Digit2', label: '2', u: 1.0 },
        { code: 'Digit3', label: '3', u: 1.0 },
        { code: 'Digit4', label: '4', u: 1.0 },
        { code: 'Digit5', label: '5', u: 1.0 },
        { code: 'Digit6', label: '6', u: 1.0 },
        { code: 'Digit7', label: '7', u: 1.0 },
        { code: 'Digit8', label: '8', u: 1.0 },
        { code: 'Digit9', label: '9', u: 1.0 },
        { code: 'Digit0', label: '0', u: 1.0 },
        { code: 'Minus', label: '-', u: 1.0 },
        { code: 'Equal', label: '=', u: 1.0 },
        { code: 'Backspace', label: 'delete', u: 2.0, w: 'w-20' },
        { code: 'Backquote', label: '` ~', u: 1.0, w: 'w-10' }
      ],
      // Row 1 (16u)
      [
        { code: 'Tab', label: 'tab', u: 1.5, w: 'w-15' },
        { code: 'KeyQ', label: 'Q', u: 1.0 },
        { code: 'KeyW', label: 'W', u: 1.0 },
        { code: 'KeyE', label: 'E', u: 1.0 },
        { code: 'KeyR', label: 'R', u: 1.0 },
        { code: 'KeyT', label: 'T', u: 1.0 },
        { code: 'KeyY', label: 'Y', u: 1.0 },
        { code: 'KeyU', label: 'U', u: 1.0 },
        { code: 'KeyI', label: 'I', u: 1.0 },
        { code: 'KeyO', label: 'O', u: 1.0 },
        { code: 'KeyP', label: 'P', u: 1.0 },
        { code: 'BracketLeft', label: '[', u: 1.0 },
        { code: 'BracketRight', label: ']', u: 1.0 },
        { code: 'Backslash', label: '\\', u: 1.5, w: 'w-15' },
        { code: 'PageUp', label: 'pgup', u: 1.0, w: 'w-10' }
      ],
      // Row 2 (16u)
      [
        { code: 'CapsLock', label: 'caps lock', u: 1.75, w: 'w-175' },
        { code: 'KeyA', label: 'A', u: 1.0 },
        { code: 'KeyS', label: 'S', u: 1.0 },
        { code: 'KeyD', label: 'D', u: 1.0 },
        { code: 'KeyF', label: 'F', u: 1.0 },
        { code: 'KeyG', label: 'G', u: 1.0 },
        { code: 'KeyH', label: 'H', u: 1.0 },
        { code: 'KeyJ', label: 'J', u: 1.0 },
        { code: 'KeyK', label: 'K', u: 1.0 },
        { code: 'KeyL', label: 'L', u: 1.0 },
        { code: 'Semicolon', label: ';', u: 1.0 },
        { code: 'Quote', label: "'", u: 1.0 },
        { code: 'Enter', label: 'return', u: 2.25, w: 'w-225' },
        { code: 'PageDown', label: 'pgdn', u: 1.0, w: 'w-10' }
      ],
      // Row 3 (16u)
      [
        { code: 'ShiftLeft', label: 'shift', u: 2.25, w: 'w-225' },
        { code: 'KeyZ', label: 'Z', u: 1.0 },
        { code: 'KeyX', label: 'X', u: 1.0 },
        { code: 'KeyC', label: 'C', u: 1.0 },
        { code: 'KeyV', label: 'V', u: 1.0 },
        { code: 'KeyB', label: 'B', u: 1.0 },
        { code: 'KeyN', label: 'N', u: 1.0 },
        { code: 'KeyM', label: 'M', u: 1.0 },
        { code: 'Comma', label: ',', u: 1.0 },
        { code: 'Period', label: '.', u: 1.0 },
        { code: 'Slash', label: '/', u: 1.0 },
        { code: 'ShiftRight', label: 'shift', u: 1.75, w: 'w-175' },
        { code: 'ArrowUp', label: '▲', u: 1.0, w: 'w-10' },
        { code: 'Delete', label: 'f-del', u: 1.0, w: 'w-10' }
      ],
      // Row 4 (16u)
      [
        { code: 'ControlLeft', label: 'control', u: 1.25, w: 'w-12' },
        { code: 'AltLeft', label: 'option', u: 1.25, w: 'w-12' },
        { code: 'MetaLeft', label: 'command', u: 1.25, w: 'w-12' },
        { code: 'Space', label: 'space', u: 6.25, w: 'w-space-65' },
        { code: 'MetaRight', label: 'command', u: 1.0, w: 'w-10' },
        { code: 'AltRight', label: 'option', u: 1.0, w: 'w-10' },
        { code: 'Fn', label: 'fn', u: 1.0, w: 'w-10' },
        { code: 'ArrowLeft', label: '◀', u: 1.0, w: 'w-10' },
        { code: 'ArrowDown', label: '▼', u: 1.0, w: 'w-10' },
        { code: 'ArrowRight', label: '▶', u: 1.0, w: 'w-10' }
      ]
    ]
  }
};

/**
 * Computes exact physical normalized pan (-0.95 to +0.95) and row index (0 to 4)
 * for each keycap in the selected layout geometry.
 */
function computeSpatialMapsForLayout(layoutId) {
  const layout = KEYBOARD_LAYOUTS[layoutId] || KEYBOARD_LAYOUTS['ansi-68'];
  const spatialMap = {
    'MouseLeft': -0.28,
    'MouseMiddle': 0.0,
    'MouseRight': 0.28
  };
  const rowMap = {};
  const totalRows = layout.rows.length;

  layout.rows.forEach((row, rIndex) => {
    let mappedRowIndex = rIndex;
    if (totalRows === 6) {
      mappedRowIndex = Math.min(4, Math.floor(rIndex * 4 / (totalRows - 1)));
    }

    let totalRowUnits = 0;
    row.forEach(k => {
      totalRowUnits += (k.u !== undefined ? k.u : 1.0);
    });

    let currentPos = 0;
    row.forEach(k => {
      const unitW = (k.u !== undefined ? k.u : 1.0);
      const centerUnit = currentPos + (unitW / 2.0);
      const unitRatio = totalRowUnits > 0 ? (centerUnit / totalRowUnits) : 0.5;

      const pan = -0.95 + (unitRatio * 1.90);
      const clampedPan = Math.max(-1.0, Math.min(1.0, parseFloat(pan.toFixed(3))));

      spatialMap[k.code] = clampedPan;
      rowMap[k.code] = mappedRowIndex;

      currentPos += unitW;
    });
  });

  return { spatialMap, rowMap };
}

if (typeof window !== 'undefined') {
  window.TaptapSwitches = KEYBOARD_SWITCHES;
  window.TaptapLayouts = KEYBOARD_LAYOUTS;
}

// Obfuscated Vault token mappings
const VAULT_PACK_MAP = {
  pulse: 'vk_pls.tap',
  surfer: 'vk_srf.tap',
  void: 'vk_voi.tap',
  'aflion-carrot': 'vk_aflion_carrot.tap',
  'akko-clicky-pink': 'vk_akko_pink.tap',
  'akko-cs-jelly-black': 'vk_akko_jelly_black.tap',
  'akko-piano-pro': 'vk_akko_piano_pro.tap',
  'akko-v3-pro-cream-yellow': 'vk_akko_cream_yellow.tap',
  'alps-skcm-blue': 'vk_alps_blue.tap',
  'drop-holy-panda': 'vk_holy_panda.tap',
  'durock-alpaca': 'vk_durock_alpaca.tap',
  'gateron-ink-black': 'vk_gateron_ink_black.tap',
  'gateron-ink-red': 'vk_gateron_ink_red.tap',
  'gateron-turquoise-tealios': 'vk_gateron_tealios.tap',
  'ibm-buckling-spring': 'vk_ibm_buckling.tap',
  'iqunix-mq80': 'vk_iqunix_mq80.tap',
  'kailh-box-navy': 'vk_kailh_navy.tap',
  'keychron-k2-max-brown': 'vk_keychron_brown.tap',
  'keychron-k2-max-red': 'vk_keychron_red.tap',
  lizard: 'vk_lizard.tap',
  'novelkeys-cream': 'vk_novelkeys_cream.tap',
  ticks: 'vk_ticks.tap',
  'topre-classic': 'vk_topre.tap'
};

const VAULT_KEY_TOKEN_MAP = {
  'k01_d': 'alpha_down',     'k01_u': 'alpha_up',
  'k02_d': 'arrow_down',     'k02_u': 'arrow_up',
  'k03_d': 'backspace_down', 'k03_u': 'backspace_up',
  'k04_d': 'caps_lock_down', 'k04_u': 'caps_lock_up',
  'k05_d': 'command_down',   'k05_u': 'command_up',
  'k06_d': 'control_down',   'k06_u': 'control_up',
  'k07_d': 'enter_down',     'k07_u': 'enter_up',
  'k08_d': 'escape_down',    'k08_u': 'escape_up',
  'k09_d': 'fn_down',        'k09_u': 'fn_up',
  'k10_d': 'function_down',  'k10_u': 'function_up',
  'k11_d': 'modifier_down',  'k11_u': 'modifier_up',
  'k12_d': 'number_down',    'k12_u': 'number_up',
  'k13_d': 'option_down',    'k13_u': 'option_up',
  'k14_d': 'shift_down',     'k14_u': 'shift_up',
  'k15_d': 'space_down',     'k15_u': 'space_up',
  'k16_d': 'tab_down',       'k16_u': 'tab_up'
};

const VAULT_MOUSE_TOKEN_MAP = {
  'm01': 'Bloody V8',
  'm02': 'Glorious Model O',
  'm03': 'IntelliMouse Optical USB and PS2 Compatible',
  'm04': 'Logitech G203',
  'm05': 'Logitech Superlight',
  'm06': 'Rapture Venom',
  'm07': 'Razer DeathAdder V2 Pro',
  'm08': 'Trust GXT 152'
};

class TaptapAudioEngine {
  constructor() {
    this.ctx = null;
    // Active Master & Independent Volumes
    this.volume = 0.85; // Master volume
    this.keyboardVolume = 0.85; // Dedicated Keyboard volume
    this.mouseVolume = 0.85; // Dedicated Mouse volume

    // Active Mutes
    this.isMuted = false; // Master mute
    this.keyboardMuted = false; // Dedicated Keyboard mute
    this.mouseMuted = false; // Dedicated Mouse mute

    this.stereoWidth = 1.0;
    this.pitchJitter = 0.025;
    this.mode = 'hrtf'; // 'hrtf' or 'stereo'

    // Feature: Dynamic Cursor Panning
    this.dynamicCursorTracking = true;

    // Active Soundpacks
    this.activeKeyboardPack = 'pulse';
    this.activeMousePack = 'Bloody V8';
    this.playUpstrokes = true;

    // Cached AudioBuffers
    this.keyboardBuffers = {};
    this.mouseBuffers = {};

    // Active Keyboard Layout & Dynamic Physical Key Maps
    this.activeLayoutId = 'ansi-68';
    this.keySpatialMap = {};
    this.keyRowMap = {};
    this.setLayout('ansi-68');

    // 3D Binaural Vertical Elevation (Z-Axis Depth & Y-Axis Incline)
    this.verticalElevation = true;
    this.elevationDepth = 1.0;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Configure 3D Spatial Listener facing forward (-Z) and upright (+Y)
      if (this.ctx.listener) {
        if (this.ctx.listener.forwardX) {
          this.ctx.listener.positionX.setValueAtTime(0, this.ctx.currentTime);
          this.ctx.listener.positionY.setValueAtTime(0, this.ctx.currentTime);
          this.ctx.listener.positionZ.setValueAtTime(0, this.ctx.currentTime);
          this.ctx.listener.forwardX.setValueAtTime(0, this.ctx.currentTime);
          this.ctx.listener.forwardY.setValueAtTime(0, this.ctx.currentTime);
          this.ctx.listener.forwardZ.setValueAtTime(-1, this.ctx.currentTime);
          this.ctx.listener.upX.setValueAtTime(0, this.ctx.currentTime);
          this.ctx.listener.upY.setValueAtTime(1, this.ctx.currentTime);
          this.ctx.listener.upZ.setValueAtTime(0, this.ctx.currentTime);
        } else if (this.ctx.listener.setOrientation) {
          this.ctx.listener.setPosition(0, 0, 0);
          this.ctx.listener.setOrientation(0, 0, -1, 0, 1, 0);
        }
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  setKeyboardVolume(val) {
    this.keyboardVolume = Math.max(0, Math.min(1, val));
  }

  setMouseVolume(val) {
    this.mouseVolume = Math.max(0, Math.min(1, val));
  }

  setKeyboardMuted(muted) {
    this.keyboardMuted = !!muted;
  }

  setMouseMuted(muted) {
    this.mouseMuted = !!muted;
  }

  setStereoWidth(val) {
    this.stereoWidth = Math.max(0, Math.min(2.0, val));
  }

  setPitchJitter(val) {
    this.pitchJitter = Math.max(0, Math.min(0.08, val));
  }

  setMode(mode) {
    this.mode = mode === 'stereo' ? 'stereo' : 'hrtf';
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  setUpstrokes(enabled) {
    this.playUpstrokes = !!enabled;
  }

  setDynamicCursorTracking(enabled) {
    this.dynamicCursorTracking = !!enabled;
  }

  setVerticalElevation(enabled) {
    this.verticalElevation = !!enabled;
  }

  setElevationDepth(val) {
    this.elevationDepth = Math.max(0, Math.min(2.0, val));
  }

  /**
   * In-Memory Fast Descrambler for .tap Vault Containers
   */
  descrambleBytes(uint8Array) {
    const output = new Uint8Array(uint8Array.length);
    const keyLen = VAULT_KEY.length;
    for (let i = 0; i < uint8Array.length; i++) {
      output[i] = uint8Array[i] ^ VAULT_KEY[i % keyLen];
    }
    return output.buffer;
  }

  /**
   * Universal Asset Byte Loader
   * Supports direct fs reading in Electron and fetch in browser
   */
  async readAssetBytes(assetPath) {
    if (typeof window !== 'undefined' && window.require) {
      try {
        const fs = window.require('fs');
        const path = window.require('path');
        const basePath = (typeof __dirname !== 'undefined') ? __dirname : process.cwd();
        const fullPath = path.isAbsolute(assetPath) ? assetPath : path.resolve(basePath, assetPath);
        if (fs.existsSync(fullPath)) {
          const buf = fs.readFileSync(fullPath);
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        }
      } catch (fsErr) {
        console.warn(`[Vault Loader] Node fs read fallback for ${assetPath}:`, fsErr.message);
      }
    }

    const res = await fetch(assetPath);
    if (!res.ok) throw new Error(`Asset not found at ${assetPath} (${res.status})`);
    return await res.arrayBuffer();
  }

  /**
   * Load Obfuscated .tap Keyboard Pack
   */
  async loadKeyboardPack(packName) {
    this.initContext();
    this.activeKeyboardPack = packName;

    const fileName = VAULT_PACK_MAP[packName] || `vk_${packName}.tap`;
    const vaultUrl = `assets/vault/${fileName}`;
    try {
      const arrayBuffer = await this.readAssetBytes(vaultUrl);
      const view = new DataView(arrayBuffer);

      // Verify Magic Header (16 bytes)
      const magicBytes = new Uint8Array(arrayBuffer, 0, 16);
      const magicStr = new TextDecoder().decode(magicBytes).replace(/\0/g, '');
      if (magicStr !== VAULT_MAGIC) {
        throw new Error(`Invalid vault header: ${magicStr}`);
      }

      // Read Manifest Length (4 bytes Big-Endian)
      const manifestLen = view.getUint32(16, false);
      const manifestBytes = new Uint8Array(arrayBuffer, 20, manifestLen);
      const manifestJson = new TextDecoder().decode(manifestBytes);
      const manifest = JSON.parse(manifestJson);

      const dataBaseOffset = 20 + manifestLen;
      const newBuffers = {};
      const decodePromises = [];

      for (const [keyToken, info] of Object.entries(manifest)) {
        // Extract scrambled chunk and descramble in memory
        const scrambledChunk = new Uint8Array(arrayBuffer, dataBaseOffset + info.offset, info.length);
        const rawArrayBuffer = this.descrambleBytes(scrambledChunk);

        // Resolve token to logical key identifier (e.g. 'k01_d1' -> 'alpha_down')
        const baseToken = keyToken.replace(/_\d+$/, '').replace(/\d+$/, '');
        const resolvedKey = VAULT_KEY_TOKEN_MAP[baseToken] || VAULT_KEY_TOKEN_MAP[keyToken] || 'alpha_down';

        decodePromises.push(
          this.ctx.decodeAudioData(rawArrayBuffer)
            .then(audioBuf => {
              if (!newBuffers[resolvedKey]) {
                newBuffers[resolvedKey] = [];
              }
              newBuffers[resolvedKey].push(audioBuf);
              newBuffers[keyToken] = audioBuf;
            })
            .catch(e => console.warn(`[Vault] Decode failed for ${keyToken}`, e))
        );
      }

      await Promise.all(decodePromises);
      this.keyboardBuffers = newBuffers;
      console.log(`[Taptap Vault] Decrypted & loaded keyboard pack: ${packName} (${Object.keys(manifest).length} samples ready)`);
    } catch (err) {
      console.warn(`[Vault Loader] Failed to load pack ${packName}:`, err.message);
    }
  }

  /**
   * Preview a switch acoustic profile (plays test downstroke + upstroke)
   */
  async previewSwitch(switchId) {
    this.initContext();
    const sw = KEYBOARD_SWITCHES.find(s => s.id === switchId);
    if (!sw) return;

    const fileName = sw.file || (VAULT_PACK_MAP[switchId] || `vk_${switchId}.tap`);
    const vaultUrl = `assets/vault/${fileName}`;
    try {
      const arrayBuffer = await this.readAssetBytes(vaultUrl);
      const view = new DataView(arrayBuffer);
      const manifestLen = view.getUint32(16, false);
      const manifestBytes = new Uint8Array(arrayBuffer, 20, manifestLen);
      const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
      const dataBaseOffset = 20 + manifestLen;

      const entries = Object.entries(manifest);
      const downEntry = entries.find(([k]) => k.includes('_d') || k.includes('down')) || entries[0];
      const upEntry = entries.find(([k]) => k.includes('_u') || k.includes('up'));

      if (downEntry) {
        const [k, info] = downEntry;
        const rawDown = this.descrambleBytes(new Uint8Array(arrayBuffer, dataBaseOffset + info.offset, info.length));
        const bufDown = await this.ctx.decodeAudioData(rawDown);
        this.playBuffer(bufDown, 0.0, 1.0, this.keyboardVolume, 'KeyG');
      }

      if (upEntry && this.playUpstrokes) {
        setTimeout(async () => {
          try {
            const [k, info] = upEntry;
            const rawUp = this.descrambleBytes(new Uint8Array(arrayBuffer, dataBaseOffset + info.offset, info.length));
            const bufUp = await this.ctx.decodeAudioData(rawUp);
            this.playBuffer(bufUp, 0.0, 1.0, this.keyboardVolume * 0.75, 'KeyG');
          } catch (e) {}
        }, 95);
      }
    } catch (err) {
      console.warn('[Preview] Failed to preview switch:', err);
    }
  }

  /**
   * Load Obfuscated Mouse Soundpack Container (vm_all.tap)
   */
  async loadMousePack(mousePackName = 'Bloody V8') {
    this.initContext();
    this.activeMousePack = mousePackName;

    // Check if already in cache
    if (this.mouseBuffers[mousePackName]) {
      return;
    }

    // Attempt to load from encrypted vm_all.tap
    const vaultUrl = 'assets/vault/vm_all.tap';
    try {
      const arrayBuffer = await this.readAssetBytes(vaultUrl);
      const view = new DataView(arrayBuffer);

      const magicBytes = new Uint8Array(arrayBuffer, 0, 16);
      const magicStr = new TextDecoder().decode(magicBytes).replace(/\0/g, '');
      if (magicStr !== VAULT_MAGIC) throw new Error('Invalid mouse vault magic');

      const manifestLen = view.getUint32(16, false);
      const manifestBytes = new Uint8Array(arrayBuffer, 20, manifestLen);
      const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));

      const dataBaseOffset = 20 + manifestLen;
      const decodePromises = [];

      for (const [token, info] of Object.entries(manifest)) {
        const scrambledChunk = new Uint8Array(arrayBuffer, dataBaseOffset + info.offset, info.length);
        const rawArrayBuffer = this.descrambleBytes(scrambledChunk);

        const resolvedMouseName = VAULT_MOUSE_TOKEN_MAP[token] || token;

        decodePromises.push(
          this.ctx.decodeAudioData(rawArrayBuffer)
            .then(audioBuf => {
              this.mouseBuffers[resolvedMouseName] = audioBuf;
              this.mouseBuffers[token] = audioBuf;
            })
            .catch(e => console.warn(`[Vault] Decode failed for mouse: ${token}`, e))
        );
      }

      await Promise.all(decodePromises);
      console.log(`[Taptap Vault] Decrypted & loaded mouse vault container (${Object.keys(this.mouseBuffers).length / 2} mouse models)`);
    } catch (err) {
      console.warn(`[Vault Loader] Failed to load mouse container:`, err.message);
    }
  }

  async fetchAndDecode(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      return await this.ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
      return null;
    }
  }

  /**
   * Dynamically switches the active physical keyboard layout and recalculates
   * spatial 3D stereo coordinates for every key.
   */
  setLayout(layoutId) {
    this.activeLayoutId = layoutId || 'ansi-68';
    const { spatialMap, rowMap } = computeSpatialMapsForLayout(this.activeLayoutId);
    this.keySpatialMap = spatialMap;
    this.keyRowMap = rowMap;
    console.log(`[Taptap Audio Engine] Activated layout '${this.activeLayoutId}' with ${Object.keys(spatialMap).length} mapped keys`);
  }

  getKeyRow(code) {
    if (!code) return 2;
    if (code.startsWith('Mouse')) return 'mouse';
    return this.keyRowMap[code] !== undefined ? this.keyRowMap[code] : 2;
  }

  getKeyPan(code) {
    return this.keySpatialMap[code] !== undefined ? this.keySpatialMap[code] : 0.0;
  }

  getSoundCategory(code) {
    if (code === 'Space') return 'space';
    if (code === 'Enter') return 'enter';
    if (code === 'Backspace' || code === 'Delete') return 'backspace';
    if (code === 'Tab') return 'tab';
    if (code === 'CapsLock') return 'caps_lock';
    if (code.startsWith('Shift')) return 'shift';
    if (code.startsWith('Control')) return 'control';
    if (code.startsWith('Meta')) return 'command';
    if (code.startsWith('Alt')) return 'option';
    if (code === 'Escape') return 'escape';
    if (code === 'Fn') return 'fn';
    if (code.startsWith('Arrow')) return 'arrow';
    if (code.startsWith('Page') || code === 'Home' || code === 'End' || code === 'Insert') return 'arrow';
    if ((code.startsWith('F') && code.length <= 3) || code === 'PrintScreen' || code === 'Pause') return 'function';
    if (code.startsWith('Digit') || code === 'Minus' || code === 'Equal') return 'number';
    return 'alpha';
  }

  /**
   * Play spatial sound for downstroke or upstroke.
   */
  trigger(code, isUpstroke = false, customPan = null) {
    if (this.isMuted) return null;

    this.initContext();

    const rawPan = (customPan !== null) ? customPan : this.getKeyPan(code);
    const scaledPan = Math.max(-1.0, Math.min(1.0, rawPan * this.stereoWidth));

    let jitter = (Math.random() * 2 - 1) * this.pitchJitter;
    let playbackRate = 1.0 + jitter;

    // Handle Mouse Clicks (Bloody V8 / Mouse Vault)
    if (code.startsWith('Mouse')) {
      if (this.mouseMuted) return null; // Dedicated Mouse Mute
      if (isUpstroke) return null;

      if (code === 'MouseRight') playbackRate *= 1.03;
      if (code === 'MouseMiddle') playbackRate *= 0.97;

      const mouseBuf = this.mouseBuffers[this.activeMousePack] || this.mouseBuffers['Bloody V8'];
      const effectiveGain = this.mouseVolume; // Dedicated Mouse Volume

      if (mouseBuf) {
        this.playBuffer(mouseBuf, scaledPan, playbackRate, effectiveGain, code);
      } else {
        this.synthesizeMouseSound(scaledPan, playbackRate);
      }

      return { code, pan: scaledPan, rawPan, isUpstroke: false };
    }

    // Handle Keyboard Keypresses (Lofree Flow 2 Vault)
    if (this.keyboardMuted) return null; // Dedicated Keyboard Mute
    if (isUpstroke && !this.playUpstrokes) return null;

    const category = this.getSoundCategory(code);
    const suffix = isUpstroke ? 'up' : 'down';
    const bufferKey = `${category}_${suffix}`;
    const candidate = this.keyboardBuffers[bufferKey] || this.keyboardBuffers[`alpha_${suffix}`];
    const baseGain = isUpstroke ? 0.75 : 1.0;
    const effectiveGain = this.keyboardVolume * baseGain; // Dedicated Keyboard Volume

    let buffer = null;
    if (Array.isArray(candidate)) {
      const idx = Math.floor(Math.random() * candidate.length);
      buffer = candidate[idx];
    } else {
      buffer = candidate;
    }

    const row = this.getKeyRow(code);

    if (buffer) {
      this.playBuffer(buffer, scaledPan, playbackRate, effectiveGain, code);
    } else {
      this.synthesizeKeyboardSound(code, scaledPan, playbackRate, isUpstroke);
    }

    return {
      code,
      pan: scaledPan,
      rawPan,
      row,
      isUpstroke
    };
  }

  createSpatialNode(scaledPan, code = null) {
    if (this.mode === 'hrtf' && this.ctx.createPanner) {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1;
      panner.maxDistance = 10000;
      panner.rolloffFactor = 1;

      const row = this.getKeyRow(code);

      // 3D Physical Keyboard Coordinate Map:
      // Row 0 (Top / Far): Esc (top-left), Numbers, Backspace (top-right) -> +Y elevation, deep -Z
      // Row 1 (QWERTY Upper): Tab, Q..P, \ -> upper-left / upper-right
      // Row 2 (Home Row): Caps, A..L, Enter -> Reference middle depth
      // Row 3 (Lower Alpha): Shift, Z..M, Shift -> lower depth
      // Row 4 (Wrists / Near): Ctrl, Space, Arrows -> -Y elevation, close to chest (-Z)
      const rowOffsets = {
        0: { y: 0.28, z: -1.75, widthMult: 1.18 }, // Top corners: Esc (-X, -Z, +Y), Backspace (+X, -Z, +Y)
        1: { y: 0.12, z: -1.45, widthMult: 1.08 },
        2: { y: -0.05, z: -1.15, widthMult: 1.00 }, // Home center row
        3: { y: -0.22, z: -0.85, widthMult: 0.92 },
        4: { y: -0.38, z: -0.55, widthMult: 0.85 }, // Near bottom / Space
        mouse: { y: -0.15, z: -1.05, widthMult: 1.00 }
      };

      const offset = rowOffsets[row] || rowOffsets[2];
      const x = scaledPan * 2.2 * (offset.widthMult || 1.0);
      const y = (this.verticalElevation ? offset.y : -0.05) * this.elevationDepth;
      const z = offset.z;

      const now = this.ctx.currentTime;
      if (panner.positionX) {
        panner.positionX.setValueAtTime(x, now);
        panner.positionY.setValueAtTime(y, now);
        panner.positionZ.setValueAtTime(z, now);
      } else {
        panner.setPosition(x, y, z);
      }
      panner.connect(this.masterGain);
      return panner;
    } else {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(scaledPan, this.ctx.currentTime);
      let tailNode = panner;

      // In stereo mode, apply physical distance acoustic spectral filtering
      if (this.verticalElevation && this.ctx.createBiquadFilter) {
        const row = this.getKeyRow(code);
        if (row === 0 || row === 4) {
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowshelf';
          if (row === 0) {
            // Top row: air & distance presence
            filter.frequency.setValueAtTime(320, this.ctx.currentTime);
            filter.gain.setValueAtTime(-1.8, this.ctx.currentTime);
          } else {
            // Bottom row: close body & proximity resonance
            filter.frequency.setValueAtTime(240, this.ctx.currentTime);
            filter.gain.setValueAtTime(2.2, this.ctx.currentTime);
          }
          panner.connect(filter);
          tailNode = filter;
        }
      }

      tailNode.connect(this.masterGain);
      return panner;
    }
  }

  playBuffer(buffer, scaledPan, rate, gainMultiplier = 1.0, code = null) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(rate, this.ctx.currentTime);

    const pGain = this.ctx.createGain();
    pGain.gain.setValueAtTime(gainMultiplier, this.ctx.currentTime);

    const spatialNode = this.createSpatialNode(scaledPan, code);
    source.connect(pGain);
    pGain.connect(spatialNode);

    source.start(this.ctx.currentTime);

    setTimeout(() => {
      spatialNode.disconnect();
    }, (buffer.duration / rate + 0.1) * 1000);
  }

  synthesizeMouseSound(scaledPan, rate) {
    const now = this.ctx.currentTime;
    const spatialNode = this.createSpatialNode(scaledPan);
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1150 * rate, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.02);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gain);
    gain.connect(spatialNode);
    osc.start(now);
    osc.stop(now + 0.02);

    setTimeout(() => spatialNode.disconnect(), 100);
  }

  synthesizeKeyboardSound(code, scaledPan, rate, isUpstroke) {
    const now = this.ctx.currentTime;
    const spatialNode = this.createSpatialNode(scaledPan);

    const isSpace = code === 'Space';
    const baseFreq = (isSpace ? 160 : isUpstroke ? 380 : 260) * rate;
    const duration = isUpstroke ? 0.025 : 0.045;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isUpstroke ? 0.25 : 0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(spatialNode);
    osc.start(now);
    osc.stop(now + duration);

    setTimeout(() => spatialNode.disconnect(), 100);
  }
}

// Global instance
window.TaptapAudio = new TaptapAudioEngine();
