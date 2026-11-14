use crate::settings::AppSettings;
use crate::spatial::{
    compute_spatial_maps_for_layout, get_sound_category, row_3d_offset, LayoutMaps,
};
use crate::vault::{DecodedSample, KeyboardPack, VaultCache};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use parking_lot::{Mutex, RwLock};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, SyncSender};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

const MAX_VOICES: usize = 64;
const VOICE_RING_LEN: usize = 64;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SpatialMode {
    Hrtf,
    Stereo,
}

impl SpatialMode {
    pub fn from_str(s: &str) -> Self {
        if s.eq_ignore_ascii_case("stereo") {
            Self::Stereo
        } else {
            Self::Hrtf
        }
    }
}

#[derive(Clone, Debug)]
pub struct AudioConfig {
    pub master_volume: f32,
    pub keyboard_volume: f32,
    pub mouse_volume: f32,
    pub master_muted: bool,
    pub keyboard_muted: bool,
    pub mouse_muted: bool,
    pub stereo_width: f32,
    pub pitch_jitter: f32,
    pub mode: SpatialMode,
    pub play_upstrokes: bool,
    pub dynamic_cursor_tracking: bool,
    pub vertical_elevation: bool,
    pub elevation_depth: f32,
    pub keyboard_layout: String,
    pub active_keyboard_pack: String,
    pub active_mouse_pack: String,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self::from_settings(&AppSettings::default())
    }
}

