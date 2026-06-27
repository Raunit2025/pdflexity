#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Emitter, State};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
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

    let mut final_response = String::new();
    let mut raw_stdout = String::new();
    let mut raw_stderr = String::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(chunk) => {
                let text = std::str::from_utf8(&chunk).unwrap_or("");
                raw_stdout.push_str(text);

                // If Go DOES flush STDOUT, we parse the JSON normally
                let lower_output = raw_stdout.to_lowercase();
                if let Some(success_idx) = lower_output.find("\"success\"") {
                    if let Some(start) = raw_stdout[..success_idx].rfind('{') {
                        if let Some(end) = raw_stdout[success_idx..].find('}') {
                            final_response = raw_stdout[start..=(success_idx + end)].to_string();
                            break;
                        }
                    }
                }
            }
            CommandEvent::Stderr(chunk) => {
                let text = std::str::from_utf8(&chunk).unwrap_or("");
                raw_stderr.push_str(text);
                
                // Print to console so you can always see what Go is doing!
                println!("GO STDERR: {}", text.trim());

                let lower_err = raw_stderr.to_lowercase();
                
                // ─── THE BYPASS ───────────────────────────────────────
                // If Go successfully completes but the JSON is stuck in the buffer:
                if lower_err.contains("success:") {
                    // We manually fake the JSON response for React!
                    final_response = r#"{"success": true}"#.to_string();
                    break;
                }
                
                // If Go hits a hard error (wrong password, corrupt file):
                if lower_err.contains("error:") {
                    let mut err_msg = "PDF Engine encountered an error.".to_string();
                    
                    // Try to extract the exact error message from the log to show in the UI
                    if let Some(idx) = lower_err.find("error:") {
                        let after_err = &raw_stderr[(idx + 6)..];
                        err_msg = after_err.trim().to_string();
                        // Escape quotes so we don't break the JSON
                        err_msg = err_msg.replace("\"", "'"); 
                    }
                    
                    final_response = format!(r#"{{"success": false, "error": "{}"}}"#, err_msg);
                    break;
                }
            }
            _ => {}
        }
    }
    
    // Forcefully kill the Go engine so it doesn't hang in the background forever!
    let _ = child.kill();
    
    if final_response.is_empty() {
        return Err(format!("PDF Engine crashed. Raw STDERR: {}", raw_stderr));
    }
    
    Ok(final_response)
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

#[tauri::command]
fn move_file(old_path: String, new_path: String) -> Result<(), String> {
    // Copy the file to the new location, then delete the old one
    std::fs::copy(&old_path, &new_path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&old_path);
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
    let mut root_pages_ids = vec![];
    let mut total_pages = 0;

    for path in file_paths {
        let mut doc = Document::load(&path).map_err(|e| format!("Failed to load {}: {}", path, e))?;
        doc.renumber_objects();
        
        // 1. Get the original Root Catalog and Pages ID BEFORE shifting anything
        let catalog_id = doc.trailer.get(b"Root")
            .and_then(Object::as_reference)
            .map_err(|_| format!("Invalid PDF trailer in {}", path))?;
        
        // Fix: doc.objects is a BTreeMap which returns an Option. 
        // We use ok_or_else to turn it into a Result so we can handle the error gracefully.
        let catalog_obj = doc.objects.get(&catalog_id)
            .ok_or_else(|| format!("Catalog object not found in {}", path))?;
            
        let catalog_dict = catalog_obj.as_dict()
            .map_err(|_| format!("Catalog is not a dictionary in {}", path))?;
            
        let pages_id = catalog_dict.get(b"Pages")
            .and_then(Object::as_reference)
            .map_err(|_| format!("No Pages root found in {}", path))?;

        // Keep track of this document's shifted Root Pages ID
        root_pages_ids.push((pages_id.0 + max_id, pages_id.1));
        
        // Count the total pages
        total_pages += doc.get_pages().len() as i64;

        // 2. Shift all internal references to prevent ID collisions
        for (_, object) in doc.objects.iter_mut() {
            shift_references(object, max_id);
        }

        // 3. Move the objects to the output document with shifted keys
        for (id, object) in doc.objects {
            out_doc.objects.insert((id.0 + max_id, id.1), object);
        }
        
        // Update max_id for the next PDF document
        max_id = out_doc.objects.keys().map(|id| id.0).max().unwrap_or(0);
    }

    let master_pages_id = (max_id + 1, 0);
    let master_catalog_id = (max_id + 2, 0);
    
    // 4. Rebuild the master "Pages" tree by nesting the root pages of each PDF
    let mut master_pages_dict = Dictionary::new();
    master_pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
    master_pages_dict.set("Count", Object::Integer(total_pages));
    master_pages_dict.set("Kids", Object::Array(
        root_pages_ids.iter().map(|id| Object::Reference(*id)).collect::<Vec<_>>()
    ));
    
    out_doc.objects.insert(master_pages_id, Object::Dictionary(master_pages_dict));

    // 5. Update Parent references for each nested root Pages node
    for root_page_id in root_pages_ids {
        if let Some(Object::Dictionary(pages_dict)) = out_doc.objects.get_mut(&root_page_id) {
            pages_dict.set("Parent", Object::Reference(master_pages_id));
        }
    }

    // 6. Rebuild the master "Catalog"
    let mut master_catalog_dict = Dictionary::new();
    master_catalog_dict.set("Type", Object::Name(b"Catalog".to_vec()));
    master_catalog_dict.set("Pages", Object::Reference(master_pages_id));
    out_doc.objects.insert(master_catalog_id, Object::Dictionary(master_catalog_dict));

    // 7. Finalize Trailer
    out_doc.trailer.set("Root", Object::Reference(master_catalog_id));
    out_doc.trailer.set("Size", Object::Integer((master_catalog_id.0 + 1) as i64));
    out_doc.max_id = master_catalog_id.0;

    // 8. Save the final native PDF
    out_doc.save(&output_path).map_err(|e| format!("Failed to save merged PDF: {}", e))?;

    Ok("Merged successfully".to_string())
}

