#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Emitter, State};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

// ─── STATE MANAGEMENT ───────────────────────────────────────────────────
struct OcrState {
    cancel_flag: Arc<AtomicBool>,
}

// ─── STANDARD PDF ENGINE COMMAND ────────────────────────────────────────
#[tauri::command]
async fn run_pdf_engine(app: AppHandle, command_json: String) -> Result<String, String> {
    let (mut rx, mut child) = app.shell().sidecar("pdflexity-engine")
        .map_err(|e| e.to_string())?.spawn().map_err(|e| e.to_string())?;

    let payload = format!("{}\n", command_json);
    child.write(payload.as_bytes()).map_err(|e| e.to_string())?;

    let mut response = String::new();
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Stdout(line) = event {
            response.push_str(std::str::from_utf8(&line).unwrap_or(""));
            break; 
        }
    }
    let _ = child.kill();
    Ok(response)
}

#[tauri::command]
async fn start_ocr_stream(app: AppHandle, state: State<'_, OcrState>, command_json: String) -> Result<(), String> {
    let (mut rx, mut child) = app.shell().sidecar("pdflexity-engine")
        .map_err(|e| e.to_string())?.spawn().map_err(|e| e.to_string())?;

    let payload = format!("{}\n", command_json);
    child.write(payload.as_bytes()).map_err(|e| e.to_string())?;

    // Reset cancel flag before starting
    let cancel_flag = state.cancel_flag.clone();
    cancel_flag.store(false, Ordering::SeqCst);

    // Spawn an async background task to stream events to React
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            // Check if the user clicked "Cancel" in React
            if cancel_flag.load(Ordering::SeqCst) {
                let _ = app.emit("ocr-event", r#"{"type":"error", "error":"Cancelled by user"}"#);
                break; // <-- FIX: Just break the loop here!
            }
            
            // Forward the Python JSON strings to the React UI listener
            if let CommandEvent::Stdout(line) = event {
                let line_str = std::str::from_utf8(&line).unwrap_or("");
                if !line_str.trim().is_empty() {
                    let _ = app.emit("ocr-event", line_str);
                }
            }
        }
        
        // <-- FIX: The child process is killed exactly ONCE right here
        let _ = child.kill(); 
    });
    
    Ok(())
}

#[tauri::command]
fn cancel_ocr_stream(state: State<'_, OcrState>) {
    state.cancel_flag.store(true, Ordering::SeqCst);
}

// ─── FILE I/O HELPERS ───────────────────────────────────────────────────
#[tauri::command]
fn write_temp_file(bytes: Vec<u8>) -> Result<String, String> {
    let mut path = std::env::temp_dir();
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros();
    path.push(format!("pdf_in_{}.pdf", timestamp));
    fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_temp_path() -> Result<String, String> {
    let mut path = std::env::temp_dir();
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros();
    path.push(format!("pdf_out_{}.pdf", timestamp));
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_and_delete_temp_file(path: String) -> Result<Vec<u8>, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&path); 
    Ok(bytes)
}

#[tauri::command]
fn delete_temp_file(path: String) -> Result<(), String> {
    let _ = fs::remove_file(&path);
    Ok(())
}

#[derive(Serialize)]
struct SplitFile { name: String, bytes: Vec<u8> }

#[tauri::command]
fn create_temp_dir() -> Result<String, String> {
    let mut path = std::env::temp_dir();
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros();
    path.push(format!("pdf_out_dir_{}", timestamp));
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_and_delete_temp_dir(path: String) -> Result<Vec<SplitFile>, String> {
    let mut files = Vec::new();
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        if entry.path().is_file() {
            if let Ok(bytes) = fs::read(entry.path()) {
                files.push(SplitFile { name: entry.file_name().to_string_lossy().to_string(), bytes });
            }
        }
    }
    let _ = fs::remove_dir_all(&path);
    Ok(files)
}

// ─── APP INITIALIZATION ───────────────────────────────────────────────
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(OcrState { cancel_flag: Arc::new(AtomicBool::new(false)) })
        .invoke_handler(tauri::generate_handler![
            run_pdf_engine,
            write_temp_file,
            get_temp_path,
            read_and_delete_temp_file,
            delete_temp_file,
            create_temp_dir,
            read_and_delete_temp_dir,
            start_ocr_stream,
            cancel_ocr_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}