impl AudioConfig {
    pub fn from_settings(s: &AppSettings) -> Self {
        Self {
            master_volume: 0.85,
            keyboard_volume: (s.keyboard_volume as f32 / 100.0).clamp(0.0, 1.0),
            mouse_volume: (s.mouse_volume as f32 / 100.0).clamp(0.0, 1.0),
            master_muted: s.master_muted,
            keyboard_muted: s.keyboard_muted,
            mouse_muted: s.mouse_muted,
            stereo_width: (s.stereo_width as f32 / 100.0).clamp(0.0, 2.0),
            pitch_jitter: (s.pitch_jitter as f32 / 1000.0).clamp(0.0, 0.08),
            mode: SpatialMode::from_str(&s.spatial_mode),
            play_upstrokes: s.play_upstrokes,
            dynamic_cursor_tracking: s.dynamic_cursor_tracking,
            vertical_elevation: s.vertical_elevation,
            elevation_depth: 1.0,
            keyboard_layout: s.keyboard_layout.clone(),
            active_keyboard_pack: s.active_keyboard_pack.clone(),
            active_mouse_pack: s.active_mouse_pack.clone(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct TriggerResult {
    pub code: String,
    pub pan: f32,
    pub raw_pan: f32,
    pub row: Option<u8>,
    pub is_upstroke: bool,
}

#[derive(Clone, Debug)]
pub enum VoiceSource {
    Sample(DecodedSample),
    Synth {
        start_freq: f32,
        end_freq: f32,
        duration_sec: f32,
        is_mouse: bool,
    },
}

#[derive(Clone, Debug)]
pub struct VoiceSpawn {
    pub source: VoiceSource,
    pub scaled_pan: f32,
    pub playback_rate: f32,
    pub gain: f32,
    pub row: Option<u8>,
    pub mode: SpatialMode,
    pub vertical_elevation: bool,
    pub elevation_depth: f32,
}

#[derive(Clone, Copy)]
struct LowShelfBiquad {
    enabled: bool,
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    z1: f32,
    z2: f32,
}

impl LowShelfBiquad {
    const fn bypass() -> Self {
        Self {
            enabled: false,
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
            z1: 0.0,
            z2: 0.0,
        }
    }

    fn new(freq_hz: f32, gain_db: f32, sample_rate: f32) -> Self {
        if gain_db.abs() < 0.05 || sample_rate <= 0.0 {
            return Self::bypass();
        }
        let a = 10.0_f32.powf(gain_db / 40.0);
        let w0 = 2.0 * std::f32::consts::PI * (freq_hz / sample_rate).clamp(0.001, 0.45);
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();
        // Slope S = 1 -> alpha = sin(w0)/2 * sqrt(2)
        let alpha = sin_w0 * std::f32::consts::FRAC_1_SQRT_2;
        let two_sqrt_a_alpha = 2.0 * a.sqrt() * alpha;

        let a0 = (a + 1.0) + (a - 1.0) * cos_w0 + two_sqrt_a_alpha;
        let inv_a0 = 1.0 / a0;
        let b0 = a * ((a + 1.0) - (a - 1.0) * cos_w0 + two_sqrt_a_alpha) * inv_a0;
        let b1 = 2.0 * a * ((a - 1.0) - (a + 1.0) * cos_w0) * inv_a0;
        let b2 = a * ((a + 1.0) - (a - 1.0) * cos_w0 - two_sqrt_a_alpha) * inv_a0;
        let a1 = -2.0 * ((a - 1.0) + (a + 1.0) * cos_w0) * inv_a0;
        let a2 = ((a + 1.0) + (a - 1.0) * cos_w0 - two_sqrt_a_alpha) * inv_a0;

        Self {
            enabled: true,
            b0,
            b1,
            b2,
            a1,
            a2,
            z1: 0.0,
            z2: 0.0,
        }
    }

    #[inline]
    fn process(&mut self, x: f32) -> f32 {
        if !self.enabled {
            return x;
        }
        let y = self.b0 * x + self.z1;
        self.z1 = self.b1 * x - self.a1 * y + self.z2;
        self.z2 = self.b2 * x - self.a2 * y;
        y
    }
}

struct ActiveVoice {
    active: bool,
    age: u64,
    samples: Option<Arc<[f32]>>,
    pos: f64,
    step: f64,
    synth_is_synth: bool,
    synth_is_mouse: bool,
    synth_elapsed: f32,
    synth_duration: f32,
    synth_start_freq: f32,
    synth_end_freq: f32,
    synth_phase: f32,
    gain_l: f32,
    gain_r: f32,
    delay_l: f32,
    delay_r: f32,
    shadow_l_alpha: f32,
    shadow_r_alpha: f32,
    shadow_l_state: f32,
    shadow_r_state: f32,
    ring: [f32; VOICE_RING_LEN],
    ring_idx: usize,
    shelf: LowShelfBiquad,
}

impl ActiveVoice {
    fn empty() -> Self {
        Self {
            active: false,
            age: 0,
            samples: None,
            pos: 0.0,
            step: 1.0,
            synth_is_synth: false,
            synth_is_mouse: false,
            synth_elapsed: 0.0,
            synth_duration: 0.0,
            synth_start_freq: 0.0,
            synth_end_freq: 0.0,
            synth_phase: 0.0,
            gain_l: 0.0,
            gain_r: 0.0,
            delay_l: 0.0,
            delay_r: 0.0,
            shadow_l_alpha: 1.0,
            shadow_r_alpha: 1.0,
            shadow_l_state: 0.0,
            shadow_r_state: 0.0,
            ring: [0.0; VOICE_RING_LEN],
            ring_idx: 0,
            shelf: LowShelfBiquad::bypass(),
        }
    }

    fn init_from_spawn(&mut self, spawn: VoiceSpawn, out_sample_rate: u32, age: u64) {
        self.active = true;
        self.age = age;
        self.pos = 0.0;
        self.ring = [0.0; VOICE_RING_LEN];
        self.ring_idx = 0;
        self.shadow_l_state = 0.0;
        self.shadow_r_state = 0.0;
        self.synth_elapsed = 0.0;
        self.synth_phase = 0.0;

        let out_sr_f = out_sample_rate.max(8_000) as f32;
        match spawn.source {
            VoiceSource::Sample(decoded) => {
                self.synth_is_synth = false;
                self.step = (decoded.sample_rate as f64 / out_sr_f as f64)
                    * (spawn.playback_rate as f64).max(0.25);
                self.samples = Some(decoded.samples);
            }
            VoiceSource::Synth {
                start_freq,
                end_freq,
                duration_sec,
                is_mouse,
            } => {
                self.synth_is_synth = true;
                self.synth_is_mouse = is_mouse;
                self.synth_duration = duration_sec.max(0.005);
                self.synth_start_freq = start_freq;
                self.synth_end_freq = end_freq;
                self.samples = None;
                self.step = 1.0;
            }
        }

        // Row acoustic elevation shelf (matches audio-engine.js row 0 / row 4 timbre)
        self.shelf = if spawn.vertical_elevation {
            match spawn.row {
                Some(0) => LowShelfBiquad::new(320.0, -1.8, out_sr_f),
                Some(1) => LowShelfBiquad::new(300.0, -0.8, out_sr_f),
                Some(3) => LowShelfBiquad::new(260.0, 1.0, out_sr_f),
                Some(4) => LowShelfBiquad::new(240.0, 2.2, out_sr_f),
                _ => LowShelfBiquad::bypass(),
            }
        } else {
            LowShelfBiquad::bypass()
        };

        let clamped_pan = spawn.scaled_pan.clamp(-1.0, 1.0);
        match spawn.mode {
            SpatialMode::Hrtf => {
                let (row_y, row_z, width_mult) = row_3d_offset(spawn.row);
                let x = clamped_pan * 2.2 * width_mult;
                let y = (if spawn.vertical_elevation { row_y } else { -0.05 })
                    * spawn.elevation_depth;
                let z = row_z;

                let dist = (x * x + y * y + z * z).sqrt().max(0.55);
                let dist_gain = (1.15 / dist).clamp(0.45, 1.35);

                let theta = x.atan2(-z);
                let abs_theta = theta.abs();
                let itd_sec = (0.0875 / 343.0) * (abs_theta + abs_theta.sin());
                let itd_samples = (itd_sec * out_sr_f).clamp(0.0, (VOICE_RING_LEN - 4) as f32);

                let sin_t = theta.sin();
                let shadow_alpha = (1.0 - sin_t.abs() * 0.68).clamp(0.24, 1.0);

                if theta >= 0.0 {
                    // Sound source to the right: right ear is near, left ear gets ITD + head shadow
                    self.delay_r = 0.0;
                    self.delay_l = itd_samples;
                    self.shadow_r_alpha = 1.0;
                    self.shadow_l_alpha = shadow_alpha;
                } else {
                    // Sound source to the left: left ear is near, right ear gets ITD + head shadow
                    self.delay_l = 0.0;
                    self.delay_r = itd_samples;
                    self.shadow_l_alpha = 1.0;
                    self.shadow_r_alpha = shadow_alpha;
                }

                let ild_l = (1.0 - sin_t * 0.62).max(0.15).sqrt();
                let ild_r = (1.0 + sin_t * 0.62).max(0.15).sqrt();
                let norm = 0.85 * spawn.gain * dist_gain;
                self.gain_l = ild_l * norm;
                self.gain_r = ild_r * norm;
            }
            SpatialMode::Stereo => {
                let angle = (clamped_pan + 1.0) * std::f32::consts::FRAC_PI_4;
                self.gain_l = angle.cos() * spawn.gain;
                self.gain_r = angle.sin() * spawn.gain;
                self.delay_l = 0.0;
                self.delay_r = 0.0;
                self.shadow_l_alpha = 1.0;
                self.shadow_r_alpha = 1.0;
            }
        }
    }

    #[inline]
    fn read_ring_delayed(&self, delay_samples: f32) -> f32 {
        if delay_samples <= 0.001 {
            return self.ring[self.ring_idx];
        }
        let d_int = delay_samples.floor() as usize;
        let frac = delay_samples - (d_int as f32);
        let idx0 = (self.ring_idx + VOICE_RING_LEN - d_int) & (VOICE_RING_LEN - 1);
        let idx1 = (self.ring_idx + VOICE_RING_LEN - d_int - 1) & (VOICE_RING_LEN - 1);
        let s0 = self.ring[idx0];
        let s1 = self.ring[idx1];
        s0 + (s1 - s0) * frac
    }

    #[inline]
    fn next_sample(&mut self, out_sample_rate: u32) -> Option<(f32, f32)> {
        if !self.active {
            return None;
        }

        let mono = if self.synth_is_synth {
            if self.synth_elapsed >= self.synth_duration {
                self.active = false;
                return None;
            }
            let dt = 1.0 / (out_sample_rate.max(8_000) as f32);
            let progress = (self.synth_elapsed / self.synth_duration).clamp(0.0, 1.0);
            let freq = self.synth_start_freq
                * (self.synth_end_freq / self.synth_start_freq.max(1.0)).powf(progress);
            self.synth_phase = (self.synth_phase + freq * dt) % 1.0;
            let wave = if self.synth_is_mouse {
                (self.synth_phase * 2.0 * std::f32::consts::PI).sin()
            } else {
                // Triangle wave
                4.0 * (self.synth_phase - 0.5).abs() - 1.0
            };
            let env = (1.0 - progress).powi(2);
            self.synth_elapsed += dt;
            wave * env
        } else if let Some(ref buf) = self.samples {
            let idx = self.pos as usize;
            if idx + 1 >= buf.len() {
                self.active = false;
                self.samples = None;
                return None;
            }
            let frac = (self.pos - (idx as f64)) as f32;
            let s0 = buf[idx];
            let s1 = buf[idx + 1];
            self.pos += self.step;
            s0 + (s1 - s0) * frac
        } else {
            self.active = false;
            return None;
        };

        let filtered = self.shelf.process(mono);

        self.ring_idx = (self.ring_idx + 1) & (VOICE_RING_LEN - 1);
        self.ring[self.ring_idx] = filtered;

        let raw_l = self.read_ring_delayed(self.delay_l);
        let raw_r = self.read_ring_delayed(self.delay_r);

        self.shadow_l_state += self.shadow_l_alpha * (raw_l - self.shadow_l_state);
        self.shadow_r_state += self.shadow_r_alpha * (raw_r - self.shadow_r_state);

        Some((
            self.shadow_l_state * self.gain_l,
            self.shadow_r_state * self.gain_r,
        ))
    }
}

pub struct Mixer {
    rx: Receiver<VoiceSpawn>,
    voices: Vec<ActiveVoice>,
    out_sample_rate: u32,
    next_age: u64,
}

impl Mixer {
    pub fn new(rx: Receiver<VoiceSpawn>, out_sample_rate: u32) -> Self {
        let mut voices = Vec::with_capacity(MAX_VOICES);
        for _ in 0..MAX_VOICES {
            voices.push(ActiveVoice::empty());
        }
        Self {
            rx,
            voices,
            out_sample_rate,
            next_age: 1,
        }
    }

    fn drain_spawns(&mut self) {
        while let Ok(spawn) = self.rx.try_recv() {
            let mut slot_idx = None;
            let mut oldest_idx = 0usize;
            let mut oldest_age = u64::MAX;

            for (i, v) in self.voices.iter().enumerate() {
                if !v.active {
                    slot_idx = Some(i);
                    break;
                }
                if v.age < oldest_age {
                    oldest_age = v.age;
                    oldest_idx = i;
                }
            }

            let target = slot_idx.unwrap_or(oldest_idx);
            let age = self.next_age;
            self.next_age = self.next_age.wrapping_add(1);
            self.voices[target].init_from_spawn(spawn, self.out_sample_rate, age);
        }
    }

    /// Renders a block of stereo frames `[L, R]` with zero heap allocations.
    #[cfg(test)]
    pub fn render_stereo(&mut self, left: &mut [f32], right: &mut [f32]) {
        self.drain_spawns();

        for (l_out, r_out) in left.iter_mut().zip(right.iter_mut()) {
            let mut sum_l = 0.0_f32;
            let mut sum_r = 0.0_f32;
            for v in self.voices.iter_mut() {
                if v.active {
                    if let Some((vl, vr)) = v.next_sample(self.out_sample_rate) {
                        sum_l += vl;
                        sum_r += vr;
                    }
                }
            }
            *l_out = soft_clip(sum_l);
            *r_out = soft_clip(sum_r);
        }
    }

    fn render_interleaved_f32(&mut self, output: &mut [f32], channels: usize) {
        self.drain_spawns();
        let ch = channels.max(1);
        for frame in output.chunks_mut(ch) {
            let mut sum_l = 0.0_f32;
            let mut sum_r = 0.0_f32;
            for v in self.voices.iter_mut() {
                if v.active {
                    if let Some((vl, vr)) = v.next_sample(self.out_sample_rate) {
                        sum_l += vl;
                        sum_r += vr;
                    }
                }
            }
            let l = soft_clip(sum_l);
            let r = soft_clip(sum_r);
            if ch == 1 {
                frame[0] = (l + r) * 0.5;
            } else {
                frame[0] = l;
                frame[1] = r;
                for extra in frame.iter_mut().skip(2) {
                    *extra = 0.0;
                }
            }
        }
    }

    fn render_interleaved_i16(&mut self, output: &mut [i16], channels: usize) {
        self.drain_spawns();
        let ch = channels.max(1);
        for frame in output.chunks_mut(ch) {
            let mut sum_l = 0.0_f32;
            let mut sum_r = 0.0_f32;
            for v in self.voices.iter_mut() {
                if v.active {
                    if let Some((vl, vr)) = v.next_sample(self.out_sample_rate) {
                        sum_l += vl;
                        sum_r += vr;
                    }
                }
            }
            let l = (soft_clip(sum_l) * i16::MAX as f32) as i16;
            let r = (soft_clip(sum_r) * i16::MAX as f32) as i16;
            if ch == 1 {
                frame[0] = ((l as i32 + r as i32) / 2) as i16;
            } else {
                frame[0] = l;
                frame[1] = r;
                for extra in frame.iter_mut().skip(2) {
                    *extra = 0;
                }
            }
        }
    }

    fn render_interleaved_u16(&mut self, output: &mut [u16], channels: usize) {
        self.drain_spawns();
        let ch = channels.max(1);
        for frame in output.chunks_mut(ch) {
            let mut sum_l = 0.0_f32;
            let mut sum_r = 0.0_f32;
            for v in self.voices.iter_mut() {
                if v.active {
                    if let Some((vl, vr)) = v.next_sample(self.out_sample_rate) {
                        sum_l += vl;
                        sum_r += vr;
                    }
                }
            }
            let to_u16 = |x: f32| -> u16 {
                ((soft_clip(x) * 0.5 + 0.5).clamp(0.0, 1.0) * u16::MAX as f32) as u16
            };
            let l = to_u16(sum_l);
            let r = to_u16(sum_r);
            if ch == 1 {
                frame[0] = ((l as u32 + r as u32) / 2) as u16;
            } else {
                frame[0] = l;
                frame[1] = r;
                for extra in frame.iter_mut().skip(2) {
                    *extra = u16::MAX / 2;
                }
            }
        }
    }
}

#[inline]
fn soft_clip(x: f32) -> f32 {
    if x.abs() <= 0.92 {
        x
    } else {
        x.tanh()
    }
}

pub struct AudioController {
    config: RwLock<AudioConfig>,
    layout_maps: RwLock<LayoutMaps>,
    vault: Mutex<VaultCache>,
    active_kb_pack: RwLock<Option<Arc<KeyboardPack>>>,
    active_mouse_sample: RwLock<Option<DecodedSample>>,
    voice_tx: SyncSender<VoiceSpawn>,
    recent_key_triggers: Mutex<HashMap<(String, bool), Instant>>,
}

impl AudioController {
    fn build_parts(vault_dir: PathBuf, initial_settings: &AppSettings) -> (Arc<Self>, Receiver<VoiceSpawn>) {
        let initial_config = AudioConfig::from_settings(initial_settings);
        let initial_maps = compute_spatial_maps_for_layout(&initial_config.keyboard_layout);
        let (tx, rx) = mpsc::sync_channel::<VoiceSpawn>(128);

        let controller = Arc::new(Self {
            config: RwLock::new(initial_config),
            layout_maps: RwLock::new(initial_maps),
            vault: Mutex::new(VaultCache::new(vault_dir)),
            active_kb_pack: RwLock::new(None),
            active_mouse_sample: RwLock::new(None),
            voice_tx: tx,
            recent_key_triggers: Mutex::new(HashMap::with_capacity(64)),
        });

        (controller, rx)
    }

    pub fn new(vault_dir: PathBuf, initial_settings: &AppSettings) -> Arc<Self> {
        let (controller, rx) = Self::build_parts(vault_dir, initial_settings);

        // Preload active keyboard and mouse soundpacks in background so startup is instant
        let ctrl_preload = Arc::clone(&controller);
        let kb_id = initial_settings.active_keyboard_pack.clone();
        let mouse_id = initial_settings.active_mouse_pack.clone();
        thread::Builder::new()
            .name("taptap-vault-preload".to_string())
            .spawn(move || {
                ctrl_preload.set_keyboard_pack(&kb_id);
                ctrl_preload.set_mouse_pack(&mouse_id);
            })
            .ok();

        // Spawn audio output supervisor thread owning the cpal WASAPI stream
        spawn_audio_output_thread(rx);

        controller
    }

    pub fn config_snapshot(&self) -> AudioConfig {
        self.config.read().clone()
    }

    pub fn set_muted(&self, muted: bool) {
        self.config.write().master_muted = muted;
    }

    pub fn toggle_muted(&self) -> bool {
        let mut cfg = self.config.write();
        cfg.master_muted = !cfg.master_muted;
        cfg.master_muted
    }

    pub fn set_keyboard_pack(&self, pack_name: &str) {
        self.config.write().active_keyboard_pack = pack_name.to_string();
        let loaded = {
            let mut vault = self.vault.lock();
            vault.load_keyboard_pack(pack_name).ok()
        };
        if let Some(pack) = loaded {
            *self.active_kb_pack.write() = Some(pack);
        }
    }

    pub fn set_mouse_pack(&self, mouse_name: &str) {
        self.config.write().active_mouse_pack = mouse_name.to_string();
        let loaded = {
            let mut vault = self.vault.lock();
            vault.get_mouse_sample(mouse_name)
        };
        if let Some(sample) = loaded {
            *self.active_mouse_sample.write() = Some(sample);
        }
    }

    pub fn update_from_settings(&self, s: &AppSettings) {
        let prev_layout = self.config.read().keyboard_layout.clone();
        let prev_kb = self.config.read().active_keyboard_pack.clone();
        let prev_mouse = self.config.read().active_mouse_pack.clone();

        {
            let mut cfg = self.config.write();
            cfg.keyboard_volume = (s.keyboard_volume as f32 / 100.0).clamp(0.0, 1.0);
            cfg.mouse_volume = (s.mouse_volume as f32 / 100.0).clamp(0.0, 1.0);
            cfg.master_muted = s.master_muted;
            cfg.keyboard_muted = s.keyboard_muted;
            cfg.mouse_muted = s.mouse_muted;
            cfg.stereo_width = (s.stereo_width as f32 / 100.0).clamp(0.0, 2.0);
            cfg.pitch_jitter = (s.pitch_jitter as f32 / 1000.0).clamp(0.0, 0.08);
            cfg.mode = SpatialMode::from_str(&s.spatial_mode);
            cfg.play_upstrokes = s.play_upstrokes;
            cfg.dynamic_cursor_tracking = s.dynamic_cursor_tracking;
            cfg.vertical_elevation = s.vertical_elevation;
            cfg.keyboard_layout = s.keyboard_layout.clone();
        }

        if prev_layout != s.keyboard_layout {
            *self.layout_maps.write() = compute_spatial_maps_for_layout(&s.keyboard_layout);
        }
        if prev_kb != s.active_keyboard_pack || self.active_kb_pack.read().is_none() {
            self.set_keyboard_pack(&s.active_keyboard_pack);
        }
        if prev_mouse != s.active_mouse_pack || self.active_mouse_sample.read().is_none() {
            self.set_mouse_pack(&s.active_mouse_pack);
        }
    }

    pub fn preview_switch(self: &Arc<Self>, switch_id: &str) {
        let pack_res = {
            let mut vault = self.vault.lock();
            vault.load_keyboard_pack(switch_id)
        };
        let Ok(pack) = pack_res else {
            return;
        };

        let cfg = self.config.read().clone();
        let down = pack
            .by_category
            .get("alpha_down")
            .and_then(|v| v.first())
            .or_else(|| pack.by_token.get("k01_d1"))
            .or_else(|| pack.by_token.get("k01_d"))
            .cloned();

        let up = pack
            .by_category
            .get("alpha_up")
            .and_then(|v| v.first())
            .or_else(|| pack.by_token.get("k01_u1"))
            .or_else(|| pack.by_token.get("k01_u"))
            .cloned();

        let row = self.layout_maps.read().row_map.get("KeyG").copied();

        if let Some(d) = down {
            let _ = self.voice_tx.try_send(VoiceSpawn {
                source: VoiceSource::Sample(d),
                scaled_pan: 0.0,
                playback_rate: 1.0,
                gain: cfg.keyboard_volume * cfg.master_volume,
                row,
                mode: cfg.mode,
                vertical_elevation: cfg.vertical_elevation,
                elevation_depth: cfg.elevation_depth,
            });
        }

        if let Some(u) = up {
            if cfg.play_upstrokes {
                let tx = self.voice_tx.clone();
                let gain = cfg.keyboard_volume * 0.75 * cfg.master_volume;
                thread::spawn(move || {
                    thread::sleep(Duration::from_millis(95));
                    let _ = tx.try_send(VoiceSpawn {
                        source: VoiceSource::Sample(u),
                        scaled_pan: 0.0,
                        playback_rate: 1.0,
                        gain,
                        row,
                        mode: cfg.mode,
                        vertical_elevation: cfg.vertical_elevation,
                        elevation_depth: cfg.elevation_depth,
                    });
                });
            }
        }
    }

    pub fn trigger(
        &self,
        code: &str,
        is_upstroke: bool,
        custom_pan: Option<f32>,
    ) -> Option<TriggerResult> {
        self.trigger_checked(code, is_upstroke, custom_pan, false)
    }

    pub fn trigger_checked(
        &self,
        code: &str,
        is_upstroke: bool,
        custom_pan: Option<f32>,
        dedupe: bool,
    ) -> Option<TriggerResult> {
        let cfg = self.config.read().clone();
        if cfg.master_muted {
            return None;
        }

        let is_mouse = code.starts_with("Mouse");
        if is_mouse {
            if cfg.mouse_muted || is_upstroke {
                return None;
            }
        } else {
            if cfg.keyboard_muted {
                return None;
            }
            if dedupe {
                let now = Instant::now();
                let mut recent = self.recent_key_triggers.lock();
                if is_upstroke {
                    recent.remove(&(code.to_string(), false));
                }
                let key = (code.to_string(), is_upstroke);
                if let Some(prev) = recent.get(&key) {
                    if prev.elapsed() < Duration::from_millis(45) {
                        return None;
                    }
                }
                recent.insert(key, now);
            }
            if is_upstroke && !cfg.play_upstrokes {
                return None;
            }
        }

        let (raw_pan, row) = {
            let maps = self.layout_maps.read();
            let raw = custom_pan
                .unwrap_or_else(|| maps.spatial_map.get(code).copied().unwrap_or(0.0));
            let r = if is_mouse {
                None
            } else {
                Some(maps.row_map.get(code).copied().unwrap_or(2))
            };
            (raw, r)
        };

        let scaled_pan = (raw_pan * cfg.stereo_width).clamp(-1.0, 1.0);
        let jitter = (fastrand::f32() * 2.0 - 1.0) * cfg.pitch_jitter;
        let mut playback_rate = (1.0 + jitter).clamp(0.5, 1.8);

        if is_mouse {
            if code == "MouseRight" {
                playback_rate *= 1.03;
            } else if code == "MouseMiddle" {
                playback_rate *= 0.97;
            }

            let gain = cfg.mouse_volume * cfg.master_volume;
            let source = match self.active_mouse_sample.read().as_ref() {
                Some(s) => VoiceSource::Sample(s.clone()),
                None => VoiceSource::Synth {
                    start_freq: 1150.0 * playback_rate,
                    end_freq: 320.0,
                    duration_sec: 0.02,
                    is_mouse: true,
                },
            };

            let _ = self.voice_tx.try_send(VoiceSpawn {
                source,
                scaled_pan,
                playback_rate,
                gain,
                row: None,
                mode: cfg.mode,
                vertical_elevation: cfg.vertical_elevation,
                elevation_depth: cfg.elevation_depth,
            });

            return Some(TriggerResult {
                code: code.to_string(),
                pan: scaled_pan,
                raw_pan,
                row: None,
                is_upstroke: false,
            });
        }

        // Keyboard sound lookup
        let category = get_sound_category(code);
        let suffix = if is_upstroke { "up" } else { "down" };
        let key_primary = format!("{category}_{suffix}");
        let key_fallback = format!("alpha_{suffix}");

        let base_gain = if is_upstroke { 0.75 } else { 1.0 };
        let gain = cfg.keyboard_volume * base_gain * cfg.master_volume;

        let chosen_sample = {
            let guard = self.active_kb_pack.read();
            guard.as_ref().and_then(|pack| {
                let candidates = pack
                    .by_category
                    .get(&key_primary)
                    .or_else(|| pack.by_category.get(&key_fallback))?;
                if candidates.is_empty() {
                    return None;
                }
                let idx = fastrand::usize(..candidates.len());
                Some(candidates[idx].clone())
            })
        };

        let source = match chosen_sample {
            Some(s) => VoiceSource::Sample(s),
            None => {
                let base_freq = if code == "Space" {
                    160.0
                } else if is_upstroke {
                    380.0
                } else {
                    260.0
                } * playback_rate;
                VoiceSource::Synth {
                    start_freq: base_freq,
                    end_freq: base_freq * 0.5,
                    duration_sec: if is_upstroke { 0.025 } else { 0.045 },
                    is_mouse: false,
                }
            }
        };

        let _ = self.voice_tx.try_send(VoiceSpawn {
            source,
            scaled_pan,
            playback_rate,
            gain,
            row,
            mode: cfg.mode,
            vertical_elevation: cfg.vertical_elevation,
            elevation_depth: cfg.elevation_depth,
        });

        Some(TriggerResult {
            code: code.to_string(),
            pan: scaled_pan,
            raw_pan,
            row,
            is_upstroke,
        })
    }
}

fn spawn_audio_output_thread(rx: Receiver<VoiceSpawn>) {
    thread::Builder::new()
        .name("taptap-audio-supervisor".to_string())
        .spawn(move || {
            let mixer_cell = Arc::new(Mutex::new(Mixer::new(rx, 48_000)));
            loop {
                let needs_reinit = Arc::new(AtomicBool::new(false));
                match build_cpal_stream(Arc::clone(&mixer_cell), Arc::clone(&needs_reinit)) {
                    Ok(stream) => {
                        if stream.play().is_ok() {
                            while !needs_reinit.load(Ordering::Relaxed) {
                                thread::sleep(Duration::from_millis(500));
                            }
                        }
                        drop(stream);
                    }
                    Err(_) => {
                        thread::sleep(Duration::from_secs(2));
                    }
                }
            }
        })
        .ok();
}

fn build_cpal_stream(
    mixer: Arc<Mutex<Mixer>>,
    needs_reinit: Arc<AtomicBool>,
) -> Result<cpal::Stream, String> {
    let host = cpal::default_host();
    let device = host
        .default_output_device()
        .ok_or_else(|| "No default output audio device".to_string())?;
    let supported = device
        .default_output_config()
        .map_err(|e| format!("Default output config error: {e}"))?;

    let sample_format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();
    let channels = config.channels as usize;
    let sample_rate = config.sample_rate.0;

    {
        let mut guard = mixer.lock();
        guard.out_sample_rate = sample_rate;
    }

    let err_flag = Arc::clone(&needs_reinit);
    let err_fn = move |_err| {
        err_flag.store(true, Ordering::Relaxed);
    };

    let stream = match sample_format {
        cpal::SampleFormat::F32 => device.build_output_stream(
            &config,
            move |data: &mut [f32], _| {
                if let Some(mut guard) = mixer.try_lock() {
                    guard.render_interleaved_f32(data, channels);
                } else {
                    data.fill(0.0);
                }
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::I16 => device.build_output_stream(
            &config,
            move |data: &mut [i16], _| {
                if let Some(mut guard) = mixer.try_lock() {
                    guard.render_interleaved_i16(data, channels);
                } else {
                    data.fill(0);
                }
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::U16 => device.build_output_stream(
            &config,
            move |data: &mut [u16], _| {
                if let Some(mut guard) = mixer.try_lock() {
                    guard.render_interleaved_u16(data, channels);
                } else {
                    data.fill(u16::MAX / 2);
                }
            },
            err_fn,
            None,
        ),
        other => {
            return Err(format!("Unsupported cpal sample format: {other:?}"));
        }
    }
    .map_err(|e| format!("Failed to build audio stream: {e}"))?;

    Ok(stream)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::resolve_vault_dir;

    #[test]
    fn hrtf_and_stereo_render_cleanly_with_directional_balance() {
        let vault_dir = resolve_vault_dir(None);
        let mut vault = VaultCache::new(vault_dir);
        let pack = vault.load_keyboard_pack("pulse").expect("load pulse");
        let sample = pack.by_category["alpha_down"][0].clone();

        for mode in [SpatialMode::Hrtf, SpatialMode::Stereo] {
            let (tx, rx) = mpsc::sync_channel::<VoiceSpawn>(16);
            let mut mixer = Mixer::new(rx, 48_000);

            tx.send(VoiceSpawn {
                source: VoiceSource::Sample(sample.clone()),
                scaled_pan: -0.9, // Far left key (e.g., KeyQ / KeyA)
                playback_rate: 1.0,
                gain: 0.85,
                row: Some(0),
                mode,
                vertical_elevation: true,
                elevation_depth: 1.0,
            })
            .unwrap();

            let mut left = vec![0.0_f32; 4096];
            let mut right = vec![0.0_f32; 4096];
            mixer.render_stereo(&mut left, &mut right);

            let energy_l: f32 = left.iter().map(|s| s * s).sum();
            let energy_r: f32 = right.iter().map(|s| s * s).sum();

            assert!(
                left.iter().chain(right.iter()).all(|s| s.is_finite()),
                "non-finite sample produced in {mode:?}"
            );
            assert!(
                left.iter().chain(right.iter()).all(|s| s.abs() <= 1.0),
                "output exceeded [-1, 1] in {mode:?}"
            );
            assert!(
                energy_l > energy_r * 1.5,
                "expected strong left-ear energy dominance for left pan in {mode:?}: L={energy_l}, R={energy_r}"
            );
        }
    }

    #[test]
    fn trigger_checked_dedupes_within_window_and_clears_on_upstroke() {
        let settings = AppSettings::default();
        let (ctrl, rx) = AudioController::build_parts(resolve_vault_dir(None), &settings);

        // First downstroke plays
        assert!(ctrl.trigger_checked("KeyA", false, None, true).is_some());
        assert!(rx.try_recv().is_ok());

        // Duplicate downstroke within 45ms is suppressed
        assert!(ctrl.trigger_checked("KeyA", false, None, true).is_none());
        assert!(rx.try_recv().is_err());

        // Different key is unaffected
        assert!(ctrl.trigger_checked("KeyS", false, None, true).is_some());
        assert!(rx.try_recv().is_ok());

        // Non-deduped trigger bypasses dedupe window
        assert!(ctrl.trigger("KeyA", false, None).is_some());
        assert!(rx.try_recv().is_ok());

        // Upstroke plays, deduplicates immediate repeat, and clears KeyA downstroke lock
        assert!(ctrl.trigger_checked("KeyA", true, None, true).is_some());
        assert!(rx.try_recv().is_ok());
        assert!(ctrl.trigger_checked("KeyA", true, None, true).is_none());
        assert!(rx.try_recv().is_err());

        // Physical re-press immediately after release is never blocked
        assert!(ctrl.trigger_checked("KeyA", false, None, true).is_some());
        assert!(rx.try_recv().is_ok());
    }

    #[test]
    fn legacy_settings_json_with_gpu_acceleration_deserializes_cleanly() {
        let legacy_json = r#"{
            "keyboardVolume": 70,
            "mouseVolume": 60,
            "gpuAcceleration": true,
            "theme": "dark",
            "startupLaunch": true
        }"#;
        let parsed: AppSettings =
            serde_json::from_str(legacy_json).expect("legacy AppSettings JSON should parse");
        assert_eq!(parsed.keyboard_volume, 70);
        assert_eq!(parsed.mouse_volume, 60);
        assert_eq!(parsed.theme, "dark");
        assert!(parsed.startup_launch);
        assert_eq!(parsed.active_keyboard_pack, "pulse");
    }
}
