mod clipboard;
mod commands;
mod hotkey;
mod tray;
mod window;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::get_clipboard_text,
            commands::get_cursor_position,
            commands::show_translation_popup,
            commands::hide_translation_popup,
            commands::show_window,
            commands::hide_window,
            commands::trigger_translate,
            commands::toggle_indicator,
            commands::is_indicator_visible,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Setup system tray
            tray::setup_tray(&handle)?;

            // Register global hotkey
            hotkey::register_hotkey(&handle)?;

            // Show main window on startup
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

            // Show floating indicator by default
            if let Some(indicator) = app.get_webview_window("indicator") {
                let _ = indicator.show();
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide window instead of closing (keep in tray)
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label();
                if label == "main" || label == "history" || label == "indicator" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
