use tauri::{AppHandle, Manager, PhysicalPosition};

pub fn show_popup_at_cursor(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("popup") {
        // Try to get cursor position; fall back to center
        let position = window
            .cursor_position()
            .unwrap_or(PhysicalPosition::new(400.0, 300.0).into());

        let _ = window.set_position(tauri::Position::Physical(PhysicalPosition::new(
            position.x as i32 + 10,
            position.y as i32 + 10,
        )));
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(())
}

pub fn hide_popup(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("popup") {
        let _ = window.hide();
    }
    Ok(())
}
