use tauri::AppHandle;
use tauri::Emitter;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg(windows)]
use winapi::um::winuser::{keybd_event, KEYEVENTF_KEYUP, VK_LCONTROL};

#[cfg(windows)]
const VK_C: u8 = 0x43; // C key code

#[cfg(windows)]
fn simulate_ctrl_c() {
    unsafe {
        // Press Ctrl
        keybd_event(VK_LCONTROL as u8, 0, 0, 0);
        // Small delay between key presses
        std::thread::sleep(std::time::Duration::from_millis(10));
        // Press C
        keybd_event(VK_C, 0, 0, 0);
        std::thread::sleep(std::time::Duration::from_millis(10));
        // Release C
        keybd_event(VK_C, 0, KEYEVENTF_KEYUP, 0);
        std::thread::sleep(std::time::Duration::from_millis(10));
        // Release Ctrl
        keybd_event(VK_LCONTROL as u8, 0, KEYEVENTF_KEYUP, 0);
    }
}

#[cfg(not(windows))]
fn simulate_ctrl_c() {
    // On non-Windows, user must manually copy
}

pub fn register_hotkey(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Use Ctrl+Shift+C for copy+translate (doesn't interfere with normal Ctrl+C)
    let shortcut: Shortcut = "CmdOrCtrl+Shift+C".parse().expect("invalid shortcut");

    app.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            // Auto-copy selected text
            simulate_ctrl_c();

            // Wait for clipboard to update
            std::thread::sleep(std::time::Duration::from_millis(150));

            let _ = app.emit("translate-hotkey", ());
        }
    })?;

    Ok(())
}

pub fn unregister_all(app: &AppHandle) {
    let _ = app.global_shortcut().unregister_all();
}
