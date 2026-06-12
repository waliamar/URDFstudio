//! Build the ordered set of xacro source files behind a computed URDF.
//!
//! Starting from the main xacro, follow `<xacro:include filename="…"/>`
//! directives in first-seen (ROS include) order, resolving `$(find pkg)`
//! through a [`PackageIndex`] and relative paths against the including file.
//! Each file is tagged `editable` when it lives in the user's workspace and
//! not under a read-only install/ROS prefix.

use crate::ament::PackageIndex;
use quick_xml::events::Event;
use quick_xml::reader::Reader;
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceFile {
    /// Absolute resolved path on disk.
    pub path: String,
    /// Display label: the raw include string (e.g. `$(find ur_description)/…`)
    /// for included files, or the workspace-relative path for the root.
    pub label: String,
    /// Full file contents.
    pub text: String,
    /// Whether edits to this file should be allowed (write-back, Phase 3).
    pub editable: bool,
}

/// Build the ordered source-file list for `main_file`.
///
/// Files are returned parent-before-children in first-seen order, deduplicated
/// by resolved path. Includes that cannot be resolved (unknown package, or a
/// `$(arg …)`/`$(…)` we don't expand) or read are skipped.
pub fn build_source_tree(
    main_file: &Path,
    workspace_root: Option<&Path>,
    index: &PackageIndex,
) -> Vec<SourceFile> {
    let mut files = Vec::new();
    let mut seen = HashSet::new();

    let root_label = workspace_root
        .and_then(|ws| main_file.strip_prefix(ws).ok())
        .map(|rel| rel.to_string_lossy().into_owned())
        .unwrap_or_else(|| main_file.to_string_lossy().into_owned());

    visit(main_file, root_label, workspace_root, index, &mut files, &mut seen);
    files
}

fn visit(
    path: &Path,
    label: String,
    workspace_root: Option<&Path>,
    index: &PackageIndex,
    files: &mut Vec<SourceFile>,
    seen: &mut HashSet<PathBuf>,
) {
    let key = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    if !seen.insert(key) {
        return;
    }
    let Ok(text) = std::fs::read_to_string(path) else {
        return;
    };

    let editable = is_editable(path, workspace_root);
    let includes = find_includes(&text);

    files.push(SourceFile {
        path: path.to_string_lossy().into_owned(),
        label,
        text,
        editable,
    });

    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    for raw in includes {
        if let Some(resolved) = resolve_include(&raw, dir, index) {
            visit(&resolved, raw, workspace_root, index, files, seen);
        }
    }
}

/// True when `path` is in the user's workspace and not under a read-only
/// install or ROS prefix (those are macro-expanded/external content).
fn is_editable(path: &Path, workspace_root: Option<&Path>) -> bool {
    let Some(ws) = workspace_root else {
        return false;
    };
    let abs = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    abs.starts_with(ws) && !abs.starts_with(ws.join("install")) && !abs.starts_with("/opt/ros")
}

