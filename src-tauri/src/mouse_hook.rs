use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

#[cfg(windows)]
use winapi::shared::minwindef::{LPARAM, LRESULT, WPARAM};
#[cfg(windows)]
use winapi::shared::windef::HHOOK;
#[cfg(windows)]
use winapi::um::winuser::{
    CallNextHookEx, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    MSLLHOOKSTRUCT, WH_MOUSE_LL, WM_LBUTTONDOWN, WM_LBUTTONUP,
};

// Global state
static MOUSE_HOOK_ENABLED: AtomicBool = AtomicBool::new(false);
static AUTO_TRANSLATE_ON_SELECT: AtomicBool = AtomicBool::new(false);
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

#[cfg(windows)]
static mut HOOK_HANDLE: Option<HHOOK> = None;
#[cfg(windows)]
static mut MOUSE_DOWN_TIME: Option<Instant> = None;
#[cfg(windows)]
static mut MOUSE_DOWN_POS: (i32, i32) = (0, 0);

// Minimum drag distance and time to consider it a text selection
const MIN_SELECTION_DISTANCE: i32 = 20;
const MIN_SELECTION_TIME_MS: u64 = 150;

#[cfg(windows)]
unsafe extern "system" fn mouse_hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 && AUTO_TRANSLATE_ON_SELECT.load(Ordering::Relaxed) {
        let mouse_struct = *(lparam as *const MSLLHOOKSTRUCT);

        match wparam as u32 {
            WM_LBUTTONDOWN => {
                MOUSE_DOWN_TIME = Some(Instant::now());
                MOUSE_DOWN_POS = (mouse_struct.pt.x, mouse_struct.pt.y);
            }
            WM_LBUTTONUP => {
                if let Some(down_time) = MOUSE_DOWN_TIME.take() {
                    let elapsed = down_time.elapsed().as_millis() as u64;
                    let dx = (mouse_struct.pt.x - MOUSE_DOWN_POS.0).abs();
                    let dy = (mouse_struct.pt.y - MOUSE_DOWN_POS.1).abs();
                    let distance = ((dx * dx + dy * dy) as f64).sqrt() as i32;

                    // Check if this looks like a text selection (dragged for some distance/time)
                    if elapsed >= MIN_SELECTION_TIME_MS && distance >= MIN_SELECTION_DISTANCE {
                        // Trigger translation after a small delay
                        if let Some(app) = APP_HANDLE.get() {
                            let app_clone = app.clone();
                            thread::spawn(move || {
                                // Small delay to let selection complete
                                thread::sleep(Duration::from_millis(100));
                                let _ = app_clone.emit("auto-select-translate", ());
                            });
                        }
                    }
                }
            }
            _ => {}
        }
    }

    CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
}

#[cfg(windows)]
pub fn start_mouse_hook(app: &AppHandle) {
    if MOUSE_HOOK_ENABLED.load(Ordering::Relaxed) {
        return; // Already running
    }

    let _ = APP_HANDLE.set(app.clone());

    thread::spawn(|| {
        unsafe {
            let hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), std::ptr::null_mut(), 0);

            if !hook.is_null() {
                HOOK_HANDLE = Some(hook);
                MOUSE_HOOK_ENABLED.store(true, Ordering::Relaxed);

                // Message loop to keep hook alive
                let mut msg = std::mem::zeroed();
                while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                    if !MOUSE_HOOK_ENABLED.load(Ordering::Relaxed) {
                        break;
                    }
                }

                // Cleanup
                if let Some(h) = HOOK_HANDLE.take() {
                    UnhookWindowsHookEx(h);
                }
            }
        }
    });
}

#[cfg(windows)]
pub fn stop_mouse_hook() {
    MOUSE_HOOK_ENABLED.store(false, Ordering::Relaxed);
}

#[cfg(windows)]
pub fn set_auto_translate_on_select(enabled: bool) {
    AUTO_TRANSLATE_ON_SELECT.store(enabled, Ordering::Relaxed);
}

#[cfg(windows)]
pub fn is_auto_translate_on_select_enabled() -> bool {
    AUTO_TRANSLATE_ON_SELECT.load(Ordering::Relaxed)
}

// Non-Windows stubs
#[cfg(not(windows))]
pub fn start_mouse_hook(_app: &AppHandle) {}

#[cfg(not(windows))]
pub fn stop_mouse_hook() {}

#[cfg(not(windows))]
pub fn set_auto_translate_on_select(_enabled: bool) {}

#[cfg(not(windows))]
pub fn is_auto_translate_on_select_enabled() -> bool {
    false
}
