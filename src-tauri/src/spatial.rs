use std::collections::HashMap;

#[derive(Clone, Copy)]
struct KeyDef {
    code: &'static str,
    units: f32,
}

#[derive(Clone, Debug)]
pub struct LayoutMaps {
    pub spatial_map: HashMap<&'static str, f32>,
    pub row_map: HashMap<&'static str, u8>,
}

const ANSI_68_ROWS: &[&[KeyDef]] = &[
    &[
        KeyDef { code: "Escape", units: 1.0 },
        KeyDef { code: "Digit1", units: 1.0 },
        KeyDef { code: "Digit2", units: 1.0 },
        KeyDef { code: "Digit3", units: 1.0 },
        KeyDef { code: "Digit4", units: 1.0 },
        KeyDef { code: "Digit5", units: 1.0 },
        KeyDef { code: "Digit6", units: 1.0 },
        KeyDef { code: "Digit7", units: 1.0 },
        KeyDef { code: "Digit8", units: 1.0 },
        KeyDef { code: "Digit9", units: 1.0 },
        KeyDef { code: "Digit0", units: 1.0 },
        KeyDef { code: "Minus", units: 1.0 },
        KeyDef { code: "Equal", units: 1.0 },
        KeyDef { code: "Backspace", units: 2.0 },
        KeyDef { code: "Backquote", units: 1.0 },
    ],
    &[
        KeyDef { code: "Tab", units: 1.5 },
        KeyDef { code: "KeyQ", units: 1.0 },
        KeyDef { code: "KeyW", units: 1.0 },
        KeyDef { code: "KeyE", units: 1.0 },
        KeyDef { code: "KeyR", units: 1.0 },
        KeyDef { code: "KeyT", units: 1.0 },
        KeyDef { code: "KeyY", units: 1.0 },
        KeyDef { code: "KeyU", units: 1.0 },
        KeyDef { code: "KeyI", units: 1.0 },
        KeyDef { code: "KeyO", units: 1.0 },
        KeyDef { code: "KeyP", units: 1.0 },
        KeyDef { code: "BracketLeft", units: 1.0 },
        KeyDef { code: "BracketRight", units: 1.0 },
        KeyDef { code: "Backslash", units: 1.5 },
        KeyDef { code: "PageUp", units: 1.0 },
    ],
    &[
        KeyDef { code: "CapsLock", units: 1.75 },
        KeyDef { code: "KeyA", units: 1.0 },
        KeyDef { code: "KeyS", units: 1.0 },
        KeyDef { code: "KeyD", units: 1.0 },
        KeyDef { code: "KeyF", units: 1.0 },
        KeyDef { code: "KeyG", units: 1.0 },
        KeyDef { code: "KeyH", units: 1.0 },
        KeyDef { code: "KeyJ", units: 1.0 },
        KeyDef { code: "KeyK", units: 1.0 },
        KeyDef { code: "KeyL", units: 1.0 },
        KeyDef { code: "Semicolon", units: 1.0 },
        KeyDef { code: "Quote", units: 1.0 },
        KeyDef { code: "Enter", units: 2.25 },
        KeyDef { code: "PageDown", units: 1.0 },
    ],
    &[
        KeyDef { code: "ShiftLeft", units: 2.25 },
        KeyDef { code: "KeyZ", units: 1.0 },
        KeyDef { code: "KeyX", units: 1.0 },
        KeyDef { code: "KeyC", units: 1.0 },
        KeyDef { code: "KeyV", units: 1.0 },
        KeyDef { code: "KeyB", units: 1.0 },
        KeyDef { code: "KeyN", units: 1.0 },
        KeyDef { code: "KeyM", units: 1.0 },
        KeyDef { code: "Comma", units: 1.0 },
        KeyDef { code: "Period", units: 1.0 },
        KeyDef { code: "Slash", units: 1.0 },
        KeyDef { code: "ShiftRight", units: 1.75 },
        KeyDef { code: "ArrowUp", units: 1.0 },
        KeyDef { code: "Delete", units: 1.0 },
    ],
    &[
        KeyDef { code: "ControlLeft", units: 1.25 },
        KeyDef { code: "MetaLeft", units: 1.25 },
        KeyDef { code: "AltLeft", units: 1.25 },
        KeyDef { code: "Space", units: 6.25 },
        KeyDef { code: "AltRight", units: 1.0 },
        KeyDef { code: "Fn", units: 1.0 },
        KeyDef { code: "ControlRight", units: 1.0 },
        KeyDef { code: "ArrowLeft", units: 1.0 },
        KeyDef { code: "ArrowDown", units: 1.0 },
        KeyDef { code: "ArrowRight", units: 1.0 },
    ],
];

