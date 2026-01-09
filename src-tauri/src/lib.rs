// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{
    Manager,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct ClaudeOAuth {
    #[serde(rename = "accessToken")]
    access_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ClaudeCredentials {
    #[serde(rename = "claudeAiOauth")]
    claude_ai_oauth: ClaudeOAuth,
}

#[derive(Debug, Serialize, Deserialize)]
struct UsageLimit {
    utilization: f64,
    #[serde(rename = "resets_at")]
    resets_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct UsageResponse {
    #[serde(rename = "five_hour")]
    five_hour: Option<UsageLimit>,
    #[serde(rename = "seven_day")]
    seven_day: Option<UsageLimit>,
    #[serde(rename = "sonnet_only")]
    sonnet_only: Option<UsageLimit>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UsageData {
    #[serde(rename = "sessionUtilization")]
    session_utilization: f64,
    #[serde(rename = "sessionResetsAt")]
    session_resets_at: Option<String>,
    #[serde(rename = "weeklyUtilization")]
    weekly_utilization: f64,
    #[serde(rename = "weeklyResetsAt")]
    weekly_resets_at: Option<String>,
    #[serde(rename = "sonnetUtilization")]
    sonnet_utilization: Option<f64>,
    #[serde(rename = "sonnetResetsAt")]
    sonnet_resets_at: Option<String>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
#[cfg(target_os = "macos")]
async fn get_access_token() -> Result<String, String> {
    use keyring::Entry;
    use std::env;
    
    // Get the current macOS username (account in Keychain)
    let username = env::var("USER")
        .or_else(|_| env::var("USERNAME"))
        .unwrap_or_else(|_| "user".to_string());
    
    let entry = Entry::new("Claude Code-credentials", &username)
        .map_err(|e| format!("Keychain error: {}", e))?;
    
    let password = entry.get_password()
        .map_err(|e| {
            match e {
                keyring::Error::NoEntry => "Not logged in to Claude Code".to_string(),
                keyring::Error::Ambiguous(_) => "Multiple entries found".to_string(),
                _ => format!("Keychain access error: {}", e),
            }
        })?;
    
    // Parse JSON from the password string
    let creds: ClaudeCredentials = serde_json::from_str(&password)
        .map_err(|e| format!("Invalid credential format: {}", e))?;
    
    Ok(creds.claude_ai_oauth.access_token)
}

#[tauri::command]
#[cfg(not(target_os = "macos"))]
async fn get_access_token() -> Result<String, String> {
    Err("Keychain access is only available on macOS".to_string())
}

#[tauri::command]
async fn fetch_usage_test() -> Result<UsageData, String> {
    // Return example data for testing the UI
    use chrono::Utc;
    
    let now = Utc::now();
    let session_reset = now + chrono::Duration::hours(2) + chrono::Duration::minutes(30);
    let weekly_reset = now + chrono::Duration::days(3) + chrono::Duration::hours(12);
    
    Ok(UsageData {
        session_utilization: 45.5,
        session_resets_at: Some(session_reset.to_rfc3339()),
        weekly_utilization: 72.3,
        weekly_resets_at: Some(weekly_reset.to_rfc3339()),
        sonnet_utilization: Some(35.0),
        sonnet_resets_at: Some(session_reset.to_rfc3339()),
    })
}

#[tauri::command]
async fn fetch_usage() -> Result<UsageData, String> {
    // First get the access token
    let token = get_access_token().await?;
    
    // Create HTTP client
    let client = reqwest::Client::new();
    
    // Make API request
    let response = client
        .get("https://api.anthropic.com/api/oauth/usage")
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .header("User-Agent", "ClaudeUsage/0.1.0")
        .header("Authorization", format!("Bearer {}", token))
        .header("anthropic-beta", "oauth-2025-04-20")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    // Check status
    if !response.status().is_success() {
        let status = response.status();
        if status.as_u16() == 401 {
            return Err("Authentication expired. Run 'claude' to re-authenticate.".to_string());
        }
        return Err(format!("API error (code: {})", status.as_u16()));
    }
    
    // Parse response
    let usage_response: UsageResponse = response
        .json()
        .await
        .map_err(|e| format!("Invalid response from API: {}", e))?;
    
    // Convert to UsageData
    let usage_data = UsageData {
        session_utilization: usage_response.five_hour.as_ref().map(|f| f.utilization).unwrap_or(0.0),
        session_resets_at: usage_response.five_hour.as_ref().and_then(|f| f.resets_at.clone()),
        weekly_utilization: usage_response.seven_day.as_ref().map(|f| f.utilization).unwrap_or(0.0),
        weekly_resets_at: usage_response.seven_day.as_ref().and_then(|f| f.resets_at.clone()),
        sonnet_utilization: usage_response.sonnet_only.as_ref().map(|f| f.utilization),
        sonnet_resets_at: usage_response.sonnet_only.as_ref().and_then(|f| f.resets_at.clone()),
    };
    
    Ok(usage_data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Hide dock icon on macOS (menubar only)
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            
            let window = app.get_webview_window("main").unwrap();
            
            // Hide window initially
            let _ = window.hide();

            // Hide on blur (but not if always-on-top is enabled)
            let w = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::Focused(false) = event {
                    // Only hide if always-on-top is not enabled
                    if let Ok(is_always_on_top) = w.is_always_on_top() {
                        if !is_always_on_top {
                            let _ = w.hide();
                        }
                    } else {
                        // If we can't check, default to hiding (original behavior)
                        let _ = w.hide();
                    }
                }
            });

            // Create menu items
            let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            
            // Create menu
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Build system tray with custom icon
            let icon_path = app.path().resolve("resources/tray-icon.png", tauri::path::BaseDirectory::Resource)?;
            let icon = tauri::image::Image::from_path(icon_path)?;
            
            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .icon_as_template(true) // Makes it look good on both dark/light macOS menubars
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            rect,
                            ..
                        } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let is_visible = window.is_visible().unwrap_or(false);
                                if is_visible {
                                    let _ = window.hide();
                                } else {
                                    // Position window below the tray icon
                                    let window_size = window.outer_size().unwrap_or_default();
                                    
                                    // Get physical coordinates from rect
                                    let (pos_x, pos_y) = match rect.position {
                                        tauri::Position::Physical(p) => (p.x as f64, p.y as f64),
                                        tauri::Position::Logical(l) => (l.x, l.y),
                                    };
                                    let (size_w, size_h) = match rect.size {
                                        tauri::Size::Physical(s) => (s.width as f64, s.height as f64),
                                        tauri::Size::Logical(l) => (l.width, l.height),
                                    };

                                    let icon_center = pos_x + (size_w / 2.0);
                                    
                                    // Calculate target X (centered on icon)
                                    let target_x = icon_center - (window_size.width as f64 / 2.0);
                                    // Position Y just below the icon
                                    let target_y = pos_y + size_h;
                                    
                                    let _ = window.set_position(tauri::PhysicalPosition::new(target_x, target_y));
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, get_access_token, fetch_usage, fetch_usage_test])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
