use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

const VAULT_MAGIC: &str = "TAPTAP_VAULT_V1";
const VAULT_KEY: &[u8] = b"TaptapAcousticVault2026@BespokeLuxuryAudioKey#X9!";

#[derive(Clone, Debug)]
pub struct DecodedSample {
    pub samples: Arc<[f32]>,
    pub sample_rate: u32,
}

#[derive(Clone, Debug)]
pub struct MouseProfile {
    pub down: DecodedSample,
    pub up: DecodedSample,
}

#[derive(Clone, Debug, Default)]
pub struct KeyboardPack {
    pub by_category: HashMap<String, Vec<DecodedSample>>,
    pub by_token: HashMap<String, DecodedSample>,
}

#[derive(Debug, Deserialize)]
struct VaultEntryMeta {
    offset: usize,
    length: usize,
    #[serde(default)]
    mime: Option<String>,
}

/// Resolves the `assets/vault` directory across installed, portable, and dev layouts.
pub fn resolve_vault_dir(resource_dir: Option<&Path>) -> PathBuf {
    let mut candidates = Vec::new();
    if let Some(res) = resource_dir {
        candidates.push(res.join("assets").join("vault"));
        candidates.push(res.join("_up_").join("assets").join("vault"));
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join("assets").join("vault"));
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("assets").join("vault"));
        candidates.push(cwd.join("..").join("assets").join("vault"));
    }
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("assets")
            .join("vault"),
    );

    for cand in &candidates {
        if cand.is_dir() {
            return cand.clone();
        }
    }
    candidates
        .into_iter()
        .last()
        .unwrap_or_else(|| PathBuf::from("assets/vault"))
}

pub fn keyboard_pack_filename(pack_name: &str) -> String {
    match pack_name {
        "pulse" => "vk_pls.tap".to_string(),
        "surfer" => "vk_srf.tap".to_string(),
        "void" => "vk_voi.tap".to_string(),
        "aflion-carrot" => "vk_aflion_carrot.tap".to_string(),
        "akko-clicky-pink" => "vk_akko_pink.tap".to_string(),
        "akko-cs-jelly-black" => "vk_akko_jelly_black.tap".to_string(),
        "akko-piano-pro" => "vk_akko_piano_pro.tap".to_string(),
        "akko-v3-pro-cream-yellow" => "vk_akko_cream_yellow.tap".to_string(),
        "alps-skcm-blue" => "vk_alps_blue.tap".to_string(),
        "drop-holy-panda" => "vk_holy_panda.tap".to_string(),
        "durock-alpaca" => "vk_durock_alpaca.tap".to_string(),
        "gateron-ink-black" => "vk_gateron_ink_black.tap".to_string(),
        "gateron-ink-red" => "vk_gateron_ink_red.tap".to_string(),
        "gateron-turquoise-tealios" => "vk_gateron_tealios.tap".to_string(),
        "ibm-buckling-spring" => "vk_ibm_buckling.tap".to_string(),
        "iqunix-mq80" => "vk_iqunix_mq80.tap".to_string(),
        "kailh-box-navy" => "vk_kailh_navy.tap".to_string(),
        "keychron-k2-max-brown" => "vk_keychron_brown.tap".to_string(),
        "keychron-k2-max-red" => "vk_keychron_red.tap".to_string(),
        "lizard" => "vk_lizard.tap".to_string(),
        "novelkeys-cream" => "vk_novelkeys_cream.tap".to_string(),
        "ticks" => "vk_ticks.tap".to_string(),
        "topre-classic" => "vk_topre.tap".to_string(),
        other => format!("vk_{other}.tap"),
    }
}

fn resolve_key_token(token: &str) -> &'static str {
    let trimmed = token.trim_end_matches(|c: char| c.is_ascii_digit());
    let base = trimmed.strip_suffix('_').unwrap_or(trimmed);

    match base {
        "k01_d" => "alpha_down",
        "k01_u" => "alpha_up",
        "k02_d" => "arrow_down",
        "k02_u" => "arrow_up",
        "k03_d" => "backspace_down",
        "k03_u" => "backspace_up",
        "k04_d" => "caps_lock_down",
        "k04_u" => "caps_lock_up",
        "k05_d" => "command_down",
        "k05_u" => "command_up",
        "k06_d" => "control_down",
        "k06_u" => "control_up",
        "k07_d" => "enter_down",
        "k07_u" => "enter_up",
        "k08_d" => "escape_down",
        "k08_u" => "escape_up",
        "k09_d" => "fn_down",
        "k09_u" => "fn_up",
        "k10_d" => "function_down",
        "k10_u" => "function_up",
        "k11_d" => "modifier_down",
        "k11_u" => "modifier_up",
        "k12_d" => "number_down",
        "k12_u" => "number_up",
        "k13_d" => "option_down",
        "k13_u" => "option_up",
        "k14_d" => "shift_down",
        "k14_u" => "shift_up",
        "k15_d" => "space_down",
        "k15_u" => "space_up",
        "k16_d" => "tab_down",
        "k16_u" => "tab_up",
        _ => "alpha_down",
    }
}

