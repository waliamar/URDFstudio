mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_urdf,
            commands::save_urdf,
            commands::serialize_urdf,
            commands::validate_robot,
            commands::resolve_mesh_path,
            commands::read_mesh_file,
            commands::new_robot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
