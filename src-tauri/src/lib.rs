use serde::Serialize;
use std::{
    sync::{mpsc, Mutex, OnceLock},
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    AppHandle, Emitter, LogicalSize, Manager, State, WebviewWindow,
};

const BASE_WINDOW_WIDTH: f64 = 560.0;
const BASE_WINDOW_HEIGHT: f64 = 470.0;
const MIN_PET_SCALE: f64 = 0.5;
const MAX_PET_SCALE: f64 = 2.0;

#[cfg(target_os = "windows")]
use std::{
    ptr,
    sync::atomic::{AtomicU64, Ordering},
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::{
    Foundation::{LPARAM, LRESULT, WPARAM},
    System::LibraryLoader::GetModuleHandleW,
    UI::WindowsAndMessaging::{
        CallNextHookEx, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx, KBDLLHOOKSTRUCT, MSG,
        MSLLHOOKSTRUCT, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_KEYUP, WM_LBUTTONDOWN,
        WM_LBUTTONUP, WM_MBUTTONDOWN, WM_MBUTTONUP, WM_MOUSEMOVE, WM_MOUSEWHEEL, WM_RBUTTONDOWN,
        WM_RBUTTONUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
    },
};

struct WindowSettings {
    always_on_top: bool,
    click_through: bool,
    scale: f64,
}

impl Default for WindowSettings {
    fn default() -> Self {
        Self {
            always_on_top: true,
            click_through: false,
            scale: 1.0,
        }
    }
}

#[derive(Default)]
struct SettingsState(Mutex<WindowSettings>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GlobalInputEvent {
    kind: &'static str,
    key_code: Option<u32>,
    button: Option<&'static str>,
    hand: Option<&'static str>,
    x: Option<i32>,
    y: Option<i32>,
    delta: Option<i32>,
    window_x: Option<i32>,
    window_y: Option<i32>,
    window_width: Option<u32>,
    window_height: Option<u32>,
    timestamp: u64,
}

fn timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn normalize_pet_scale(scale: f64) -> f64 {
    let finite_scale = if scale.is_finite() { scale } else { 1.0 };
    let clamped_scale = finite_scale.clamp(MIN_PET_SCALE, MAX_PET_SCALE);
    (clamped_scale * 100.0).round() / 100.0
}

fn resize_pet_window(window: &WebviewWindow, scale: f64) -> Result<f64, String> {
    let normalized_scale = normalize_pet_scale(scale);
    let target_size = LogicalSize::new(
        BASE_WINDOW_WIDTH * normalized_scale,
        BASE_WINDOW_HEIGHT * normalized_scale,
    );

    window
        .set_size(target_size)
        .map_err(|error| error.to_string())?;

    Ok(normalized_scale)
}

fn keyboard_hand(key_code: u32) -> &'static str {
    match key_code {
        0x09
        | 0x10
        | 0x11
        | 0x14
        | 0x1B
        | 0x20
        | 0x30..=0x35
        | 0x41..=0x47
        | 0x51..=0x54
        | 0x56
        | 0x57
        | 0x58
        | 0x5A => "left",
        _ => "right",
    }
}

#[tauri::command]
fn start_dragging(window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())
}

#[tauri::command]
fn set_click_through(
    window: WebviewWindow,
    enabled: bool,
    state: State<'_, SettingsState>,
) -> Result<bool, String> {
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|error| error.to_string())?;
    state
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .click_through = enabled;
    Ok(enabled)
}

#[tauri::command]
fn set_always_on_top(
    window: WebviewWindow,
    enabled: bool,
    state: State<'_, SettingsState>,
) -> Result<bool, String> {
    window
        .set_always_on_top(enabled)
        .map_err(|error| error.to_string())?;
    state
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .always_on_top = enabled;
    Ok(enabled)
}

#[tauri::command]
fn set_pet_scale(
    window: WebviewWindow,
    scale: f64,
    state: State<'_, SettingsState>,
) -> Result<f64, String> {
    let applied_scale = resize_pet_window(&window, scale)?;
    state.0.lock().map_err(|error| error.to_string())?.scale = applied_scale;
    window
        .emit("pet-scale-changed", applied_scale)
        .map_err(|error| error.to_string())?;
    Ok(applied_scale)
}

