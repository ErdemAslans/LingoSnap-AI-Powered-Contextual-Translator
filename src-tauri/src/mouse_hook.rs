use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU64, Ordering};
use std::sync::OnceLock;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use winapi::shared::minwindef::{LPARAM, LRESULT, WPARAM};
#[cfg(windows)]
use winapi::um::winuser::{
    CallNextHookEx, GetKeyState, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    MSLLHOOKSTRUCT, VK_CONTROL, VK_MENU, VK_SHIFT, WH_MOUSE_LL, WM_LBUTTONDOWN, WM_LBUTTONUP,
};

static MOUSE_HOOK_ENABLED: AtomicBool = AtomicBool::new(false);
static TRANSLATING: AtomicBool = AtomicBool::new(false);
// Set to true while the translation popup is visible — suppresses the hook so
// that interacting with the popup (clicking words, drag-selecting phrases)
// does NOT trigger a new translation cycle.
static POPUP_OPEN: AtomicBool = AtomicBool::new(false);
// User-controlled master switch. The hook ALWAYS runs (so we can re-enable
// instantly), but when AUTO_TRANSLATE_ENABLED is false, mouse events pass
// straight through without ever triggering a translation. Defaults to false
// so the app starts in a quiet state — the user explicitly clicks "Başlat".
static AUTO_TRANSLATE_ENABLED: AtomicBool = AtomicBool::new(false);
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

static LAST_TRIGGER_MS: AtomicU64 = AtomicU64::new(0);
const COOLDOWN_MS: u64 = 3000;

// MOUSE_DOWN_MS = 0 means "no active mouse-down".
#[cfg(windows)]
static MOUSE_DOWN_MS: AtomicU64 = AtomicU64::new(0);
#[cfg(windows)]
static MOUSE_DOWN_X: AtomicI32 = AtomicI32::new(0);
#[cfg(windows)]
static MOUSE_DOWN_Y: AtomicI32 = AtomicI32::new(0);
#[cfg(windows)]
static DEBOUNCE_CANCEL: AtomicBool = AtomicBool::new(false);

const MIN_SELECTION_DISTANCE: i32 = 30;
const MIN_SELECTION_TIME_MS: u64 = 200;
const DEBOUNCE_MS: u64 = 400;