fn resolve_mouse_token(token: &str) -> (&str, Option<bool>) {
    let (base, is_up) = if let Some(b) = token.strip_suffix("_d") {
        (b, Some(false))
    } else if let Some(b) = token.strip_suffix("_u") {
        (b, Some(true))
    } else {
        (token, None)
    };
    let name = match base {
        "m01" => "Bloody V8",
        "m02" => "Glorious Model O",
        "m03" => "IntelliMouse Optical USB and PS2 Compatible",
        "m04" => "Logitech G203",
        "m05" => "Logitech Superlight",
        "m06" => "Rapture Venom",
        "m07" => "Razer DeathAdder V2 Pro",
        "m08" => "Trust GXT 152",
        other => other,
    };
    (name, is_up)
}

/// Builds a realistic press-down (`down`) + spring-release (`up`) pair in RAM
/// from a decoded mouse click buffer. Splits two-transient recordings cleanly or
/// sculpts a lighter micro-switch rebound from single-transient samples.
pub fn build_mouse_profile(sample: &DecodedSample) -> MouseProfile {
    let pcm = &sample.samples;
    if pcm.is_empty() {
        return MouseProfile {
            down: sample.clone(),
            up: sample.clone(),
        };
    }

    let sr = sample.sample_rate.max(8_000) as usize;
    let block_len = ((sr * 3) / 1000).max(32);
    let block_peaks: Vec<f32> = pcm
        .chunks(block_len)
        .map(|chunk| chunk.iter().fold(0.0_f32, |acc, &x| acc.max(x.abs())))
        .collect();

    let (b_peak1, &peak1_amp) = block_peaks
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.total_cmp(b.1))
        .unwrap_or((0, &0.0));

    if peak1_amp < 1e-5 {
        return MouseProfile {
            down: sample.clone(),
            up: sample.clone(),
        };
    }

    let min_sep_blocks = ((sr * 25) / 1000 / block_len).max(4);
    if b_peak1 + min_sep_blocks < block_peaks.len() {
        if let Some((rel_idx, &peak2_amp)) = block_peaks[b_peak1 + min_sep_blocks..]
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
        {
            let b_peak2 = b_peak1 + min_sep_blocks + rel_idx;
            let (rel_v, &valley_amp) = block_peaks[b_peak1..=b_peak2]
                .iter()
                .enumerate()
                .min_by(|a, b| a.1.total_cmp(b.1))
                .unwrap_or((0, &peak1_amp));

            if peak2_amp >= peak1_amp * 0.22 && valley_amp <= peak2_amp * 0.45 {
                let split_idx = ((b_peak1 + rel_v) * block_len).clamp(1, pcm.len() - 1);
                let mut down_vec = pcm[..split_idx].to_vec();
                let fade_out_len = ((sr * 4) / 1000).min(down_vec.len()).max(1);
                let tail_start = down_vec.len() - fade_out_len;
                for (i, s) in down_vec[tail_start..].iter_mut().enumerate() {
                    let t = i as f32 / fade_out_len as f32;
                    *s *= 1.0 - t;
                }

                let up_raw = &pcm[split_idx..];
                let thresh = peak2_amp * 0.08;
                let trim_start = up_raw
                    .iter()
                    .position(|x| x.abs() >= thresh)
                    .unwrap_or(0)
                    .saturating_sub((sr * 2) / 1000);
                let mut up_vec = up_raw[trim_start..].to_vec();
                let fade_in_len = ((sr * 2) / 1000).min(up_vec.len()).max(1);
                for (i, s) in up_vec[..fade_in_len].iter_mut().enumerate() {
                    *s *= (i + 1) as f32 / fade_in_len as f32;
                }

                return MouseProfile {
                    down: DecodedSample {
                        samples: Arc::from(down_vec.into_boxed_slice()),
                        sample_rate: sample.sample_rate,
                    },
                    up: DecodedSample {
                        samples: Arc::from(up_vec.into_boxed_slice()),
                        sample_rate: sample.sample_rate,
                    },
                };
            }
        }
    }

    // Single-transient sample: sculpt a crisp, lighter micro-switch release in RAM
    let peak_sample_idx = pcm
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.abs().total_cmp(&b.1.abs()))
        .map(|(i, _)| i)
        .unwrap_or(0);
    let pre_roll = (sr * 2) / 1000;
    let start = peak_sample_idx.saturating_sub(pre_roll);
    let max_up_len = ((sr * 52) / 1000).max(64);
    let end = (start + max_up_len).min(pcm.len());
    let slice = &pcm[start..end];

    let dt = 1.0 / (sr as f32);
    let rc = 1.0 / (2.0 * std::f32::consts::PI * 420.0);
    let hp_alpha = rc / (rc + dt);
    let mut prev_x = 0.0_f32;
    let mut prev_y = 0.0_f32;
    let fade_in = ((sr * 2) / 1000).min(slice.len()).max(1);
    let dur = slice.len().max(1) as f32;

    let mut up_vec = Vec::with_capacity(slice.len());
    let mut max_up = 0.0_f32;
    for (i, &x) in slice.iter().enumerate() {
        let y = hp_alpha * (prev_y + x - prev_x);
        prev_x = x;
        prev_y = y;

        let t_norm = i as f32 / dur;
        let env = (-4.2 * t_norm).exp() * (1.0 - t_norm * t_norm);
        let attack = if i < fade_in {
            (i + 1) as f32 / fade_in as f32
        } else {
            1.0
        };
        let shaped = y * env * attack;
        max_up = max_up.max(shaped.abs());
        up_vec.push(shaped);
    }

    if max_up > 1e-6 {
        let norm = (peak1_amp * 0.85) / max_up;
        for s in &mut up_vec {
            *s *= norm;
        }
    }

    MouseProfile {
        down: sample.clone(),
        up: DecodedSample {
            samples: Arc::from(up_vec.into_boxed_slice()),
            sample_rate: sample.sample_rate,
        },
    }
}

