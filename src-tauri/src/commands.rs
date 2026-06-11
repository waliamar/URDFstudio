//! Thin Tauri command wrappers over `urdf_core` (PRD §7.1 / §7.2).

use urdf_core::{
    new_robot as core_new_robot, parse_urdf, resolve_mesh_path as core_resolve_mesh_path,
    serialize_urdf as core_serialize_urdf, validate, Robot, ValidationIssue,
};

#[tauri::command]
pub fn open_urdf(path: String) -> Result<Robot, String> {
    let xml = std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {e}"))?;
    parse_urdf(&xml).map_err(|e| format!("Parse error: {e}"))
}

#[tauri::command]
pub fn save_urdf(path: String, robot: Robot) -> Result<(), String> {
    let xml = core_serialize_urdf(&robot).map_err(|e| format!("Serialize error: {e}"))?;
    std::fs::write(&path, xml).map_err(|e| format!("Write error: {e}"))
}

#[tauri::command]
pub fn serialize_urdf(robot: Robot) -> Result<String, String> {
    core_serialize_urdf(&robot).map_err(|e| format!("Serialize error: {e}"))
}

#[tauri::command]
pub fn validate_robot(robot: Robot) -> Vec<ValidationIssue> {
    validate(&robot)
}

#[tauri::command]
pub fn resolve_mesh_path(package_path: String, urdf_dir: String) -> Option<String> {
    core_resolve_mesh_path(&package_path, &urdf_dir).map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn read_mesh_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Failed to read mesh file: {e}"))
}

#[tauri::command]
pub fn new_robot(name: String) -> Robot {
    core_new_robot(&name)
}
