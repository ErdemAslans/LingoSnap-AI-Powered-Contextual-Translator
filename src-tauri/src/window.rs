use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

pub fn show_popup_at_cursor(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("popup") {
        // Try to get cursor position; fall back to center
        let cursor_pos = window
            .cursor_position()
            .unwrap_or(PhysicalPosition::new(400.0, 300.0).into());

        // Get popup window size
        let popup_size = window
            .outer_size()
            .unwrap_or(PhysicalSize::new(500, 400));

        // Get the monitor where the cursor is located
        let monitor = window.current_monitor().ok().flatten();

        let (screen_width, screen_height, screen_x, screen_y) = if let Some(m) = monitor {
            let size = m.size();
            let pos = m.position();
            (size.width as i32, size.height as i32, pos.x, pos.y)
        } else {
            // Fallback to reasonable defaults
            (1920, 1080, 0, 0)
        };

        // Calculate position with offset
        let mut x = cursor_pos.x as i32 + 10;
        let mut y = cursor_pos.y as i32 + 10;

        // Ensure popup stays within screen bounds
        // Right edge check
        if x + popup_size.width as i32 > screen_x + screen_width {
            x = cursor_pos.x as i32 - popup_size.width as i32 - 10;
        }
        // Bottom edge check
        if y + popup_size.height as i32 > screen_y + screen_height {
            y = cursor_pos.y as i32 - popup_size.height as i32 - 10;
        }
        // Left edge check
        if x < screen_x {
            x = screen_x + 10;
        }
        // Top edge check
        if y < screen_y {
            y = screen_y + 10;
        }

        let _ = window.set_position(tauri::Position::Physical(PhysicalPosition::new(x, y)));
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
