//! Main-window housekeeping that needs Windows messages:
//! - tells the UI when displays are plugged in, unplugged or rearranged. Windows sends WM_DISPLAYCHANGE to
//!   top-level windows; we listen on the main window (no polling, nothing runs until a display actually
//!   changes) and emit "displays-changed".
//! - keeps the maximized window inside the screen. A window without a title bar keeps its invisible resize
//!   border when maximized, so it hangs over every edge and its bottom hides under the taskbar; when
//!   maximized, its client area is set to exactly the monitor's work area instead.

#[cfg(windows)]
pub fn watch(app: &tauri::AppHandle) {
    use std::sync::OnceLock;
    use tauri::{Emitter, Manager};
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
    use windows::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{IsZoomed, NCCALCSIZE_PARAMS, WM_DISPLAYCHANGE, WM_NCCALCSIZE};

    static APP: OnceLock<tauri::AppHandle> = OnceLock::new();
    let _ = APP.set(app.clone());

    unsafe extern "system" fn proc(hwnd: HWND, msg: u32, w: WPARAM, l: LPARAM, _id: usize, _data: usize) -> LRESULT {
        if msg == WM_DISPLAYCHANGE {
            if let Some(app) = APP.get() {
                let _ = app.emit("displays-changed", ());
            }
        }
        let result = unsafe { DefSubclassProc(hwnd, msg, w, l) };
        if msg == WM_NCCALCSIZE && w.0 != 0 && unsafe { IsZoomed(hwnd) }.as_bool() {
            let mut info = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
            unsafe {
                let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                if GetMonitorInfoW(monitor, &mut info).as_bool() {
                    let params = &mut *(l.0 as *mut NCCALCSIZE_PARAMS);
                    params.rgrc[0] = info.rcWork;
                }
            }
        }
        result
    }

    let Some(main) = app.get_webview_window("main") else { return };
    let Ok(hwnd) = main.hwnd() else { return };
    unsafe {
        let _ = SetWindowSubclass(HWND(hwnd.0 as _), Some(proc), 1, 0);
    }
}

#[cfg(not(windows))]
pub fn watch(_app: &tauri::AppHandle) {}
