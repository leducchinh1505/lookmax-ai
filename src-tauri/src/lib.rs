// The desktop shell only hosts the web UI. All analysis and storage run in the
// WebView (MediaPipe WASM + IndexedDB), so no Rust commands or network access
// are needed.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Lookmax AI");
}
