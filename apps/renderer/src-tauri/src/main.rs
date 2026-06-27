#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Emitter, State};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::collections::BTreeMap;
use lopdf::{Document, Object, Dictionary};

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

fn shift_references(object: &mut Object, shift: u32) {
    match object {
        Object::Reference(ref mut id) => {
            id.0 += shift;
        }
        Object::Array(ref mut arr) => {
            for obj in arr {
                shift_references(obj, shift);
            }
        }
        Object::Dictionary(ref mut dict) => {
            for (_, obj) in dict.iter_mut() {
                shift_references(obj, shift);
            }
        }
        Object::Stream(ref mut stream) => {
            for (_, obj) in stream.dict.iter_mut() {
                shift_references(obj, shift);
            }
        }
        _ => {}
    }
}

#[tauri::command]
async fn merge_pdfs(file_paths: Vec<String>, output_path: String) -> Result<String, String> {
    let mut max_id = 1;
    let mut out_doc = Document::with_version("1.5");
    let mut page_ids = vec![];

    // 1. Loop through all selected PDFs
    for path in file_paths {
        let mut doc = Document::load(&path).map_err(|e| format!("Failed to load {}: {}", path, e))?;
        doc.renumber_objects(); // Standardize object IDs starting from 1
        
        // 2. Shift all internal references BEFORE we move the objects
        for (_, object) in doc.objects.iter_mut() {
            shift_references(object, max_id);
        }

        // 3. Track all the pages BEFORE consuming doc.objects
        let pages = doc.get_pages();
        for (_, page_id) in pages {
            page_ids.push((page_id.0 + max_id, page_id.1));
        }

        // 4. Shift the actual object IDs to prevent collisions
        let mut new_objects = BTreeMap::new();
        for (id, object) in doc.objects {
            new_objects.insert((id.0 + max_id, id.1), object);
        }

        // 5. Add the fixed objects to our final document
        out_doc.objects.extend(new_objects);
        
        // Update max_id for the next PDF so we never overwrite objects
        max_id = out_doc.objects.keys().map(|id| id.0).max().unwrap_or(0);
    }

    let pages_id = (max_id + 1, 0);
    let catalog_id = (max_id + 2, 0);
    
    // 6. Rebuild the master "Pages" list
    let mut pages_dict = Dictionary::new();
    pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
    pages_dict.set("Count", Object::Integer(page_ids.len() as i64));
    pages_dict.set("Kids", Object::Array(page_ids.iter().map(|id| Object::Reference(*id)).collect::<Vec<_>>()));
    
    out_doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

    // 7. Rebuild the master "Catalog"
    let mut catalog_dict = Dictionary::new();
    catalog_dict.set("Type", Object::Name(b"Catalog".to_vec()));
    catalog_dict.set("Pages", Object::Reference(pages_id));
    out_doc.objects.insert(catalog_id, Object::Dictionary(catalog_dict));

    // 8. Update Parent references for all pages so they belong to the new root
    for page_id in page_ids {
        if let Some(Object::Dictionary(page)) = out_doc.objects.get_mut(&page_id) {
            page.set("Parent", Object::Reference(pages_id));
        }
    }

    // 9. CRITICAL FIX: The PDF specification REQUIRES the Size entry in the trailer to be Max ID + 1.
    // Without this, Chrome/Edge/Adobe will think the PDF has 0 objects and display a blank page!
    out_doc.trailer.set("Root", Object::Reference(catalog_id));
    out_doc.trailer.set("Size", Object::Integer((catalog_id.0 + 1) as i64));
    out_doc.max_id = catalog_id.0; // Tells lopdf how large the XRef table should be.

    // 10. Save the final merged document natively
    out_doc.save(&output_path).map_err(|e| format!("Failed to save merged PDF: {}", e))?;

    Ok("Merged successfully".to_string())
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
            cancel_ocr_stream,
            merge_pdfs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}