// ─── PDF SPLIT & TRIM HELPERS ───────────────────────────────────────────

#[tauri::command]
async fn trim_pdf(input_path: String, output_path: String, selected_pages: Vec<u32>) -> Result<String, String> {
    // Load the original document
    let mut doc = Document::load(&input_path).map_err(|e| format!("Failed to load PDF: {}", e))?;

    // Get all current page numbers (lopdf uses 1-based indexing for pages)
    let total_pages: Vec<u32> = doc.get_pages().keys().cloned().collect();

    // Find the pages we want to DELETE (anything NOT in our selected list)
    let mut pages_to_delete = Vec::new();
    for page_num in total_pages {
        if !selected_pages.contains(&page_num) {
            pages_to_delete.push(page_num);
        }
    }

    // Tell lopdf to remove the unwanted pages. 
    // It automatically updates the Page Tree, Count, and Kids array!
    doc.delete_pages(&pages_to_delete);

    // Save the trimmed document
    doc.save(&output_path).map_err(|e| format!("Failed to save trimmed PDF: {}", e))?;

    Ok("Trimmed successfully".to_string())
}

#[tauri::command]
async fn extract_pages_pdf(input_path: String, out_dir: String, selected_pages: Vec<u32>) -> Result<String, String> {
    let out_path = std::path::Path::new(&out_dir);
    if !out_path.exists() {
        std::fs::create_dir_all(out_path).map_err(|e| e.to_string())?;
    }

    // Get the base filename (e.g., "document" from "document.pdf")
    let file_stem = std::path::Path::new(&input_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("extracted");

    // For each selected page, we load the doc, delete all OTHER pages, and save.
    for target_page in selected_pages {
        let mut doc = Document::load(&input_path).map_err(|e| format!("Failed to load PDF: {}", e))?;
        
        let total_pages: Vec<u32> = doc.get_pages().keys().cloned().collect();
        let mut pages_to_delete = Vec::new();
        
        for page_num in total_pages {
            if page_num != target_page {
                pages_to_delete.push(page_num);
            }
        }

        doc.delete_pages(&pages_to_delete);

        // Save as "filename_page_3.pdf"
        let out_file = out_path.join(format!("{}_page_{}.pdf", file_stem, target_page));
        doc.save(&out_file).map_err(|e| format!("Failed to save page {}: {}", target_page, e))?;
    }

    Ok("Pages extracted successfully".to_string())
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
            move_file,
            create_temp_dir,
            read_and_delete_temp_dir,
            start_ocr_stream,
            cancel_ocr_stream,
            merge_pdfs,
            trim_pdf,
            extract_pages_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}