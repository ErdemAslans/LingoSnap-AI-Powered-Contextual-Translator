use tauri::{AppHandle, Emitter, Manager};

use crate::clipboard;
use crate::mouse_hook;
use crate::window;

#[cfg(windows)]
use winapi::um::winuser::{keybd_event, KEYEVENTF_KEYUP, VK_LCONTROL};

#[cfg(windows)]
const VK_C: u8 = 0x43;

#[cfg(windows)]
fn simulate_ctrl_c() {
    unsafe {
        keybd_event(VK_LCONTROL as u8, 0, 0, 0);
        std::thread::sleep(std::time::Duration::from_millis(10));
        keybd_event(VK_C, 0, 0, 0);
        std::thread::sleep(std::time::Duration::from_millis(10));
        keybd_event(VK_C, 0, KEYEVENTF_KEYUP, 0);
        std::thread::sleep(std::time::Duration::from_millis(10));
        keybd_event(VK_LCONTROL as u8, 0, KEYEVENTF_KEYUP, 0);
    }
}

#[cfg(not(windows))]
fn simulate_ctrl_c() {}

#[tauri::command]
pub fn get_cursor_position() -> Result<CursorPos, String> {
    #[cfg(windows)]
    {
        use winapi::um::winuser::GetCursorPos;
        use winapi::shared::windef::POINT;
        unsafe {
            let mut point: POINT = std::mem::zeroed();
            if GetCursorPos(&mut point) != 0 {
                return Ok(CursorPos { x: point.x, y: point.y });
            }
        }
    }

    Ok(CursorPos { x: 960, y: 540 })
}

#[derive(serde::Serialize)]
pub struct CursorPos {
    pub x: i32,
    pub y: i32,
}

#[tauri::command]
pub fn get_clipboard_text(app: AppHandle) -> Result<String, String> {
    clipboard::read_clipboard_text(&app)
}

#[tauri::command]
pub fn show_translation_popup(app: AppHandle) -> Result<(), String> {
    window::show_popup_at_cursor(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hide_translation_popup(app: AppHandle) -> Result<(), String> {
    window::hide_popup(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn show_window(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn hide_window(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn trigger_translate(app: AppHandle) -> Result<(), String> {
    simulate_ctrl_c();
    std::thread::sleep(std::time::Duration::from_millis(150));
    app.emit("translate-hotkey", ()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_translating_state(translating: bool) -> Result<(), String> {
    mouse_hook::set_translating(translating);
    Ok(())
}

#[tauri::command]
pub fn set_auto_translate_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    mouse_hook::set_auto_translate_enabled(enabled);
    let _ = app.emit("auto-translate-changed", enabled);
    Ok(())
}

#[tauri::command]
pub fn get_auto_translate_enabled() -> Result<bool, String> {
    Ok(mouse_hook::is_auto_translate_enabled())
}
