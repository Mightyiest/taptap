#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod hooks;
mod settings;
mod spatial;
mod vault;

use crate::audio::AudioController;
use crate::hooks::{
    compute_cursor_x_pan, is_cursor_inside_own_window, notify_existing_instance, start_hooks,
    HookEvent,
};
use crate::settings::{
    check_windows_autostart, load_settings, save_settings, set_windows_autostart, AppSettings,
};
use crate::spatial::switch_display_name;
use crate::vault::resolve_vault_dir;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::window::Color;
use tauri::{AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, Position, RunEvent, Size, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

const FIXED_WIN_WIDTH: f64 = 540.0;
const FIXED_WIN_HEIGHT: f64 = 650.0;

pub struct AppState {
    pub settings: Mutex<AppSettings>,
    pub audio: Arc<AudioController>,
    pub is_quitting: AtomicBool,
    pub tray: Mutex<Option<TrayIcon>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InputEventPayload {
    kind: &'static str,
    code: String,
    pan: Option<f32>,
    row: Option<u8>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncAudioConfigArgs {
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
    #[serde(default)]
    pub right_click_menu: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveUiPrefsArgs {
    pub theme: Option<String>,
    pub favorite_switches: Option<Vec<String>>,
    pub right_click_menu: Option<bool>,
}

fn theme_bg_color(theme: &str) -> Color {
    if theme == "dark" {
        Color(30, 15, 20, 255) // #1e0f14
    } else {
        Color(251, 248, 242, 255) // #fbf8f2
    }
}

/// Applies native Windows 11 DWM rounded corners, drop shadow, immersive dark mode,
/// and themed 1px border color without enabling Tao's `MARKER_UNDECORATED_SHADOW`
/// (which shrinks `WM_NCCALCSIZE` client_rect and leaves white non-client bars on
/// fixed-size non-resizable borderless windows).
#[cfg(windows)]
fn apply_dwm_window_styling(win: &WebviewWindow, theme: &str) {
    use std::ffi::c_void;
    use std::ptr;
    use windows_sys::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER,
    };

    const DWMWA_USE_IMMERSIVE_DARK_MODE: u32 = 20;
    const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
    const DWMWA_BORDER_COLOR: u32 = 34;
    const DWMWCP_ROUND: u32 = 2;

    let Ok(hwnd) = win.hwnd() else {
        return;
    };
    let raw_hwnd = hwnd.0;
    if raw_hwnd.is_null() {
        return;
    }

    type DwmSetWindowAttributeFn = unsafe extern "system" fn(
        hwnd: *mut c_void,
        dwattribute: u32,
        pvattribute: *const c_void,
        cbattribute: u32,
    ) -> i32;

    unsafe {
        let dll_name: Vec<u16> = "dwmapi.dll\0".encode_utf16().collect();
        let hmod = LoadLibraryW(dll_name.as_ptr());
        if !hmod.is_null() {
            if let Some(proc_addr) = GetProcAddress(hmod, b"DwmSetWindowAttribute\0".as_ptr()) {
                let dwm_set_attr: DwmSetWindowAttributeFn = std::mem::transmute(proc_addr);

                let is_dark: u32 = if theme == "dark" { 1 } else { 0 };
                let _ = dwm_set_attr(
                    raw_hwnd,
                    DWMWA_USE_IMMERSIVE_DARK_MODE,
                    &is_dark as *const u32 as *const c_void,
                    std::mem::size_of::<u32>() as u32,
                );

                let corner_pref: u32 = DWMWCP_ROUND;
                let _ = dwm_set_attr(
                    raw_hwnd,
                    DWMWA_WINDOW_CORNER_PREFERENCE,
                    &corner_pref as *const u32 as *const c_void,
                    std::mem::size_of::<u32>() as u32,
                );

                // COLORREF is 0x00BBGGRR:
                // Dark (#29151c -> R=0x29, G=0x15, B=0x1c => 0x001c1529)
                // Light (#e4dcce -> R=0xe4, G=0xdc, B=0xce => 0x00cedce4)
                let border_colorref: u32 = if theme == "dark" {
                    0x001c1529
                } else {
                    0x00cedce4
                };
                let _ = dwm_set_attr(
                    raw_hwnd,
                    DWMWA_BORDER_COLOR,
                    &border_colorref as *const u32 as *const c_void,
                    std::mem::size_of::<u32>() as u32,
                );
            }
        }

        let _ = SetWindowPos(
            raw_hwnd,
            ptr::null_mut(),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
}

#[cfg(not(windows))]
fn apply_dwm_window_styling(_win: &WebviewWindow, _theme: &str) {}

fn format_tray_tooltip(soundpack_name: &str, is_muted: bool) -> String {
    let mute_str = if is_muted { " • Muted" } else { "" };
    if soundpack_name.is_empty() {
        format!("Taptap{mute_str} (Stealth Mode)")
    } else {
        format!("Taptap — {soundpack_name}{mute_str} (Stealth Mode)")
    }
}

fn update_tray_tooltip_from_state(state: &AppState) {
    let settings = state.settings.lock().clone();
    let pack_name = switch_display_name(&settings.active_keyboard_pack);
    let tip = format_tray_tooltip(pack_name, settings.master_muted);
    if let Some(ref tray) = *state.tray.lock() {
        let _ = tray.set_tooltip(Some(tip));
    }
}

fn record_window_pos(window: &WebviewWindow, state: &AppState) {
    if let Ok(pos) = window.outer_position() {
        let mut settings = state.settings.lock();
        settings.last_window_pos = Some((pos.x, pos.y));
        save_settings(&settings);
    }
}

fn compute_fixed_window_size(app: &AppHandle) -> (f64, f64) {
    if let Ok(Some(monitor)) = app.primary_monitor() {
        let scale = monitor.scale_factor();
        let scale = if scale > 0.0 { scale } else { 1.0 };
        let work = monitor.work_area().size.to_logical::<f64>(scale);
        let w = FIXED_WIN_WIDTH.min((work.width - 16.0).max(420.0));
        let h = FIXED_WIN_HEIGHT.min((work.height - 16.0).max(480.0));
        return (w, h);
    }
    (FIXED_WIN_WIDTH, FIXED_WIN_HEIGHT)
}

pub fn open_or_focus_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.emit("window-visibility", true);
        return;
    }

    let state = app.state::<AppState>();
    let settings = state.settings.lock().clone();
    let (win_w, win_h) = compute_fixed_window_size(app);

    let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("app.html".into()))
        .title("Taptap")
        .inner_size(win_w, win_h)
        .resizable(false)
        .maximizable(false)
        .decorations(false)
        .shadow(false)
        .background_color(theme_bg_color(&settings.theme));

    if let Some((x, y)) = settings.last_window_pos {
        builder = builder.position(x as f64, y as f64);
    } else {
        builder = builder.center();
    }

    if let Ok(win) = builder.build() {
        let _ = win.set_resizable(false);
        let _ = win.set_maximizable(false);
        apply_dwm_window_styling(&win, &settings.theme);
        let _ = win.set_size(Size::Logical(LogicalSize::new(win_w, win_h)));
        if let Some((x, y)) = settings.last_window_pos {
            let _ = win.set_position(Position::Physical(PhysicalPosition::new(x, y)));
        }
        let _ = win.set_focus();
    }
}

fn spawn_toggle_main_window(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Some(win) = app.get_webview_window("main") {
            let is_vis = win.is_visible().unwrap_or(true);
            let is_min = win.is_minimized().unwrap_or(false);
            if is_vis && !is_min {
                let state = app.state::<AppState>();
                record_window_pos(&win, &state);
                let _ = win.destroy();
            } else {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
        } else {
            open_or_focus_main_window(&app);
        }
    });
}

#[tauri::command]
fn get_all_settings(state: State<'_, AppState>) -> AppSettings {
    state.settings.lock().clone()
}

#[tauri::command]
fn sync_audio_config(args: SyncAudioConfigArgs, state: State<'_, AppState>) {
    let mut settings = state.settings.lock();
    settings.keyboard_volume = args.keyboard_volume.min(100);
    settings.mouse_volume = args.mouse_volume.min(100);
    settings.stereo_width = args.stereo_width.min(200);
    settings.pitch_jitter = args.pitch_jitter.min(80);
    settings.keyboard_muted = args.keyboard_muted;
    settings.mouse_muted = args.mouse_muted;
    settings.master_muted = args.master_muted;
    settings.active_keyboard_pack = args.active_keyboard_pack;
    settings.active_mouse_pack = args.active_mouse_pack;
    settings.play_upstrokes = args.play_upstrokes;
    settings.dynamic_cursor_tracking = args.dynamic_cursor_tracking;
    settings.vertical_elevation = args.vertical_elevation;
    settings.spatial_mode = args.spatial_mode;
    settings.keyboard_layout = args.keyboard_layout;
    if let Some(rcm) = args.right_click_menu {
        settings.right_click_menu = rcm;
    }

    state.audio.update_from_settings(&settings);
    save_settings(&settings);
    drop(settings);
    update_tray_tooltip_from_state(&state);
}

#[tauri::command]
fn save_ui_prefs(args: SaveUiPrefsArgs, app: AppHandle, state: State<'_, AppState>) {
    let mut updated_theme: Option<String> = None;
    {
        let mut settings = state.settings.lock();
        if let Some(theme) = args.theme {
            settings.theme = theme.clone();
            updated_theme = Some(theme);
        }
        if let Some(favs) = args.favorite_switches {
            if !favs.is_empty() {
                settings.favorite_switches = favs;
            }
        }
        if let Some(rcm) = args.right_click_menu {
            settings.right_click_menu = rcm;
        }
        save_settings(&settings);
    }

    if let Some(theme) = updated_theme {
        if let Some(win) = app.get_webview_window("main") {
            let _ = win.set_background_color(Some(theme_bg_color(&theme)));
            apply_dwm_window_styling(&win, &theme);
        }
    }
}

#[tauri::command]
fn set_keyboard_pack(pack_name: String, state: State<'_, AppState>) {
    {
        let mut settings = state.settings.lock();
        settings.active_keyboard_pack = pack_name.clone();
        save_settings(&settings);
    }
    state.audio.set_keyboard_pack(&pack_name);
    update_tray_tooltip_from_state(&state);
}

#[tauri::command]
fn set_mouse_pack(mouse_pack_name: String, state: State<'_, AppState>) {
    {
        let mut settings = state.settings.lock();
        settings.active_mouse_pack = mouse_pack_name.clone();
        save_settings(&settings);
    }
    state.audio.set_mouse_pack(&mouse_pack_name);
}

#[tauri::command]
fn preview_switch(switch_id: String, state: State<'_, AppState>) {
    let audio = Arc::clone(&state.audio);
    tauri::async_runtime::spawn_blocking(move || {
        audio.preview_switch(&switch_id);
    });
}

#[tauri::command]
fn trigger_sound(
    code: String,
    is_upstroke: bool,
    custom_pan: Option<f32>,
    dedupe: Option<bool>,
    state: State<'_, AppState>,
) {
    state
        .audio
        .trigger_checked(&code, is_upstroke, custom_pan, dedupe.unwrap_or(false));
}

#[tauri::command]
fn start_drag_window(window: WebviewWindow) {
    let _ = window.start_dragging();
}

#[tauri::command]
fn resize_window(_window: WebviewWindow, _target_width: f64, _target_height: f64) {
    // Window uses a fixed size (resizable = false) by design; kept as no-op for API compatibility.
}

#[tauri::command]
async fn close_to_tray(window: WebviewWindow, state: State<'_, AppState>) -> Result<(), String> {
    record_window_pos(&window, &state);
    window.destroy().map_err(|e| e.to_string())
}

#[tauri::command]
fn update_tray_status(soundpack: String, is_muted: bool, state: State<'_, AppState>) {
    let tip = format_tray_tooltip(&soundpack, is_muted);
    if let Some(ref tray) = *state.tray.lock() {
        let _ = tray.set_tooltip(Some(tip));
    }
}

#[tauri::command]
fn get_startup_status(state: State<'_, AppState>) -> bool {
    let fallback = state.settings.lock().startup_launch;
    check_windows_autostart(fallback)
}

#[tauri::command]
fn set_startup_status(enable: bool, state: State<'_, AppState>) -> bool {
    let result = set_windows_autostart(enable);
    let mut settings = state.settings.lock();
    settings.startup_launch = result;
    save_settings(&settings);
    result
}

#[tauri::command]
fn open_external_url(url: String) {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return;
    }
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::Shell::ShellExecuteW;
        use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let op: Vec<u16> = "open\0".encode_utf16().collect();
        let target: Vec<u16> = url.encode_utf16().chain(std::iter::once(0)).collect();
        unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                op.as_ptr(),
                target.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            );
        }
    }
}

