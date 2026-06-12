//! Thin Tauri command wrappers over `urdf_core` (PRD §7.1 / §7.2).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use urdf_core::{
    build_index_for, find_workspace_root, new_robot as core_new_robot, parse_urdf,
    resolve_mesh_path as core_resolve_mesh_path, resolve_mesh_path_indexed,
    serialize_urdf as core_serialize_urdf, validate, PackageIndex, Robot, ValidationIssue,
};

use crate::xacro;

/// Per-workspace cache of [`PackageIndex`], keyed by workspace root (or the
/// URDF directory when no workspace root is found). Building an index walks the
/// filesystem, so we cache it for the lifetime of the app session.
#[derive(Default)]
pub struct MeshIndexCache(pub Mutex<HashMap<PathBuf, PackageIndex>>);

/// Result of opening a document — richer than a bare `Robot` so the frontend
/// can render xacro source/computed views. Source files + provenance anchors
/// are added in later phases.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenResult {
    /// Parsed robot model (drives viewport + validation).
    pub robot: Robot,
    /// Computed URDF text (xacro-expanded, or the original for plain URDF).
    pub computed_urdf: String,
    /// Whether the opened file was a xacro that required expansion.
    pub is_xacro: bool,
    /// Detected colcon workspace root, if any.
    pub workspace_root: Option<String>,
}

#[tauri::command]
pub fn open_document(path: String) -> Result<OpenResult, String> {
    let contents =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {e}"))?;
    let is_xacro = xacro::is_xacro(&path, &contents);

    let computed_urdf = if is_xacro {
        xacro::expand_xacro(&path)?
    } else {
        contents
    };

    let robot = parse_urdf(&computed_urdf).map_err(|e| format!("Parse error: {e}"))?;
    let workspace_root =
        find_workspace_root(Path::new(&path)).map(|p| p.to_string_lossy().into_owned());

    Ok(OpenResult {
        robot,
        computed_urdf,
        is_xacro,
        workspace_root,
    })
}

#[tauri::command]
pub fn open_urdf(path: String) -> Result<Robot, String> {
    // Backward-compatible shim; prefer `open_document`.
    open_document(path).map(|r| r.robot)
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
pub fn resolve_mesh_path(
    package_path: String,
    urdf_dir: String,
    cache: tauri::State<'_, MeshIndexCache>,
) -> Option<String> {
    // Key the cache by the workspace root derived from urdf_dir, falling back
    // to urdf_dir itself when no workspace is found.
    let urdf_dir_path = PathBuf::from(&urdf_dir);
    let key = find_workspace_root(&urdf_dir_path).unwrap_or_else(|| urdf_dir_path.clone());

    let mut map = cache.0.lock().expect("mesh index cache poisoned");
    let index = map
        .entry(key)
        .or_insert_with(|| build_index_for(&urdf_dir_path));

    resolve_mesh_path_indexed(&package_path, &urdf_dir, index)
        .or_else(|| core_resolve_mesh_path(&package_path, &urdf_dir))
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn read_mesh_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Failed to read mesh file: {e}"))
}

#[tauri::command]
pub fn new_robot(name: String) -> Robot {
    core_new_robot(&name)
}
