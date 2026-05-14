use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

use crate::mouse_hook;

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let auto_translate_item = CheckMenuItem::with_id(
        app,
        "toggle_auto_translate",
        "Otomatik Çeviri",
        true,
        mouse_hook::is_auto_translate_enabled(),
        None::<&str>,
    )?;
    let show_item = MenuItem::with_id(app, "show", "Ayarlar", true, None::<&str>)?;
    let review_item = MenuItem::with_id(app, "review", "Tekrar Zamanı", true, None::<&str>)?;
    let history_item = MenuItem::with_id(app, "history", "Çeviri Geçmişi", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &auto_translate_item,
        &separator,
        &show_item,
        &review_item,
        &history_item,
        &separator2,
        &quit_item
    ])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().expect("no default icon"))
        .menu(&menu)
        .tooltip("LingoSnap - Metin seç, anında çevir")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle_auto_translate" => {
                let new_state = !mouse_hook::is_auto_translate_enabled();
                mouse_hook::set_auto_translate_enabled(new_state);
                let _ = app.emit("auto-translate-changed", new_state);
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("navigate-tab", "settings");
                }
            }
            "review" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("navigate-tab", "review");
                }
            }
            "history" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("navigate-tab", "history");
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