#[cfg(windows)]
fn is_modifier_held() -> bool {
    // SAFETY: GetKeyState is safe to call from any thread; it reads input state for the calling thread.
    unsafe {
        let shift = GetKeyState(VK_SHIFT) as u16;
        let ctrl = GetKeyState(VK_CONTROL) as u16;
        let alt = GetKeyState(VK_MENU) as u16;
        (shift & 0x8000 != 0) || (ctrl & 0x8000 != 0) || (alt & 0x8000 != 0)
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(windows)]
fn cooldown_active(now: u64) -> bool {
    let last = LAST_TRIGGER_MS.load(Ordering::Relaxed);
    last > 0 && now.saturating_sub(last) < COOLDOWN_MS
}

#[cfg(windows)]
unsafe extern "system" fn mouse_hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        // Master kill switch: when the user clicked "Durdur" / disabled auto
        // translate, the hook is a no-op (only forwards events).
        if !AUTO_TRANSLATE_ENABLED.load(Ordering::Relaxed) {
            return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
        }

        // If the popup is currently open, we want clicks/drags inside (or anywhere
        // else) to never spawn a new translation. Bail before touching state.
        if POPUP_OPEN.load(Ordering::Relaxed) {
            return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
        }

        // SAFETY: For WH_MOUSE_LL hooks, lparam is documented to point to MSLLHOOKSTRUCT.
        let mouse_struct = *(lparam as *const MSLLHOOKSTRUCT);

        match wparam as u32 {
            WM_LBUTTONDOWN => {
                DEBOUNCE_CANCEL.store(true, Ordering::Relaxed);
                MOUSE_DOWN_MS.store(now_ms(), Ordering::Relaxed);
                MOUSE_DOWN_X.store(mouse_struct.pt.x, Ordering::Relaxed);
                MOUSE_DOWN_Y.store(mouse_struct.pt.y, Ordering::Relaxed);
            }
            WM_LBUTTONUP => {
                let down_ms = MOUSE_DOWN_MS.swap(0, Ordering::Relaxed);
                if down_ms == 0 {
                    return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
                }

                if is_modifier_held() || TRANSLATING.load(Ordering::Relaxed) {
                    return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
                }

                let now = now_ms();
                if cooldown_active(now) {
                    return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
                }

                let elapsed = now.saturating_sub(down_ms);
                let dx = (mouse_struct.pt.x - MOUSE_DOWN_X.load(Ordering::Relaxed)).abs();
                let dy = (mouse_struct.pt.y - MOUSE_DOWN_Y.load(Ordering::Relaxed)).abs();
                let distance_sq = (dx as i64 * dx as i64) + (dy as i64 * dy as i64);
                let min_sq = (MIN_SELECTION_DISTANCE as i64) * (MIN_SELECTION_DISTANCE as i64);

                if elapsed >= MIN_SELECTION_TIME_MS && distance_sq >= min_sq {
                    if let Some(app) = APP_HANDLE.get() {
                        let app_clone = app.clone();
                        DEBOUNCE_CANCEL.store(false, Ordering::Relaxed);

                        thread::spawn(move || {
                            thread::sleep(Duration::from_millis(DEBOUNCE_MS));

                            if DEBOUNCE_CANCEL.load(Ordering::Relaxed) {
                                return;
                            }
                            if POPUP_OPEN.load(Ordering::Relaxed) {
                                return;
                            }
                            if is_modifier_held() {
                                return;
                            }
                            if TRANSLATING.load(Ordering::Relaxed) {
                                return;
                            }

                            let now = now_ms();
                            if cooldown_active(now) {
                                return;
                            }

                            LAST_TRIGGER_MS.store(now, Ordering::Relaxed);
                            let _ = app_clone.emit("auto-select-translate", ());
                        });
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
    // Race-free single initialization.
    if MOUSE_HOOK_ENABLED
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::Relaxed)
        .is_err()
    {
        return;
    }

    let _ = APP_HANDLE.set(app.clone());

    thread::spawn(|| {
        // SAFETY: Win32 hook APIs require unsafe. The hook handle is owned by this
        // thread for its entire lifetime — installed below and unhooked before exit.
        unsafe {
            let hook = SetWindowsHookExW(
                WH_MOUSE_LL,
                Some(mouse_hook_proc),
                std::ptr::null_mut(),
                0,
            );

            if hook.is_null() {
                MOUSE_HOOK_ENABLED.store(false, Ordering::SeqCst);
                return;
            }

            let mut msg = std::mem::zeroed();
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                if !MOUSE_HOOK_ENABLED.load(Ordering::Relaxed) {
                    break;
                }
            }

            UnhookWindowsHookEx(hook);
        }
    });
}

pub fn set_translating(translating: bool) {
    TRANSLATING.store(translating, Ordering::Relaxed);
}

pub fn set_popup_open(open: bool) {
    POPUP_OPEN.store(open, Ordering::Relaxed);
    if open {
        // Cancel any debounced trigger that might fire right after the popup appears.
        DEBOUNCE_CANCEL.store(true, Ordering::Relaxed);
    }
}

pub fn set_auto_translate_enabled(enabled: bool) {
    AUTO_TRANSLATE_ENABLED.store(enabled, Ordering::Relaxed);
    if !enabled {
        // Drop any in-flight debounced trigger so disabling is instant.
        DEBOUNCE_CANCEL.store(true, Ordering::Relaxed);
    }
}

pub fn is_auto_translate_enabled() -> bool {
    AUTO_TRANSLATE_ENABLED.load(Ordering::Relaxed)
}

#[cfg(not(windows))]
pub fn start_mouse_hook(_app: &AppHandle) {}
