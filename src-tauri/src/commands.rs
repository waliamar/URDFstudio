//! Thin Tauri command wrappers over `urdf_core` (PRD §7.1 / §7.2).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use urdf_core::{
    build_index_for, build_source_tree, extract_anchors, find_workspace_root,
    new_robot as core_new_robot, parse_urdf, resolve_mesh_path as core_resolve_mesh_path,
    resolve_mesh_path_indexed, serialize_urdf as core_serialize_urdf, validate, FieldAnchor,
    PackageIndex, Robot, SourceFile, ValidationIssue,
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
    /// Ordered xacro source files (empty for plain URDF), for the Source view.
    pub source_files: Vec<SourceFile>,
    /// Writable field anchors for editable source files (empty for plain URDF).
    pub anchors: Vec<FieldAnchor>,
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
    let file_path = Path::new(&path);
    let workspace_root_path = find_workspace_root(file_path);
    let workspace_root = workspace_root_path
        .as_ref()
        .map(|p| p.to_string_lossy().into_owned());

    // For xacro docs, assemble the ordered source-file tree + field anchors.
    let (source_files, anchors) = if is_xacro {
        let index = build_index_for(file_path);
        let files = build_source_tree(file_path, workspace_root_path.as_deref(), &index);
        let anchors = extract_anchors(&files);
        (files, anchors)
    } else {
        (Vec::new(), Vec::new())
    };

    Ok(OpenResult {
        robot,
        computed_urdf,
        is_xacro,
        workspace_root,
        source_files,
        anchors,
    })
}

/// Splice `new_text` into `[value_start, value_end)` of `file_path`, then
/// re-expand `main_path` and return the refreshed document (computed URDF,
/// re-parsed robot, source files, and anchors with shifted offsets).
#[tauri::command]
pub fn set_xacro_field(
    main_path: String,
    file_path: String,
    value_start: usize,
    value_end: usize,
    new_text: String,
) -> Result<OpenResult, String> {
    let text = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read source file: {e}"))?;

    if value_start > value_end || value_end > text.len() {
        return Err("edit span is out of range (file changed on disk?)".into());
    }
    if !text.is_char_boundary(value_start) || !text.is_char_boundary(value_end) {
        return Err("edit span does not fall on character boundaries".into());
    }

    let mut updated = String::with_capacity(text.len() - (value_end - value_start) + new_text.len());
    updated.push_str(&text[..value_start]);
    updated.push_str(&new_text);
    updated.push_str(&text[value_end..]);
    std::fs::write(&file_path, updated).map_err(|e| format!("Failed to write source file: {e}"))?;

    // Re-expand from the main document so shared-property cascades stay truthful.
    open_document(main_path)
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