fn toggle_click_through(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let state = app.state::<SettingsState>();
    if let Ok(mut settings) = state.0.lock() {
        let next = !settings.click_through;
        if window.set_ignore_cursor_events(next).is_ok() {
            settings.click_through = next;
        }
    };
}

fn toggle_always_on_top(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let state = app.state::<SettingsState>();
    if let Ok(mut settings) = state.0.lock() {
        let next = !settings.always_on_top;
        if window.set_always_on_top(next).is_ok() {
            settings.always_on_top = next;
        }
    };
}

fn toggle_visibility(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn apply_pet_scale(app: &AppHandle, scale: f64) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(applied_scale) = resize_pet_window(&window, scale) else {
        return;
    };

    let state = app.state::<SettingsState>();
    if let Ok(mut settings) = state.0.lock() {
        settings.scale = applied_scale;
    }
    let _ = window.emit("pet-scale-changed", applied_scale);
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let visibility = MenuItem::with_id(app, "visibility", "Show / Hide", true, None::<&str>)?;
    let always_on_top = MenuItem::with_id(
        app,
        "always_on_top",
        "Toggle Always On Top",
        true,
        None::<&str>,
    )?;
    let click_through = MenuItem::with_id(
        app,
        "click_through",
        "Toggle Click Through",
        true,
        None::<&str>,
    )?;
    let scale_50 = MenuItem::with_id(app, "scale_50", "50%", true, None::<&str>)?;
    let scale_75 = MenuItem::with_id(app, "scale_75", "75%", true, None::<&str>)?;
    let scale_100 = MenuItem::with_id(app, "scale_100", "100%", true, None::<&str>)?;
    let scale_125 = MenuItem::with_id(app, "scale_125", "125%", true, None::<&str>)?;
    let scale_150 = MenuItem::with_id(app, "scale_150", "150%", true, None::<&str>)?;
    let scale_200 = MenuItem::with_id(app, "scale_200", "200%", true, None::<&str>)?;
    let scale_menu = Submenu::with_items(
        app,
        "Pet Size",
        true,
        &[
            &scale_50, &scale_75, &scale_100, &scale_125, &scale_150, &scale_200,
        ],
    )?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &visibility,
            &always_on_top,
            &click_through,
            &scale_menu,
            &separator,
            &quit,
        ],
    )?;

    let mut tray = TrayIconBuilder::with_id("desktop-pet-tray")
        .menu(&menu)
        .tooltip("Usagi Desk Sync")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "visibility" => toggle_visibility(app),
            "always_on_top" => toggle_always_on_top(app),
            "click_through" => toggle_click_through(app),
            "scale_50" => apply_pet_scale(app, 0.5),
            "scale_75" => apply_pet_scale(app, 0.75),
            "scale_100" => apply_pet_scale(app, 1.0),
            "scale_125" => apply_pet_scale(app, 1.25),
            "scale_150" => apply_pet_scale(app, 1.5),
            "scale_200" => apply_pet_scale(app, 2.0),
            "quit" => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg(target_os = "windows")]
static INPUT_SENDER: OnceLock<mpsc::Sender<GlobalInputEvent>> = OnceLock::new();
#[cfg(target_os = "windows")]
static LAST_MOUSE_MOVE: AtomicU64 = AtomicU64::new(0);

