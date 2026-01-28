use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

pub fn read_clipboard_text(app: &AppHandle) -> Result<String, String> {
    app.clipboard()
        .read_text()
        .map_err(|e| format!("Failed to read clipboard: {}", e))
}