const ANSI_60_ROWS: &[&[KeyDef]] = &[
    &[
        KeyDef { code: "Backquote", units: 1.0 },
        KeyDef { code: "Digit1", units: 1.0 },
        KeyDef { code: "Digit2", units: 1.0 },
        KeyDef { code: "Digit3", units: 1.0 },
        KeyDef { code: "Digit4", units: 1.0 },
        KeyDef { code: "Digit5", units: 1.0 },
        KeyDef { code: "Digit6", units: 1.0 },
        KeyDef { code: "Digit7", units: 1.0 },
        KeyDef { code: "Digit8", units: 1.0 },
        KeyDef { code: "Digit9", units: 1.0 },
        KeyDef { code: "Digit0", units: 1.0 },
        KeyDef { code: "Minus", units: 1.0 },
        KeyDef { code: "Equal", units: 1.0 },
        KeyDef { code: "Backspace", units: 2.0 },
    ],
    &[
        KeyDef { code: "Tab", units: 1.5 },
        KeyDef { code: "KeyQ", units: 1.0 },
        KeyDef { code: "KeyW", units: 1.0 },
        KeyDef { code: "KeyE", units: 1.0 },
        KeyDef { code: "KeyR", units: 1.0 },
        KeyDef { code: "KeyT", units: 1.0 },
        KeyDef { code: "KeyY", units: 1.0 },
        KeyDef { code: "KeyU", units: 1.0 },
        KeyDef { code: "KeyI", units: 1.0 },
        KeyDef { code: "KeyO", units: 1.0 },
        KeyDef { code: "KeyP", units: 1.0 },
        KeyDef { code: "BracketLeft", units: 1.0 },
        KeyDef { code: "BracketRight", units: 1.0 },
        KeyDef { code: "Backslash", units: 1.5 },
    ],
    &[
        KeyDef { code: "CapsLock", units: 1.75 },
        KeyDef { code: "KeyA", units: 1.0 },
        KeyDef { code: "KeyS", units: 1.0 },
        KeyDef { code: "KeyD", units: 1.0 },
        KeyDef { code: "KeyF", units: 1.0 },
        KeyDef { code: "KeyG", units: 1.0 },
        KeyDef { code: "KeyH", units: 1.0 },
        KeyDef { code: "KeyJ", units: 1.0 },
        KeyDef { code: "KeyK", units: 1.0 },
        KeyDef { code: "KeyL", units: 1.0 },
        KeyDef { code: "Semicolon", units: 1.0 },
        KeyDef { code: "Quote", units: 1.0 },
        KeyDef { code: "Enter", units: 2.25 },
    ],
    &[
        KeyDef { code: "ShiftLeft", units: 2.25 },
        KeyDef { code: "KeyZ", units: 1.0 },
        KeyDef { code: "KeyX", units: 1.0 },
        KeyDef { code: "KeyC", units: 1.0 },
        KeyDef { code: "KeyV", units: 1.0 },
        KeyDef { code: "KeyB", units: 1.0 },
        KeyDef { code: "KeyN", units: 1.0 },
        KeyDef { code: "KeyM", units: 1.0 },
        KeyDef { code: "Comma", units: 1.0 },
        KeyDef { code: "Period", units: 1.0 },
        KeyDef { code: "Slash", units: 1.0 },
        KeyDef { code: "ShiftRight", units: 2.75 },
    ],
    &[
        KeyDef { code: "ControlLeft", units: 1.25 },
        KeyDef { code: "MetaLeft", units: 1.25 },
        KeyDef { code: "AltLeft", units: 1.25 },
        KeyDef { code: "Space", units: 6.25 },
        KeyDef { code: "AltRight", units: 1.25 },
        KeyDef { code: "MetaRight", units: 1.25 },
        KeyDef { code: "Fn", units: 1.25 },
        KeyDef { code: "ControlRight", units: 1.25 },
    ],
];