/// High-throughput in-memory XOR descrambler for `.tap` container chunks.
pub fn descramble_bytes(scrambled: &[u8]) -> Vec<u8> {
    let key_len = VAULT_KEY.len();
    let mut out = vec![0u8; scrambled.len()];
    let mut k = 0;
    for (dst, &src) in out.iter_mut().zip(scrambled.iter()) {
        *dst = src ^ VAULT_KEY[k];
        k += 1;
        if k == key_len {
            k = 0;
        }
    }
    out
}

fn parse_vault_container(bytes: &[u8]) -> Result<(HashMap<String, VaultEntryMeta>, usize), String> {
    if bytes.len() < 20 {
        return Err("Vault container too small (< 20 bytes)".to_string());
    }

    let magic_raw = &bytes[..16];
    let magic = std::str::from_utf8(magic_raw)
        .map_err(|e| format!("Invalid vault magic UTF-8: {e}"))?
        .trim_end_matches('\0');
    if magic != VAULT_MAGIC {
        return Err(format!("Invalid vault magic header: {magic}"));
    }

    let manifest_len = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]) as usize;
    let data_base_offset = 20usize
        .checked_add(manifest_len)
        .ok_or_else(|| "Manifest length overflow".to_string())?;

    if bytes.len() < data_base_offset {
        return Err("Truncated vault manifest".to_string());
    }

    let manifest: HashMap<String, VaultEntryMeta> =
        serde_json::from_slice(&bytes[20..data_base_offset])
            .map_err(|e| format!("Corrupt vault manifest JSON: {e}"))?;

    Ok((manifest, data_base_offset))
}

