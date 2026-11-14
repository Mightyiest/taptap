use std::collections::HashSet;
use std::sync::mpsc::{self, SyncSender};
use std::sync::OnceLock;
use std::thread;

#[derive(Clone, Debug)]
pub enum HookEvent {
    KeyDown { vk: u32, code: &'static str },
    KeyUp { vk: u32, code: &'static str },
    MouseDown { code: &'static str, x: i32, y: i32 },
    MouseUp { code: &'static str, x: i32, y: i32 },
    ToggleMute,
    OpenWindow,
}

static HOOK_TX: OnceLock<SyncSender<HookEvent>> = OnceLock::new();

#[cfg(windows)]
mod win32_hooks {
    use super::{HookEvent, HOOK_TX};
    use std::ffi::c_void;
    use std::ptr;
    use windows_sys::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, POINT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        RegisterHotKey, UnregisterHotKey, MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, CreateWindowExW, DefWindowProcW, DispatchMessageW, FindWindowExW,
        GetAncestor, GetMessageW, GetSystemMetrics, GetWindowThreadProcessId, PostMessageW,
        RegisterClassW, SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx,
        WindowFromPoint, GA_ROOT, GA_ROOTOWNER, HHOOK, HWND_MESSAGE, KBDLLHOOKSTRUCT, LLKHF_UP,
        MSG, MSLLHOOKSTRUCT, SM_CXSCREEN, SM_CXVIRTUALSCREEN, SM_XVIRTUALSCREEN, WH_KEYBOARD_LL,
        WH_MOUSE_LL, WM_APP, WM_HOTKEY, WM_KEYDOWN, WM_KEYUP, WM_LBUTTONDOWN, WM_LBUTTONUP,
        WM_MBUTTONDOWN, WM_MBUTTONUP, WM_RBUTTONDOWN, WM_RBUTTONUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
        WNDCLASSW,
    };

    const HOTKEY_MUTE_ID: i32 = 1;
    const WM_TAPTAP_WAKEUP: u32 = WM_APP + 1;
    const WAKEUP_CLASS: &str = "TaptapSingleInstanceWakeupWnd";

    fn to_wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn notify_existing_instance() {
        let class_w = to_wide(WAKEUP_CLASS);
        unsafe {
            let hwnd = FindWindowExW(HWND_MESSAGE, ptr::null_mut(), class_w.as_ptr(), ptr::null());
            if !hwnd.is_null() {
                PostMessageW(hwnd, WM_TAPTAP_WAKEUP, 0, 0);
            }
        }
    }

    pub fn is_point_in_current_process(x: i32, y: i32) -> bool {
        unsafe {
            let hwnd = WindowFromPoint(POINT { x, y });
            if hwnd.is_null() {
                return false;
            }
            let current_pid = std::process::id();
            // WindowFromPoint inside WebView2 returns a child msedgewebview2.exe HWND;
            // walk to GA_ROOT / GA_ROOTOWNER to match the host Tauri process.
            let candidates = [
                hwnd,
                GetAncestor(hwnd, GA_ROOT),
                GetAncestor(hwnd, GA_ROOTOWNER),
            ];
            for candidate in candidates {
                if !candidate.is_null() {
                    let mut pid: u32 = 0;
                    GetWindowThreadProcessId(candidate, &mut pid);
                    if pid == current_pid {
                        return true;
                    }
                }
            }
            false
        }
    }

    pub fn compute_cursor_x_pan(x: i32) -> f32 {
        unsafe {
            let vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let vw = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            let (origin, width) = if vw > 0 {
                (vx, vw)
            } else {
                (0, GetSystemMetrics(SM_CXSCREEN).max(1920))
            };
            let ratio = ((x - origin) as f32 / width as f32).clamp(0.0, 1.0);
            (ratio - 0.5) * 2.0
        }
    }

    #[inline]
    pub(super) fn vk_to_dom_code(vk: u32) -> Option<&'static str> {
        match vk {
            0x41 => Some("KeyA"),
            0x42 => Some("KeyB"),
            0x43 => Some("KeyC"),
            0x44 => Some("KeyD"),
            0x45 => Some("KeyE"),
            0x46 => Some("KeyF"),
            0x47 => Some("KeyG"),
            0x48 => Some("KeyH"),
            0x49 => Some("KeyI"),
            0x4A => Some("KeyJ"),
            0x4B => Some("KeyK"),
            0x4C => Some("KeyL"),
            0x4D => Some("KeyM"),
            0x4E => Some("KeyN"),
            0x4F => Some("KeyO"),
            0x50 => Some("KeyP"),
            0x51 => Some("KeyQ"),
            0x52 => Some("KeyR"),
            0x53 => Some("KeyS"),
            0x54 => Some("KeyT"),
            0x55 => Some("KeyU"),
            0x56 => Some("KeyV"),
            0x57 => Some("KeyW"),
            0x58 => Some("KeyX"),
            0x59 => Some("KeyY"),
            0x5A => Some("KeyZ"),
            0x30 | 0x60 => Some("Digit0"),
            0x31 | 0x61 => Some("Digit1"),
            0x32 | 0x62 => Some("Digit2"),
            0x33 | 0x63 => Some("Digit3"),
            0x34 | 0x64 => Some("Digit4"),
            0x35 | 0x65 => Some("Digit5"),
            0x36 | 0x66 => Some("Digit6"),
            0x37 | 0x67 => Some("Digit7"),
            0x38 | 0x68 => Some("Digit8"),
            0x39 | 0x69 => Some("Digit9"),
            0x6A => Some("NumpadMultiply"),
            0x6B => Some("NumpadAdd"),
            0x6C => Some("Enter"),
            0x6D => Some("NumpadSubtract"),
            0x6E => Some("NumpadDecimal"),
            0x6F => Some("NumpadDivide"),
            0x70 => Some("F1"),
            0x71 => Some("F2"),
            0x72 => Some("F3"),
            0x73 => Some("F4"),
            0x74 => Some("F5"),
            0x75 => Some("F6"),
            0x76 => Some("F7"),
            0x77 => Some("F8"),
            0x78 => Some("F9"),
            0x79 => Some("F10"),
            0x7A => Some("F11"),
            0x7B => Some("F12"),
            0x08 => Some("Backspace"),
            0x09 => Some("Tab"),
            0x0D => Some("Enter"),
            0x10 | 0xA0 => Some("ShiftLeft"),
            0xA1 => Some("ShiftRight"),
            0x11 | 0xA2 => Some("ControlLeft"),
            0xA3 => Some("ControlRight"),
            0x12 | 0xA4 => Some("AltLeft"),
            0xA5 => Some("AltRight"),
            0x13 => Some("Pause"),
            0x14 => Some("CapsLock"),
            0x1B => Some("Escape"),
            0x20 => Some("Space"),
            0x21 => Some("PageUp"),
            0x22 => Some("PageDown"),
            0x23 => Some("End"),
            0x24 => Some("Home"),
            0x25 => Some("ArrowLeft"),
            0x26 => Some("ArrowUp"),
            0x27 => Some("ArrowRight"),
            0x28 => Some("ArrowDown"),
            0x2C => Some("PrintScreen"),
            0x2D => Some("Insert"),
            0x2E => Some("Delete"),
            0x5B => Some("MetaLeft"),
            0x5C => Some("MetaRight"),
            0xBA => Some("Semicolon"),
            0xBB => Some("Equal"),
            0xBC => Some("Comma"),
            0xBD => Some("Minus"),
            0xBE => Some("Period"),
            0xBF => Some("Slash"),
            0xC0 => Some("Backquote"),
            0xDB => Some("BracketLeft"),
            0xDC => Some("Backslash"),
            0xDD => Some("BracketRight"),
            0xDE => Some("Quote"),
            // Ignore lock toggles (NumLock 0x90, ScrollLock 0x91), media/browser (0xA6..),
            // IME (0xE5), Fn, and unmapped OEM VKs.
            _ => None,
        }
    }

    unsafe extern "system" fn keyboard_hook_proc(
        code: i32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if code >= 0 {
            let kb = &*(lparam as *const KBDLLHOOKSTRUCT);
            let msg = wparam as u32;
            let is_key_msg =
                msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN || msg == WM_KEYUP || msg == WM_SYSKEYUP;

            if is_key_msg {
                if let Some(dom_code) = vk_to_dom_code(kb.vkCode) {
                    if let Some(tx) = HOOK_TX.get() {
                        let is_up =
                            (kb.flags & LLKHF_UP) != 0 || msg == WM_KEYUP || msg == WM_SYSKEYUP;
                        if is_up {
                            let _ = tx.try_send(HookEvent::KeyUp {
                                vk: kb.vkCode,
                                code: dom_code,
                            });
                        } else {
                            let _ = tx.try_send(HookEvent::KeyDown {
                                vk: kb.vkCode,
                                code: dom_code,
                            });
                        }
                    }
                }
            }
        }
        CallNextHookEx(ptr::null_mut(), code, wparam, lparam)
    }

    unsafe extern "system" fn mouse_hook_proc(
        code: i32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if code >= 0 {
            let msg = wparam as u32;
            // Fast-path skip WM_MOUSEMOVE / WM_MOUSEWHEEL so cursor movement never touches channels
            let mapped = match msg {
                WM_LBUTTONDOWN => Some((true, "MouseLeft")),
                WM_LBUTTONUP => Some((false, "MouseLeft")),
                WM_RBUTTONDOWN => Some((true, "MouseRight")),
                WM_RBUTTONUP => Some((false, "MouseRight")),
                WM_MBUTTONDOWN => Some((true, "MouseMiddle")),
                WM_MBUTTONUP => Some((false, "MouseMiddle")),
                _ => None,
            };

            if let Some((is_down, btn_code)) = mapped {
                if let Some(tx) = HOOK_TX.get() {
                    let ms = &*(lparam as *const MSLLHOOKSTRUCT);
                    if is_down {
                        let _ = tx.try_send(HookEvent::MouseDown {
                            code: btn_code,
                            x: ms.pt.x,
                            y: ms.pt.y,
                        });
                    } else {
                        let _ = tx.try_send(HookEvent::MouseUp {
                            code: btn_code,
                            x: ms.pt.x,
                            y: ms.pt.y,
                        });
                    }
                }
            }
        }
        CallNextHookEx(ptr::null_mut(), code, wparam, lparam)
    }

    unsafe extern "system" fn wakeup_wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if msg == WM_TAPTAP_WAKEUP {
            if let Some(tx) = HOOK_TX.get() {
                let _ = tx.try_send(HookEvent::OpenWindow);
            }
            return 0;
        }
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }

    pub fn run_message_pump() {
        unsafe {
            let hmod: HINSTANCE = GetModuleHandleW(ptr::null()) as HINSTANCE;

            let class_w = to_wide(WAKEUP_CLASS);
            let wc = WNDCLASSW {
                style: 0,
                lpfnWndProc: Some(wakeup_wnd_proc),
                cbClsExtra: 0,
                cbWndExtra: 0,
                hInstance: hmod,
                hIcon: ptr::null_mut(),
                hCursor: ptr::null_mut(),
                hbrBackground: ptr::null_mut(),
                lpszMenuName: ptr::null(),
                lpszClassName: class_w.as_ptr(),
            };
            RegisterClassW(&wc);
            let _wakeup_hwnd = CreateWindowExW(
                0,
                class_w.as_ptr(),
                ptr::null(),
                0,
                0,
                0,
                0,
                0,
                HWND_MESSAGE,
                ptr::null_mut(),
                hmod as *mut c_void,
                ptr::null(),
            );

            let mut kb_hook: HHOOK =
                SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), hmod, 0);
            if kb_hook.is_null() {
                kb_hook = SetWindowsHookExW(
                    WH_KEYBOARD_LL,
                    Some(keyboard_hook_proc),
                    ptr::null_mut(),
                    0,
                );
            }
            let mut ms_hook: HHOOK =
                SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), hmod, 0);
            if ms_hook.is_null() {
                ms_hook = SetWindowsHookExW(
                    WH_MOUSE_LL,
                    Some(mouse_hook_proc),
                    ptr::null_mut(),
                    0,
                );
            }

            // Global Ctrl+Shift+M mute hotkey
            let _ = RegisterHotKey(
                ptr::null_mut(),
                HOTKEY_MUTE_ID,
                MOD_CONTROL | MOD_SHIFT | MOD_NOREPEAT,
                0x4D,
            );

            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, ptr::null_mut(), 0, 0) > 0 {
                if msg.message == WM_HOTKEY && msg.wParam as i32 == HOTKEY_MUTE_ID {
                    if let Some(tx) = HOOK_TX.get() {
                        let _ = tx.try_send(HookEvent::ToggleMute);
                    }
                }
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            let _ = UnregisterHotKey(ptr::null_mut(), HOTKEY_MUTE_ID);
            if !kb_hook.is_null() {
                let _ = UnhookWindowsHookEx(kb_hook);
            }
            if !ms_hook.is_null() {
                let _ = UnhookWindowsHookEx(ms_hook);
            }
        }
    }
}