const ANSI_75_ROWS: &[&[KeyDef]] = &[
    &[
        KeyDef { code: "Escape", units: 1.0 },
        KeyDef { code: "F1", units: 1.0 },
        KeyDef { code: "F2", units: 1.0 },
        KeyDef { code: "F3", units: 1.0 },
        KeyDef { code: "F4", units: 1.0 },
        KeyDef { code: "F5", units: 1.0 },
        KeyDef { code: "F6", units: 1.0 },
        KeyDef { code: "F7", units: 1.0 },
        KeyDef { code: "F8", units: 1.0 },
        KeyDef { code: "F9", units: 1.0 },
        KeyDef { code: "F10", units: 1.0 },
        KeyDef { code: "F11", units: 1.0 },
        KeyDef { code: "F12", units: 1.0 },
        KeyDef { code: "PrintScreen", units: 1.0 },
        KeyDef { code: "Pause", units: 1.0 },
        KeyDef { code: "Delete", units: 1.0 },
    ],
    &[
        KeyDef { code: "Backquote", units: 1.0 },
        KeyDef { code: "Digit1", units: 1.0 },
        KeyDef { code: "Digit2", units: 1.0 },
        KeyDef { code: "Digit3", units: 1.0 },
        KeyDef { code: "Digit4", units: 1.0 },
        KeyDef { code: "Digit5", units: 1.0 },
        KeyDef { code: "Digit6", units: 1.0 },
        KeyDef { code: "Digit7", units: 1.0 },
        KeyDef { code: "Digit8", units: 1.0 },
        KeyDef { code: "Digit9", units: 1.0 },
        KeyDef { code: "Digit0", units: 1.0 },
        KeyDef { code: "Minus", units: 1.0 },
        KeyDef { code: "Equal", units: 1.0 },
        KeyDef { code: "Backspace", units: 2.0 },
        KeyDef { code: "Home", units: 1.0 },
    ],
    ANSI_68_ROWS[1],
    ANSI_68_ROWS[2],
    &[
        KeyDef { code: "ShiftLeft", units: 2.25 },
        KeyDef { code: "KeyZ", units: 1.0 },
        KeyDef { code: "KeyX", units: 1.0 },
        KeyDef { code: "KeyC", units: 1.0 },
        KeyDef { code: "KeyV", units: 1.0 },
        KeyDef { code: "KeyB", units: 1.0 },
        KeyDef { code: "KeyN", units: 1.0 },
        KeyDef { code: "KeyM", units: 1.0 },
        KeyDef { code: "Comma", units: 1.0 },
        KeyDef { code: "Period", units: 1.0 },
        KeyDef { code: "Slash", units: 1.0 },
        KeyDef { code: "ShiftRight", units: 1.75 },
        KeyDef { code: "ArrowUp", units: 1.0 },
        KeyDef { code: "End", units: 1.0 },
    ],
    ANSI_68_ROWS[4],
];

const APPLE_65_ROWS: &[&[KeyDef]] = &[
    ANSI_68_ROWS[0],
    ANSI_68_ROWS[1],
    ANSI_68_ROWS[2],
    ANSI_68_ROWS[3],
    &[
        KeyDef { code: "ControlLeft", units: 1.25 },
        KeyDef { code: "AltLeft", units: 1.25 },
        KeyDef { code: "MetaLeft", units: 1.25 },
        KeyDef { code: "Space", units: 6.25 },
        KeyDef { code: "MetaRight", units: 1.0 },
        KeyDef { code: "AltRight", units: 1.0 },
        KeyDef { code: "Fn", units: 1.0 },
        KeyDef { code: "ArrowLeft", units: 1.0 },
        KeyDef { code: "ArrowDown", units: 1.0 },
        KeyDef { code: "ArrowRight", units: 1.0 },
    ],
];

/// Computes normalized stereo pan (`[-1.0, 1.0]`) and row index (`0..=4`) for every key in `layout_id`.
pub fn compute_spatial_maps_for_layout(layout_id: &str) -> LayoutMaps {
    let rows = match layout_id {
        "ansi-60" => ANSI_60_ROWS,
        "ansi-75" => ANSI_75_ROWS,
        "apple-65" => APPLE_65_ROWS,
        _ => ANSI_68_ROWS,
    };

    let mut spatial_map = HashMap::with_capacity(96);
    spatial_map.insert("MouseLeft", -0.28);
    spatial_map.insert("MouseMiddle", 0.0);
    spatial_map.insert("MouseRight", 0.28);

    let mut row_map = HashMap::with_capacity(96);
    let total_rows = rows.len();

    for (r_index, row) in rows.iter().enumerate() {
        let mapped_row = if total_rows == 6 {
            ((r_index * 4) / (total_rows - 1)).min(4) as u8
        } else {
            (r_index as u8).min(4)
        };

        let total_row_units: f32 = row.iter().map(|k| k.units).sum();
        let mut current_pos = 0.0_f32;

        for k in *row {
            let center_unit = current_pos + (k.units * 0.5);
            let unit_ratio = if total_row_units > 0.0 {
                center_unit / total_row_units
            } else {
                0.5
            };

            let raw_pan = -0.95 + (unit_ratio * 1.90);
            let rounded = (raw_pan * 1000.0).round() / 1000.0;
            let clamped = rounded.clamp(-1.0, 1.0);

            spatial_map.insert(k.code, clamped);
            row_map.insert(k.code, mapped_row);
            current_pos += k.units;
        }
    }

    LayoutMaps {
        spatial_map,
        row_map,
    }
}