/// Extract the `filename` of every `<xacro:include>` in document order.
fn find_includes(text: &str) -> Vec<String> {
    let mut reader = Reader::from_str(text);
    reader.config_mut().trim_text(true);
    let mut out = Vec::new();
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(e)) | Ok(Event::Start(e))
                if e.local_name().as_ref() == b"include" =>
            {
                if let Some(f) = e.attributes().flatten().find_map(|a| {
                    (a.key.as_ref() == b"filename")
                        .then(|| String::from_utf8_lossy(&a.value).into_owned())
                }) {
                    out.push(f);
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    out
}

/// Resolve an include `filename` to an absolute path:
/// - expand a leading/embedded `$(find pkg)` via the index,
/// - otherwise join relative to `current_dir`.
///
/// Returns `None` if a package is unknown or any unexpanded `$(…)` remains.
fn resolve_include(filename: &str, current_dir: &Path, index: &PackageIndex) -> Option<PathBuf> {
    let expanded = expand_find(filename, index)?;
    if expanded.contains("$(") {
        return None; // unresolved $(arg …) or similar
    }
    let p = PathBuf::from(&expanded);
    if p.is_absolute() {
        Some(p)
    } else {
        Some(current_dir.join(p))
    }
}

/// Replace every `$(find pkg)` occurrence with the package's share directory.
/// Returns `None` if a referenced package is not in the index.
fn expand_find(s: &str, index: &PackageIndex) -> Option<String> {
    let mut out = String::new();
    let mut rest = s;
    while let Some(start) = rest.find("$(find ") {
        out.push_str(&rest[..start]);
        let after = &rest[start + "$(find ".len()..];
        let end = after.find(')')?;
        let pkg = after[..end].trim();
        let dir = index.find(pkg)?;
        out.push_str(&dir.to_string_lossy());
        rest = &after[end + 1..];
    }
    out.push_str(rest);
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "urdf_core_srctree_{name}_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos(),
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn finds_includes_in_order() {
        let text = r#"<robot>
          <xacro:include filename="a.xacro"/>
          <xacro:include filename="$(find pkg)/b.xacro"/>
        </robot>"#;
        assert_eq!(find_includes(text), vec!["a.xacro", "$(find pkg)/b.xacro"]);
    }

    #[test]
    fn expand_find_uses_index() {
        let root = temp_dir("expand");
        let share = root.join("share/ur_description");
        fs::create_dir_all(&share).unwrap();
        // Build via a fake prefix so the index knows ur_description.
        let markers = root.join("share/ament_index/resource_index/packages");
        fs::create_dir_all(&markers).unwrap();
        fs::write(markers.join("ur_description"), "").unwrap();
        let index = PackageIndex::build(None, &[root.clone()]);

        let resolved = expand_find("$(find ur_description)/urdf/x.xacro", &index).unwrap();
        assert_eq!(
            resolved,
            format!("{}/urdf/x.xacro", share.to_string_lossy())
        );
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn expand_find_unknown_pkg_is_none() {
        let index = PackageIndex::default();
        assert!(expand_find("$(find nope)/x", &index).is_none());
    }

    #[test]
    fn builds_ordered_deduped_tree_with_editable_flags() {
        // ws/src/main.xacro includes sibling child.xacro (editable) and an
        // external pkg file (not editable). child.xacro re-includes main's
        // sibling — dedup keeps a single entry.
        let root = temp_dir("tree");
        let ws = root.join("ws");
        let src = ws.join("src");
        fs::create_dir_all(&src).unwrap();

        // External package under a ROS-like prefix OUTSIDE the workspace.
        let ext_prefix = root.join("opt");
        let ext_markers = ext_prefix.join("share/ament_index/resource_index/packages");
        fs::create_dir_all(&ext_markers).unwrap();
        fs::write(ext_markers.join("ext_pkg"), "").unwrap();
        let ext_dir = ext_prefix.join("share/ext_pkg");
        fs::create_dir_all(&ext_dir).unwrap();
        fs::write(ext_dir.join("macro.xacro"), "<robot/>").unwrap();

        fs::write(
            src.join("child.xacro"),
            r#"<robot><xacro:include filename="child.xacro"/></robot>"#,
        )
        .unwrap();
        fs::write(
            src.join("main.xacro"),
            r#"<robot>
              <xacro:include filename="child.xacro"/>
              <xacro:include filename="$(find ext_pkg)/macro.xacro"/>
            </robot>"#,
        )
        .unwrap();

        let index = PackageIndex::build(None, &[ext_prefix]);
        let files = build_source_tree(&src.join("main.xacro"), Some(&ws), &index);

        let labels: Vec<_> = files.iter().map(|f| f.label.as_str()).collect();
        assert_eq!(
            labels,
            vec!["src/main.xacro", "child.xacro", "$(find ext_pkg)/macro.xacro"]
        );
        // main + child are in the workspace ⇒ editable; ext is not.
        assert!(files[0].editable);
        assert!(files[1].editable);
        assert!(!files[2].editable);

        fs::remove_dir_all(&root).ok();
    }

    /// Opt-in: real scalpel workspace. The root is the editable src file; the
    /// UR macro chain resolves via /opt/ros and is read-only.
    #[test]
    #[ignore]
    fn real_scalpel_source_tree() {
        let main = PathBuf::from(
            "/home/wali/coding/scalpel_ur16e/src/scalpel_description/urdf/ur16e_with_scalpel.urdf.xacro",
        );
        let ws = crate::find_workspace_root(&main);
        let index = crate::build_index_for(&main);
        let files = build_source_tree(&main, ws.as_deref(), &index);

        assert!(files.len() >= 2, "expected root + UR macro includes");
        assert!(files[0].editable, "root src file must be editable");
        assert!(
            files[0].label.ends_with("ur16e_with_scalpel.urdf.xacro"),
            "root label is workspace-relative: {}",
            files[0].label
        );
        // The UR macro lives under /opt/ros ⇒ present and read-only.
        assert!(files.iter().any(|f| f.label.contains("ur_macro.xacro")));
        assert!(files
            .iter()
            .filter(|f| f.path.starts_with("/opt/ros"))
            .all(|f| !f.editable));
    }
}