pub fn notify_existing_instance() {
    #[cfg(windows)]
    win32_hooks::notify_existing_instance();
}

pub fn start_hooks<F>(mut on_event: F)
where
    F: FnMut(HookEvent) + Send + 'static,
{
    let (tx, rx) = mpsc::sync_channel::<HookEvent>(256);
    if HOOK_TX.set(tx).is_err() {
        return;
    }

    thread::Builder::new()
        .name("taptap-hook-dispatcher".to_string())
        .spawn(move || {
            let mut pressed_vks: HashSet<u32> = HashSet::with_capacity(32);

            while let Ok(evt) = rx.recv() {
                match evt {
                    HookEvent::KeyDown { vk, code } => {
                        // Filter OS key-repeat so holding a key never retriggers downstroke
                        if pressed_vks.insert(vk) {
                            on_event(HookEvent::KeyDown { vk, code });
                        }
                    }
                    HookEvent::KeyUp { vk, code } => {
                        if pressed_vks.remove(&vk) {
                            on_event(HookEvent::KeyUp { vk, code });
                        }
                    }
                    other => on_event(other),
                }
            }
        })
        .ok();

    #[cfg(windows)]
    {
        thread::Builder::new()
            .name("taptap-win32-hooks".to_string())
            .spawn(win32_hooks::run_message_pump)
            .ok();
    }
}

