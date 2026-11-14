use std::env;
use std::fs;
use std::path::{Path, PathBuf};

#[cfg(windows)]
fn to_short_path(path: &Path) -> PathBuf {
    use std::ffi::{OsStr, OsString};
    use std::os::windows::ffi::{OsStrExt, OsStringExt};

    #[link(name = "kernel32")]
    extern "system" {
        fn GetShortPathNameW(
            lpszLongPath: *const u16,
            lpszShortPath: *mut u16,
            cchBuffer: u32,
        ) -> u32;
    }

    let abs = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let abs_lossy = abs.to_string_lossy();
    // Strip extended-length prefix so windres/gcc receive a standard Win32 path
    let clean = abs_lossy.strip_prefix(r"\\?\").unwrap_or(&abs_lossy);
    let wide: Vec<u16> = OsStr::new(clean)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let len = GetShortPathNameW(wide.as_ptr(), std::ptr::null_mut(), 0);
        if len == 0 {
            return PathBuf::from(clean);
        }
        let mut buf = vec![0u16; len as usize];
        let written = GetShortPathNameW(wide.as_ptr(), buf.as_mut_ptr(), len);
        if written == 0 || written >= len {
            return PathBuf::from(clean);
        }
        PathBuf::from(OsString::from_wide(&buf[..written as usize]))
    }
}

fn find_webview2_loader_dll(dir: &Path) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with("webview2-com-sys") {
                let candidate = path.join("x64").join("WebView2Loader.dll");
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
            // Recurse into registry index hash directories (e.g. index.crates.io-*)
            if dir.file_name().and_then(|n| n.to_str()) == Some("src") {
                if let Some(found) = find_webview2_loader_dll(&path) {
                    return Some(found);
                }
            }
        }
    }
    None
}

fn find_target_profile_dir(out_dir: &Path) -> Option<PathBuf> {
    out_dir
        .ancestors()
        .find(|p| {
            p.parent()
                .and_then(|parent| parent.file_name())
                .and_then(|name| name.to_str())
                == Some("target")
        })
        .map(Path::to_path_buf)
}

fn copy_webview2_loader_for_gnu() {
    if env::var("CARGO_CFG_TARGET_ENV").as_deref() != Ok("gnu") {
        return;
    }

    let out_dir = match env::var("OUT_DIR") {
        Ok(val) => PathBuf::from(val),
        Err(_) => return,
    };

    let Some(target_profile_dir) = find_target_profile_dir(&out_dir) else {
        return;
    };

    let dll_dest = target_profile_dir.join("WebView2Loader.dll");
    if dll_dest.exists() {
        return;
    }

    let cargo_home = env::var("CARGO_HOME")
        .map(PathBuf::from)
        .or_else(|_| env::var("USERPROFILE").map(|p| PathBuf::from(p).join(".cargo")));

    let Ok(cargo_home) = cargo_home else {
        return;
    };

    let registry_src = cargo_home.join("registry").join("src");
    if let Some(dll_src) = find_webview2_loader_dll(&registry_src) {
        if let Err(err) = fs::copy(&dll_src, &dll_dest) {
            println!(
                "cargo:warning=Failed to copy WebView2Loader.dll to {}: {}",
                dll_dest.display(),
                err
            );
        }
    } else {
        println!(
            "cargo:warning=Could not locate webview2-com-sys/x64/WebView2Loader.dll in cargo registry"
        );
    }
}

fn main() {
    #[cfg(windows)]
    {
        if let Ok(out_dir) = env::var("OUT_DIR") {
            let short_out_dir = to_short_path(Path::new(&out_dir));
            env::set_var("OUT_DIR", &short_out_dir);
        }
        let short_icon_path = to_short_path(Path::new("../assets/icon.ico"));
        let attrs = tauri_build::Attributes::new().windows_attributes(
            tauri_build::WindowsAttributes::new().window_icon_path(short_icon_path),
        );
        tauri_build::try_build(attrs).expect("failed to run tauri-build");
    }

    #[cfg(not(windows))]
    {
        tauri_build::build();
    }

    copy_webview2_loader_for_gnu();
}