/// Decodes in-memory WAV or MP3 bytes into a normalized mono `f32` sample buffer.
pub fn decode_audio_bytes(raw_bytes: Vec<u8>, mime: Option<&str>) -> Result<DecodedSample, String> {
    let mut hint = Hint::new();
    if let Some(m) = mime {
        if m.contains("wav") {
            hint.with_extension("wav");
        } else if m.contains("mpeg") || m.contains("mp3") {
            hint.with_extension("mp3");
        }
    } else if raw_bytes.starts_with(b"RIFF") {
        hint.with_extension("wav");
    } else if raw_bytes.starts_with(b"ID3") || (raw_bytes.len() > 1 && raw_bytes[0] == 0xFF) {
        hint.with_extension("mp3");
    }

    let mss = MediaSourceStream::new(Box::new(Cursor::new(raw_bytes)), Default::default());
    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| format!("Audio probe failed: {e}"))?;

    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| "No default audio track found".to_string())?;
    let track_id = track.id;
    let codec_params = track.codec_params.clone();
    let sample_rate = codec_params.sample_rate.unwrap_or(44_100);

    let mut decoder = symphonia::default::get_codecs()
        .make(&codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Audio decoder creation failed: {e}"))?;

    let mut mono_samples = Vec::new();
    let mut sample_buf: Option<SampleBuffer<f32>> = None;

    loop {
        let packet = match format.next_packet() {
            Ok(pkt) => pkt,
            Err(SymphoniaError::IoError(err))
                if err.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(SymphoniaError::ResetRequired) => {
                decoder.reset();
                continue;
            }
            Err(_) => break,
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(_) => break,
        };

        let spec = *decoded.spec();
        let channels = spec.channels.count().max(1);
        let frames = decoded.frames();

        let buf = sample_buf.get_or_insert_with(|| {
            SampleBuffer::<f32>::new(decoded.capacity() as u64, spec)
        });
        if buf.capacity() < frames * channels {
            *buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
        }

        buf.copy_interleaved_ref(decoded);
        let interleaved = buf.samples();

        if channels == 1 {
            mono_samples.extend_from_slice(&interleaved[..frames]);
        } else {
            let inv_ch = 1.0 / channels as f32;
            for frame in interleaved[..frames * channels].chunks_exact(channels) {
                let sum: f32 = frame.iter().copied().sum();
                mono_samples.push(sum * inv_ch);
            }
        }
    }

    if mono_samples.is_empty() {
        return Err("Decoded 0 audio samples".to_string());
    }

    Ok(DecodedSample {
        samples: Arc::from(mono_samples.into_boxed_slice()),
        sample_rate,
    })
}

pub fn embedded_vault_bytes(filename: &str) -> Option<&'static [u8]> {
    match filename {
        "vk_pls.tap" => Some(include_bytes!("../../assets/vault/vk_pls.tap")),
        "vk_srf.tap" => Some(include_bytes!("../../assets/vault/vk_srf.tap")),
        "vk_voi.tap" => Some(include_bytes!("../../assets/vault/vk_voi.tap")),
        "vk_akko_pink.tap" => Some(include_bytes!("../../assets/vault/vk_akko_pink.tap")),
        "vk_akko_jelly_black.tap" => Some(include_bytes!("../../assets/vault/vk_akko_jelly_black.tap")),
        "vk_akko_piano_pro.tap" => Some(include_bytes!("../../assets/vault/vk_akko_piano_pro.tap")),
        "vk_akko_cream_yellow.tap" => Some(include_bytes!("../../assets/vault/vk_akko_cream_yellow.tap")),
        "vk_alps_blue.tap" => Some(include_bytes!("../../assets/vault/vk_alps_blue.tap")),
        "vk_holy_panda.tap" => Some(include_bytes!("../../assets/vault/vk_holy_panda.tap")),
        "vk_durock_alpaca.tap" => Some(include_bytes!("../../assets/vault/vk_durock_alpaca.tap")),
        "vk_gateron_ink_black.tap" => Some(include_bytes!("../../assets/vault/vk_gateron_ink_black.tap")),
        "vk_gateron_ink_red.tap" => Some(include_bytes!("../../assets/vault/vk_gateron_ink_red.tap")),
        "vk_gateron_tealios.tap" => Some(include_bytes!("../../assets/vault/vk_gateron_tealios.tap")),
        "vk_ibm_buckling.tap" => Some(include_bytes!("../../assets/vault/vk_ibm_buckling.tap")),
        "vk_iqunix_mq80.tap" => Some(include_bytes!("../../assets/vault/vk_iqunix_mq80.tap")),
        "vk_kailh_navy.tap" => Some(include_bytes!("../../assets/vault/vk_kailh_navy.tap")),
        "vk_keychron_brown.tap" => Some(include_bytes!("../../assets/vault/vk_keychron_brown.tap")),
        "vk_keychron_red.tap" => Some(include_bytes!("../../assets/vault/vk_keychron_red.tap")),
        "vk_lizard.tap" => Some(include_bytes!("../../assets/vault/vk_lizard.tap")),
        "vk_novelkeys_cream.tap" => Some(include_bytes!("../../assets/vault/vk_novelkeys_cream.tap")),
        "vk_ticks.tap" => Some(include_bytes!("../../assets/vault/vk_ticks.tap")),
        "vk_topre.tap" => Some(include_bytes!("../../assets/vault/vk_topre.tap")),
        "vm_all.tap" => Some(include_bytes!("../../assets/vault/vm_all.tap")),
        _ => None,
    }
}