#[cfg(windows)]
fn acquire_single_instance_mutex() -> bool {
    use windows_sys::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
    use windows_sys::Win32::System::Threading::CreateMutexW;

    let name: Vec<u16> = "Global\\TaptapRustCompanionSingleInstance\0"
        .encode_utf16()
        .collect();
    unsafe {
        let handle = CreateMutexW(std::ptr::null(), 1, name.as_ptr());
        if handle.is_null() {
            return true;
        }
        if GetLastError() == ERROR_ALREADY_EXISTS {
            return false;
        }
        // Keep handle alive for process lifetime
        let _ = handle;
        true
    }
}

fn handle_toggle_mute(app: &AppHandle) {
    let state = app.state::<AppState>();
    let new_muted = state.audio.toggle_muted();
    {
        let mut settings = state.settings.lock();
        settings.master_muted = new_muted;
        save_settings(&settings);
    }
    update_tray_tooltip_from_state(&state);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.emit("taptap://mute-changed", new_muted);
    }
}

pub fn run() {
    #[cfg(windows)]
    if !acquire_single_instance_mutex() {
        notify_existing_instance();
        return;
    }

    let initial_settings = load_settings();

    let is_hidden_startup = std::env::args().any(|arg| arg == "--hidden");

    let app = tauri::Builder::default()
        .setup(move |app| {
            let resource_dir = app.path().resource_dir().ok();
            let vault_dir = resolve_vault_dir(resource_dir.as_deref());
            let audio = AudioController::new(vault_dir, &initial_settings);

            if initial_settings.startup_launch {
                let _ = set_windows_autostart(true);
            }

            let open_item = MenuItemBuilder::with_id("open", "Open Taptap").build(app)?;
            let mute_item =
                MenuItemBuilder::with_id("mute", "Mute / Unmute (Ctrl+Shift+M)").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit Taptap").build(app)?;

            let tray_menu = MenuBuilder::new(app)
                .item(&open_item)
                .separator()
                .item(&mute_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let tooltip = format_tray_tooltip(
                switch_display_name(&initial_settings.active_keyboard_pack),
                initial_settings.master_muted,
            );

            let mut tray_builder = TrayIconBuilder::with_id("taptap-tray")
                .tooltip(tooltip)
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => {
                        let handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            open_or_focus_main_window(&handle);
                        });
                    }
                    "mute" => {
                        handle_toggle_mute(app);
                    }
                    "quit" => {
                        let state = app.state::<AppState>();
                        state.is_quitting.store(true, Ordering::SeqCst);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        spawn_toggle_main_window(tray.app_handle().clone());
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let tray_icon = tray_builder.build(app)?;

            app.manage(AppState {
                settings: Mutex::new(initial_settings),
                audio,
                is_quitting: AtomicBool::new(false),
                tray: Mutex::new(Some(tray_icon)),
            });

            // Start native Win32 keyboard/mouse hooks + Ctrl+Shift+M global shortcut
            let hook_app_handle = app.handle().clone();
            start_hooks(move |evt| {
                let state = hook_app_handle.state::<AppState>();
                match evt {
                    HookEvent::KeyDown { code, .. } => {
                        let res = state.audio.trigger_checked(code, false, None, true);
                        if let Some(win) = hook_app_handle.get_webview_window("main") {
                            let _ = win.emit(
                                "taptap://input-event",
                                InputEventPayload {
                                    kind: "keydown",
                                    code: code.to_string(),
                                    pan: res.as_ref().map(|r| r.pan),
                                    row: res.and_then(|r| r.row),
                                },
                            );
                        }
                    }
                    HookEvent::KeyUp { code, .. } => {
                        state.audio.trigger_checked(code, true, None, true);
                        if let Some(win) = hook_app_handle.get_webview_window("main") {
                            let _ = win.emit(
                                "taptap://input-event",
                                InputEventPayload {
                                    kind: "keyup",
                                    code: code.to_string(),
                                    pan: None,
                                    row: None,
                                },
                            );
                        }
                    }
                    HookEvent::MouseDown { code, x, y } => {
                        // Skip clicks inside Taptap's own window so DOM handles virtual keycaps/mouse pad cleanly
                        if is_cursor_inside_own_window(x, y) {
                            return;
                        }
                        let custom_pan = if state.audio.config_snapshot().dynamic_cursor_tracking {
                            Some(compute_cursor_x_pan(x))
                        } else {
                            None
                        };
                        let res = state.audio.trigger(code, false, custom_pan);
                        if let Some(win) = hook_app_handle.get_webview_window("main") {
                            let _ = win.emit(
                                "taptap://input-event",
                                InputEventPayload {
                                    kind: "mousedown",
                                    code: code.to_string(),
                                    pan: res.map(|r| r.pan),
                                    row: None,
                                },
                            );
                        }
                    }
                    HookEvent::MouseUp { code, x, y } => {
                        if is_cursor_inside_own_window(x, y) {
                            return;
                        }
                        state.audio.trigger(code, true, None);
                        if let Some(win) = hook_app_handle.get_webview_window("main") {
                            let _ = win.emit(
                                "taptap://input-event",
                                InputEventPayload {
                                    kind: "mouseup",
                                    code: code.to_string(),
                                    pan: None,
                                    row: None,
                                },
                            );
                        }
                    }
                    HookEvent::ToggleMute => {
                        handle_toggle_mute(&hook_app_handle);
                    }
                    HookEvent::OpenWindow => {
                        let handle = hook_app_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            open_or_focus_main_window(&handle);
                        });
                    }
                }
            });

            if !is_hidden_startup {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    open_or_focus_main_window(&handle);
                });
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let state = app.state::<AppState>();
                if !state.is_quitting.load(Ordering::SeqCst) {
                    api.prevent_close();
                    if let Ok(pos) = window.outer_position() {
                        let mut s = state.settings.lock();
                        s.last_window_pos = Some((pos.x, pos.y));
                        save_settings(&s);
                    }
                    let win_clone = window.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = win_clone.destroy();
                    });
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_all_settings,
            sync_audio_config,
            save_ui_prefs,
            set_keyboard_pack,
            set_mouse_pack,
            preview_switch,
            trigger_sound,
            start_drag_window,
            resize_window,
            close_to_tray,
            update_tray_status,
            get_startup_status,
            set_startup_status,
            open_external_url
        ])
        .build(tauri::generate_context!())
        .expect("error while building Taptap Tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { api, .. } = event {
            let state = app_handle.state::<AppState>();
            if !state.is_quitting.load(Ordering::SeqCst) {
                // Keep Rust background audio & hooks alive when WebView is destroyed into stealth tray mode
                api.prevent_exit();
            }
        }
    });
}


fn main() {
    run();
}