/// Maps a DOM key code to its logical soundpack category (`space`, `enter`, `alpha`, etc.).
pub fn get_sound_category(code: &str) -> &'static str {
    if code == "Space" {
        return "space";
    }
    if code == "Enter" {
        return "enter";
    }
    if code == "Backspace" || code == "Delete" {
        return "backspace";
    }
    if code == "Tab" {
        return "tab";
    }
    if code == "CapsLock" {
        return "caps_lock";
    }
    if code.starts_with("Shift") {
        return "shift";
    }
    if code.starts_with("Control") {
        return "control";
    }
    if code.starts_with("Meta") {
        return "command";
    }
    if code.starts_with("Alt") {
        return "option";
    }
    if code == "Escape" {
        return "escape";
    }
    if code == "Fn" {
        return "fn";
    }
    if code.starts_with("Arrow")
        || code.starts_with("Page")
        || code == "Home"
        || code == "End"
        || code == "Insert"
    {
        return "arrow";
    }
    if (code.starts_with('F') && code.len() <= 3) || code == "PrintScreen" || code == "Pause" {
        return "function";
    }
    if code.starts_with("Digit") || code == "Minus" || code == "Equal" {
        return "number";
    }
    "alpha"
}

/// Returns `(y, z, width_mult)` matching the 3D physical keyboard geometry in `audio-engine.js`.
pub fn row_3d_offset(row: Option<u8>) -> (f32, f32, f32) {
    match row {
        Some(0) => (0.28, -1.75, 1.18),
        Some(1) => (0.12, -1.45, 1.08),
        Some(2) => (-0.05, -1.15, 1.00),
        Some(3) => (-0.22, -0.85, 0.92),
        Some(4) => (-0.38, -0.55, 0.85),
        Some(_) => (-0.05, -1.15, 1.00),
        None => (-0.15, -1.05, 1.00),
    }
}

/// Returns the human-readable name for a switch pack identifier.
pub fn switch_display_name(id: &str) -> &str {
    match id {
        "pulse" => "Lofree Flow 2 (Pulse)",
        "surfer" => "Lofree Flow 2 (Surfer)",
        "void" => "Lofree Flow 2 (Void)",
        "akko-piano-pro" => "Akko Piano Pro",
        "akko-v3-pro-cream-yellow" => "Akko V3 Cream Yellow",
        "akko-cs-jelly-black" => "Akko CS Jelly Black",
        "durock-alpaca" => "Durock Alpaca V2",
        "gateron-ink-black" => "Gateron Ink Black",
        "gateron-ink-red" => "Gateron Ink Red",
        "gateron-turquoise-tealios" => "Gateron Tealios",
        "novelkeys-cream" => "NovelKeys Cream",
        "keychron-k2-max-red" => "Keychron K2 Red",
        "drop-holy-panda" => "Drop Holy Panda",
        "keychron-k2-max-brown" => "Keychron K2 Brown",
        "topre-classic" => "Topre Realforce 45g",
        "alps-skcm-blue" => "Alps SKCM Blue",
        "kailh-box-navy" => "Kailh Box Navy",
        "akko-clicky-pink" => "Akko Clicky Pink",
        "ibm-buckling-spring" => "IBM Model M (Buckling)",
        "iqunix-mq80" => "IQUNIX MQ80",
        "lizard" => "Lizard Pop",
        "ticks" => "Ticks Mechanical",
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_layouts_produce_valid_spatial_ranges() {
        for layout_id in ["ansi-68", "ansi-60", "ansi-75", "apple-65"] {
            let maps = compute_spatial_maps_for_layout(layout_id);
            assert!(
                maps.spatial_map.len() >= 60,
                "layout {layout_id} missing keys"
            );
            for (&code, &pan) in &maps.spatial_map {
                assert!(
                    (-1.0..=1.0).contains(&pan),
                    "pan out of range for {layout_id}/{code}: {pan}"
                );
            }
            for (&code, &row) in &maps.row_map {
                assert!(
                    row <= 4,
                    "row index out of range for {layout_id}/{code}: {row}"
                );
            }
            // Leftmost keys must be negative, rightmost positive
            assert!(maps.spatial_map["KeyA"] < 0.0);
            assert!(maps.spatial_map["Enter"] > 0.0);
        }
    }

    #[test]
    fn fn_key_does_not_collide_with_function_row() {
        assert_eq!(get_sound_category("Fn"), "fn");
        assert_eq!(get_sound_category("F1"), "function");
        assert_eq!(get_sound_category("F12"), "function");
        assert_eq!(get_sound_category("PrintScreen"), "function");
        assert_eq!(get_sound_category("Space"), "space");
        assert_eq!(get_sound_category("Digit5"), "number");
        assert_eq!(get_sound_category("KeyG"), "alpha");
    }
}