pub struct VaultCache {
    vault_dir: PathBuf,
    keyboard_packs: HashMap<String, Arc<KeyboardPack>>,
    mouse_profiles: HashMap<String, MouseProfile>,
    mouse_loaded: bool,
}

impl VaultCache {
    pub fn new(vault_dir: PathBuf) -> Self {
        Self {
            vault_dir,
            keyboard_packs: HashMap::new(),
            mouse_profiles: HashMap::new(),
            mouse_loaded: false,
        }
    }

    pub fn load_keyboard_pack(&mut self, pack_name: &str) -> Result<Arc<KeyboardPack>, String> {
        if let Some(cached) = self.keyboard_packs.get(pack_name) {
            return Ok(Arc::clone(cached));
        }

        let filename = keyboard_pack_filename(pack_name);
        let path = self.vault_dir.join(&filename);
        let disk_bytes = fs::read(&path).ok();
        let bytes: &[u8] = if let Some(ref b) = disk_bytes {
            b.as_slice()
        } else if let Some(embedded) = embedded_vault_bytes(&filename) {
            embedded
        } else {
            return Err(format!("Vault not found on disk or embedded: {}", path.display()));
        };

        let (manifest, data_base) = parse_vault_container(bytes)?;
        let mut pack = KeyboardPack::default();

        // Sort tokens deterministically so sample index order is repeatable
        let mut entries: Vec<(String, VaultEntryMeta)> = manifest.into_iter().collect();
        entries.sort_by(|a, b| a.0.cmp(&b.0));

        for (token, info) in entries {
            let start = data_base
                .checked_add(info.offset)
                .ok_or_else(|| format!("Offset overflow for token {token}"))?;
            let end = start
                .checked_add(info.length)
                .ok_or_else(|| format!("Length overflow for token {token}"))?;
            if end > bytes.len() {
                continue;
            }

            let raw = descramble_bytes(&bytes[start..end]);
            if let Ok(sample) = decode_audio_bytes(raw, info.mime.as_deref()) {
                let category_key = resolve_key_token(&token).to_string();
                pack.by_category
                    .entry(category_key)
                    .or_default()
                    .push(sample.clone());
                pack.by_token.insert(token, sample);
            }
        }

        let arc_pack = Arc::new(pack);
        self.keyboard_packs
            .insert(pack_name.to_string(), Arc::clone(&arc_pack));
        Ok(arc_pack)
    }

    pub fn ensure_mouse_vault(&mut self) -> Result<(), String> {
        if self.mouse_loaded {
            return Ok(());
        }

        let path = self.vault_dir.join("vm_all.tap");
        let disk_bytes = fs::read(&path).ok();
        let bytes: &[u8] = if let Some(ref b) = disk_bytes {
            b.as_slice()
        } else if let Some(embedded) = embedded_vault_bytes("vm_all.tap") {
            embedded
        } else {
            return Err(format!(
                "Mouse vault not found on disk or embedded: {}",
                path.display()
            ));
        };

        let (manifest, data_base) = parse_vault_container(bytes)?;
        let mut explicit_parts: HashMap<String, (Option<DecodedSample>, Option<DecodedSample>)> =
            HashMap::new();

        for (token, info) in manifest {
            let start = match data_base.checked_add(info.offset) {
                Some(v) => v,
                None => continue,
            };
            let end = match start.checked_add(info.length) {
                Some(v) => v,
                None => continue,
            };
            if end > bytes.len() {
                continue;
            }

            let raw = descramble_bytes(&bytes[start..end]);
            if let Ok(sample) = decode_audio_bytes(raw, info.mime.as_deref()) {
                let (model_name, explicit_up) = resolve_mouse_token(&token);
                let model_name = model_name.to_string();
                match explicit_up {
                    Some(false) => {
                        explicit_parts.entry(model_name).or_default().0 = Some(sample);
                    }
                    Some(true) => {
                        explicit_parts.entry(model_name).or_default().1 = Some(sample);
                    }
                    None => {
                        let profile = build_mouse_profile(&sample);
                        self.mouse_profiles.insert(model_name, profile.clone());
                        self.mouse_profiles.insert(token, profile);
                    }
                }
            }
        }

        for (model_name, (down_opt, up_opt)) in explicit_parts {
            if let Some(down) = down_opt {
                let up = up_opt.unwrap_or_else(|| build_mouse_profile(&down).up);
                self.mouse_profiles
                    .insert(model_name, MouseProfile { down, up });
            }
        }

        self.mouse_loaded = true;
        Ok(())
    }

