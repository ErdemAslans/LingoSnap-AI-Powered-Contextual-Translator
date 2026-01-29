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

    // Fallback: return center of screen
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
    // Simulate Ctrl+C to copy selected text
    simulate_ctrl_c();

    // Wait for clipboard to update
    std::thread::sleep(std::time::Duration::from_millis(150));

    // Emit translate event
    app.emit("translate-hotkey", ()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn toggle_indicator(app: AppHandle, show: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("indicator") {
        if show {
            window.show().map_err(|e| e.to_string())?;
        } else {
            window.hide().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn is_indicator_visible(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("indicator") {
        return window.is_visible().map_err(|e| e.to_string());
    }
    Ok(false)
}

#[tauri::command]
pub fn set_auto_translate_on_select(enabled: bool) -> Result<(), String> {
    mouse_hook::set_auto_translate_on_select(enabled);
    Ok(())
}

#[tauri::command]
pub fn get_auto_translate_on_select() -> Result<bool, String> {
    Ok(mouse_hook::is_auto_translate_on_select_enabled())
}
