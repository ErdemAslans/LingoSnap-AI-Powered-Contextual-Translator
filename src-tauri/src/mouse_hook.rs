use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::OnceLock;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use winapi::shared::minwindef::{LPARAM, LRESULT, WPARAM};
#[cfg(windows)]
use winapi::shared::windef::HHOOK;
#[cfg(windows)]
use winapi::um::winuser::{
    CallNextHookEx, GetKeyState, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    MSLLHOOKSTRUCT, WH_MOUSE_LL, WM_LBUTTONDOWN, WM_LBUTTONUP,
    VK_SHIFT, VK_CONTROL, VK_MENU,
};

static MOUSE_HOOK_ENABLED: AtomicBool = AtomicBool::new(false);
static TRANSLATING: AtomicBool = AtomicBool::new(false);
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

static LAST_TRIGGER_MS: AtomicU64 = AtomicU64::new(0);
const COOLDOWN_MS: u64 = 3000;

#[cfg(windows)]
static mut HOOK_HANDLE: Option<HHOOK> = None;
#[cfg(windows)]
static mut MOUSE_DOWN_TIME: Option<Instant> = None;
#[cfg(windows)]
static mut MOUSE_DOWN_POS: (i32, i32) = (0, 0);
#[cfg(windows)]
static DEBOUNCE_CANCEL: AtomicBool = AtomicBool::new(false);

const MIN_SELECTION_DISTANCE: i32 = 30;
const MIN_SELECTION_TIME_MS: u64 = 200;
const DEBOUNCE_MS: u64 = 400;

#[cfg(windows)]
fn is_modifier_held() -> bool {
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
unsafe extern "system" fn mouse_hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let mouse_struct = *(lparam as *const MSLLHOOKSTRUCT);

        match wparam as u32 {
            WM_LBUTTONDOWN => {
                DEBOUNCE_CANCEL.store(true, Ordering::Relaxed);
                MOUSE_DOWN_TIME = Some(Instant::now());
                MOUSE_DOWN_POS = (mouse_struct.pt.x, mouse_struct.pt.y);
            }
            WM_LBUTTONUP => {
                if let Some(down_time) = MOUSE_DOWN_TIME.take() {
                    if is_modifier_held() {
                        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
                    }

                    if TRANSLATING.load(Ordering::Relaxed) {
                        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
                    }

                    let now = now_ms();
                    let last = LAST_TRIGGER_MS.load(Ordering::Relaxed);
                    if last > 0 && now - last < COOLDOWN_MS {
                        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
                    }

                    let elapsed = down_time.elapsed().as_millis() as u64;
                    let dx = (mouse_struct.pt.x - MOUSE_DOWN_POS.0).abs();
                    let dy = (mouse_struct.pt.y - MOUSE_DOWN_POS.1).abs();
                    let distance = ((dx * dx + dy * dy) as f64).sqrt() as i32;

                    if elapsed >= MIN_SELECTION_TIME_MS && distance >= MIN_SELECTION_DISTANCE {
                        if let Some(app) = APP_HANDLE.get() {
                            let app_clone = app.clone();
                            DEBOUNCE_CANCEL.store(false, Ordering::Relaxed);

                            thread::spawn(move || {
                                thread::sleep(Duration::from_millis(DEBOUNCE_MS));

                                if DEBOUNCE_CANCEL.load(Ordering::Relaxed) {
                                    return;
                                }

                                if is_modifier_held() {
                                    return;
                                }

                                if TRANSLATING.load(Ordering::Relaxed) {
                                    return;
                                }

                                let now = now_ms();
                                let last = LAST_TRIGGER_MS.load(Ordering::Relaxed);
                                if last > 0 && now - last < COOLDOWN_MS {
                                    return;
                                }

                                LAST_TRIGGER_MS.store(now, Ordering::Relaxed);
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
        return;
    }

    let _ = APP_HANDLE.set(app.clone());

    thread::spawn(|| {
        unsafe {
            let hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), std::ptr::null_mut(), 0);

            if !hook.is_null() {
                HOOK_HANDLE = Some(hook);
                MOUSE_HOOK_ENABLED.store(true, Ordering::Relaxed);

                let mut msg = std::mem::zeroed();
                while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                    if !MOUSE_HOOK_ENABLED.load(Ordering::Relaxed) {
                        break;
                    }
                }

                if let Some(h) = HOOK_HANDLE.take() {
                    UnhookWindowsHookEx(h);
                }
            }
        }
    });
}

pub fn set_translating(translating: bool) {
    TRANSLATING.store(translating, Ordering::Relaxed);
}

#[cfg(not(windows))]
pub fn start_mouse_hook(_app: &AppHandle) {}