pub fn is_cursor_inside_own_window(x: i32, y: i32) -> bool {
    #[cfg(windows)]
    {
        win32_hooks::is_point_in_current_process(x, y)
    }
    #[cfg(not(windows))]
    {
        let _ = (x, y);
        false
    }
}

pub fn compute_cursor_x_pan(x: i32) -> f32 {
    #[cfg(windows)]
    {
        win32_hooks::compute_cursor_x_pan(x)
    }
    #[cfg(not(windows))]
    {
        let _ = x;
        0.0
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::win32_hooks::vk_to_dom_code;

    #[test]
    fn vk_mapping_ignores_unknown_and_maps_numpad_operators() {
        assert_eq!(vk_to_dom_code(0x41), Some("KeyA"));
        assert_eq!(vk_to_dom_code(0x6A), Some("NumpadMultiply"));
        assert_eq!(vk_to_dom_code(0x6B), Some("NumpadAdd"));
        assert_eq!(vk_to_dom_code(0x6C), Some("Enter"));
        assert_eq!(vk_to_dom_code(0x6D), Some("NumpadSubtract"));
        assert_eq!(vk_to_dom_code(0x6E), Some("NumpadDecimal"));
        assert_eq!(vk_to_dom_code(0x6F), Some("NumpadDivide"));

        assert_eq!(vk_to_dom_code(0x90), None); // NumLock
        assert_eq!(vk_to_dom_code(0x91), None); // ScrollLock
        assert_eq!(vk_to_dom_code(0xA6), None); // BrowserBack / media
        assert_eq!(vk_to_dom_code(0xE5), None); // IME ProcessKey
        assert_eq!(vk_to_dom_code(0xFF), None); // Unmapped / Fn
    }
}