#[cfg(target_os = "windows")]
unsafe extern "system" fn keyboard_hook(code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if code >= 0 {
        let message = w_param as u32;
        let kind = match message {
            WM_KEYDOWN | WM_SYSKEYDOWN => Some("key_down"),
            WM_KEYUP | WM_SYSKEYUP => Some("key_up"),
            _ => None,
        };
        if let Some(kind) = kind {
            let data = &*(l_param as *const KBDLLHOOKSTRUCT);
            if let Some(sender) = INPUT_SENDER.get() {
                let _ = sender.send(GlobalInputEvent {
                    kind,
                    key_code: Some(data.vkCode),
                    button: None,
                    hand: Some(keyboard_hand(data.vkCode)),
                    x: None,
                    y: None,
                    delta: None,
                    window_x: None,
                    window_y: None,
                    window_width: None,
                    window_height: None,
                    timestamp: timestamp_ms(),
                });
            }
        }
    }
    CallNextHookEx(ptr::null_mut(), code, w_param, l_param)
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn mouse_hook(code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if code >= 0 {
        let message = w_param as u32;
        let data = &*(l_param as *const MSLLHOOKSTRUCT);
        let now = timestamp_ms();
        let event = match message {
            WM_LBUTTONDOWN => Some(("mouse_down", Some("left"), None)),
            WM_LBUTTONUP => Some(("mouse_up", Some("left"), None)),
            WM_RBUTTONDOWN => Some(("mouse_down", Some("right"), None)),
            WM_RBUTTONUP => Some(("mouse_up", Some("right"), None)),
            WM_MBUTTONDOWN => Some(("mouse_down", Some("middle"), None)),
            WM_MBUTTONUP => Some(("mouse_up", Some("middle"), None)),
            WM_MOUSEWHEEL => {
                let delta = ((data.mouseData >> 16) as i16) as i32;
                Some(("mouse_wheel", None, Some(delta)))
            }
            WM_MOUSEMOVE => {
                let last = LAST_MOUSE_MOVE.load(Ordering::Relaxed);
                if now.saturating_sub(last) >= 50 {
                    LAST_MOUSE_MOVE.store(now, Ordering::Relaxed);
                    Some(("mouse_move", None, None))
                } else {
                    None
                }
            }
            _ => None,
        };

        if let (Some(sender), Some((kind, button, delta))) = (INPUT_SENDER.get(), event) {
            let _ = sender.send(GlobalInputEvent {
                kind,
                key_code: None,
                button,
                hand: None,
                x: Some(data.pt.x),
                y: Some(data.pt.y),
                delta,
                window_x: None,
                window_y: None,
                window_width: None,
                window_height: None,
                timestamp: now,
            });
        }
    }
    CallNextHookEx(ptr::null_mut(), code, w_param, l_param)
}

#[cfg(target_os = "windows")]
fn start_global_input_listener(app: AppHandle) {
    let (sender, receiver) = mpsc::channel::<GlobalInputEvent>();
    if INPUT_SENDER.set(sender).is_err() {
        return;
    }

    thread::spawn(move || {
        for mut event in receiver {
            if event.kind == "mouse_move" {
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(position) = window.outer_position() {
                        event.window_x = Some(position.x);
                        event.window_y = Some(position.y);
                    }
                    if let Ok(size) = window.outer_size() {
                        event.window_width = Some(size.width);
                        event.window_height = Some(size.height);
                    }
                }
            }
            let _ = app.emit("global-input", event);
        }
    });

    thread::spawn(|| unsafe {
        let module = GetModuleHandleW(ptr::null());
        let keyboard = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook), module, 0);
        let mouse = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook), module, 0);

        if keyboard.is_null() || mouse.is_null() {
            if !keyboard.is_null() {
                UnhookWindowsHookEx(keyboard);
            }
            if !mouse.is_null() {
                UnhookWindowsHookEx(mouse);
            }
            return;
        }

        let mut message: MSG = std::mem::zeroed();
        while GetMessageW(&mut message, ptr::null_mut(), 0, 0) > 0 {}

        UnhookWindowsHookEx(keyboard);
        UnhookWindowsHookEx(mouse);
    });
}

#[cfg(not(target_os = "windows"))]
fn start_global_input_listener(_app: AppHandle) {}

pub fn run() {
    tauri::Builder::default()
        .manage(SettingsState::default())
        .invoke_handler(tauri::generate_handler![
            start_dragging,
            set_click_through,
            set_always_on_top,
            set_pet_scale
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.set_ignore_cursor_events(false)?;
            }
            build_tray(app.handle())?;
            start_global_input_listener(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running desktop pet");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pet_scale_is_clamped_and_rounded() {
        assert_eq!(normalize_pet_scale(f64::NAN), 1.0);
        assert_eq!(normalize_pet_scale(0.2), MIN_PET_SCALE);
        assert_eq!(normalize_pet_scale(2.4), MAX_PET_SCALE);
        assert_eq!(normalize_pet_scale(1.249), 1.25);
    }
}
