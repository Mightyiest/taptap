use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    pub keyboard_volume: u8,
    pub mouse_volume: u8,
    pub stereo_width: u16,
    pub pitch_jitter: u16,
    pub keyboard_muted: bool,
    pub mouse_muted: bool,
    pub master_muted: bool,
    pub active_keyboard_pack: String,
    pub active_mouse_pack: String,
    pub play_upstrokes: bool,
    pub dynamic_cursor_tracking: bool,
    pub vertical_elevation: bool,
    pub spatial_mode: String,
    pub keyboard_layout: String,
    pub theme: String,
    pub favorite_switches: Vec<String>,
    pub startup_launch: bool,
    pub right_click_menu: bool,
    pub last_window_pos: Option<(i32, i32)>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            keyboard_volume: 85,
            mouse_volume: 85,
            stereo_width: 100,
            pitch_jitter: 25,
            keyboard_muted: false,
            mouse_muted: false,
            master_muted: false,
            active_keyboard_pack: "pulse".to_string(),
            active_mouse_pack: "Bloody V8".to_string(),
            play_upstrokes: true,
            dynamic_cursor_tracking: true,
            vertical_elevation: true,
            spatial_mode: "hrtf".to_string(),
            keyboard_layout: "ansi-68".to_string(),
            theme: "light".to_string(),
            favorite_switches: vec![
                "pulse".to_string(),
                "drop-holy-panda".to_string(),
                "kailh-box-navy".to_string(),
            ],
            startup_launch: false,
            right_click_menu: false,
            last_window_pos: None,
        }
    }
}

pub fn settings_file_path() -> PathBuf {
    let base = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir());
    base.join("com.taptap.companion").join("taptap-settings.json")
}

pub fn load_settings() -> AppSettings {
    let path = settings_file_path();
    if let Ok(raw) = fs::read_to_string(&path) {
        if let Ok(parsed) = serde_json::from_str::<AppSettings>(&raw) {
            return parsed;
        }
    }
    AppSettings::default()
}

pub fn save_settings(settings: &AppSettings) {
    let path = settings_file_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(settings) {
        let _ = fs::write(path, json);
    }
}

#[cfg(windows)]
mod win_autostart {
    use windows_sys::Win32::Foundation::ERROR_SUCCESS;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
        HKEY, HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_SZ,
    };

    fn to_wide_null(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn is_enabled() -> bool {
        let subkey = to_wide_null("Software\\Microsoft\\Windows\\CurrentVersion\\Run");
        let val_name = to_wide_null("Taptap");
        let mut hkey: HKEY = std::ptr::null_mut();
        unsafe {
            if RegOpenKeyExW(HKEY_CURRENT_USER, subkey.as_ptr(), 0, KEY_READ, &mut hkey)
                != ERROR_SUCCESS
            {
                return false;
            }
            let mut size: u32 = 0;
            let status = RegQueryValueExW(
                hkey,
                val_name.as_ptr(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                &mut size,
            );
            RegCloseKey(hkey);
            status == ERROR_SUCCESS && size > 2
        }
    }

    pub fn set_enabled(enable: bool) -> bool {
        let subkey = to_wide_null("Software\\Microsoft\\Windows\\CurrentVersion\\Run");
        let val_name = to_wide_null("Taptap");
        let mut hkey: HKEY = std::ptr::null_mut();
        unsafe {
            if RegOpenKeyExW(HKEY_CURRENT_USER, subkey.as_ptr(), 0, KEY_WRITE, &mut hkey)
                != ERROR_SUCCESS
            {
                return false;
            }

            if enable {
                let exe = std::env::var_os("TAPTAP_PORTABLE_EXE")
                    .map(|p| p.to_string_lossy().into_owned())
                    .filter(|s| !s.is_empty())
                    .or_else(|| {
                        std::env::current_exe()
                            .ok()
                            .map(|p| p.to_string_lossy().into_owned())
                    })
                    .unwrap_or_else(|| "taptap.exe".to_string());
                let cmd = format!("\"{exe}\" --hidden");
                let wide_cmd = to_wide_null(&cmd);
                let byte_len = (wide_cmd.len() * std::mem::size_of::<u16>()) as u32;
                let res = RegSetValueExW(
                    hkey,
                    val_name.as_ptr(),
                    0,
                    REG_SZ,
                    wide_cmd.as_ptr() as *const u8,
                    byte_len,
                );
                RegCloseKey(hkey);
                res == ERROR_SUCCESS
            } else {
                let _ = RegDeleteValueW(hkey, val_name.as_ptr());
                RegCloseKey(hkey);
                false
            }
        }
    }
}

pub fn check_windows_autostart(_fallback: bool) -> bool {
    #[cfg(windows)]
    {
        win_autostart::is_enabled()
    }
    #[cfg(not(windows))]
    {
        _fallback
    }
}

pub fn set_windows_autostart(enable: bool) -> bool {
    #[cfg(windows)]
    {
        win_autostart::set_enabled(enable)
    }
    #[cfg(not(windows))]
    {
        enable
    }
}