    pub fn get_mouse_profile(&mut self, mouse_pack: &str) -> Option<MouseProfile> {
        let _ = self.ensure_mouse_vault();
        self.mouse_profiles
            .get(mouse_pack)
            .or_else(|| self.mouse_profiles.get("Bloody V8"))
            .cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALL_SWITCH_IDS: &[&str] = &[
        "pulse",
        "surfer",
        "void",
        "akko-piano-pro",
        "akko-v3-pro-cream-yellow",
        "akko-cs-jelly-black",
        "durock-alpaca",
        "gateron-ink-black",
        "gateron-ink-red",
        "gateron-turquoise-tealios",
        "novelkeys-cream",
        "keychron-k2-max-red",
        "drop-holy-panda",
        "keychron-k2-max-brown",
        "topre-classic",
        "alps-skcm-blue",
        "kailh-box-navy",
        "akko-clicky-pink",
        "ibm-buckling-spring",
        "iqunix-mq80",
        "lizard",
        "ticks",
    ];

    #[test]
    fn all_22_keyboard_vaults_and_mouse_vault_descramble_and_decode_in_ram() {
        let vault_dir = resolve_vault_dir(None);
        assert!(
            vault_dir.is_dir(),
            "Vault dir not found at {}",
            vault_dir.display()
        );

        let mut cache = VaultCache::new(vault_dir);
        for switch_id in ALL_SWITCH_IDS {
            let pack = cache
                .load_keyboard_pack(switch_id)
                .unwrap_or_else(|e| panic!("Failed to load {switch_id}: {e}"));
            assert!(
                pack.by_category
                    .get("alpha_down")
                    .map(|v| !v.is_empty())
                    .unwrap_or(false),
                "Switch {switch_id} missing alpha_down decoded samples"
            );
            assert!(
                !pack.by_token.is_empty(),
                "Switch {switch_id} decoded 0 tokens"
            );
        }

        let mouse_models = [
            "Bloody V8",
            "Glorious Model O",
            "IntelliMouse Optical USB and PS2 Compatible",
            "Logitech G203",
            "Logitech Superlight",
            "Rapture Venom",
            "Razer DeathAdder V2 Pro",
            "Trust GXT 152",
        ];
        for model in mouse_models {
            let profile = cache
                .get_mouse_profile(model)
                .unwrap_or_else(|| panic!("Missing decoded mouse profile for {model}"));
            assert!(
                !profile.down.samples.is_empty(),
                "Empty mouse down PCM buffer for {model}"
            );
            assert!(
                !profile.up.samples.is_empty(),
                "Empty mouse up PCM buffer for {model}"
            );
        }
    }

    #[test]
    fn embedded_vaults_work_standalone_without_disk_folder() {
        let mut cache = VaultCache::new(PathBuf::from("__nonexistent_portable_vault_dir__"));
        for switch_id in ALL_SWITCH_IDS {
            let pack = cache
                .load_keyboard_pack(switch_id)
                .unwrap_or_else(|e| panic!("Standalone embedded load failed for {switch_id}: {e}"));
            assert!(!pack.by_token.is_empty());
        }
        let mouse = cache.get_mouse_profile("Bloody V8").expect("mouse profile");
        assert!(!mouse.down.samples.is_empty() && !mouse.up.samples.is_empty());
    }

    #[test]
    fn token_resolution_strips_variant_numbers_accurately() {
        assert_eq!(resolve_key_token("k01_d"), "alpha_down");
        assert_eq!(resolve_key_token("k01_d7"), "alpha_down");
        assert_eq!(resolve_key_token("k15_u3"), "space_up");
        assert_eq!(resolve_key_token("k09_d1"), "fn_down");
    }
}
