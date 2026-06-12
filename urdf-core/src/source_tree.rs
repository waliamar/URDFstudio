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
use std::collections::{HashMap, HashSet};
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

/// A writable anchor for one editable parameter: the byte span of the value
/// (or of the `xacro:property`/`xacro:arg` definition it redirects to) in a
/// source file. Keyed by `(kind, name, field)` so the frontend can both gate
/// editability and splice on commit.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldAnchor {
    /// Element kind: `"joint"`, `"link"`, or `"material"`.
    pub kind: String,
    /// Element name (the `name=` of the joint/link/material).
    pub name: String,
    /// Dotted field path, e.g. `origin.xyz`, `axis`, `limit.lower`,
    /// `inertial.mass`, `inertial.ixx`, `visual.mesh.filename`, `color`.
    pub field: String,
    /// Index into the document's `source_files` of the file holding the span.
    pub file_index: usize,
    /// Byte offset of the value start within that file's `text`.
    pub value_start: usize,
    /// Byte offset (exclusive) of the value end.
    pub value_end: usize,
    /// `"literal"`, `"property"` (redirected to a `${prop}` def), or `"arg"`.
    pub value_kind: String,
}

/// Extract every writable [`FieldAnchor`] from the editable source files.
///
/// Two passes: first collect `xacro:property`/`xacro:arg` definition spans
/// (so a value that is a pure `${prop}`/`$(arg a)` reference can redirect to
/// its definition), then walk each editable file emitting anchors for the
/// fields we expose. A field whose value is a non-redirectable expression, or
/// whose `${prop}`/`$(arg)` has no editable definition, yields no anchor — the
/// frontend renders it immutable.
pub fn extract_anchors(files: &[SourceFile]) -> Vec<FieldAnchor> {
    let mut defs = Defs::default();
    for (fi, f) in files.iter().enumerate() {
        if f.editable {
            collect_defs(&f.text, fi, &mut defs);
        }
    }

    let mut anchors = Vec::new();
    for (fi, f) in files.iter().enumerate() {
        if f.editable {
            extract_file_anchors(&f.text, fi, &defs, &mut anchors);
        }
    }
    anchors
}

#[derive(Default)]
struct Defs {
    props: HashMap<String, Loc>,
    args: HashMap<String, Loc>,
}

#[derive(Clone, Copy)]
struct Loc {
    file_index: usize,
    start: usize,
    end: usize,
}

/// Collect `xacro:property` `value=` and `xacro:arg` `default=` value spans.
fn collect_defs(text: &str, fi: usize, defs: &mut Defs) {
    for (raw, p0) in elements(text) {
        let local = local_name(raw);
        match local {
            "property" => {
                if let (Some(name), Some((vs, ve))) =
                    (attr_value(raw, "name"), attr_value_span(raw, "value"))
                {
                    defs.props.entry(name.to_string()).or_insert(Loc {
                        file_index: fi,
                        start: p0 + vs,
                        end: p0 + ve,
                    });
                }
            }
            "arg" => {
                if let (Some(name), Some((vs, ve))) =
                    (attr_value(raw, "name"), attr_value_span(raw, "default"))
                {
                    defs.args.entry(name.to_string()).or_insert(Loc {
                        file_index: fi,
                        start: p0 + vs,
                        end: p0 + ve,
                    });
                }
            }
            _ => {}
        }
    }
}

struct Frame {
    tag: String,
    name: Option<String>,
}

/// Emit anchors for one editable file by streaming its elements with a context
/// stack (so an `<origin>`/`<mesh>` is attributed to its enclosing joint/link).
fn extract_file_anchors(text: &str, fi: usize, defs: &Defs, out: &mut Vec<FieldAnchor>) {
    let mut reader = Reader::from_str(text);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut stack: Vec<Frame> = Vec::new();

    loop {
        let p0 = reader.buffer_position() as usize;
        let ev = match reader.read_event_into(&mut buf) {
            Ok(ev) => ev,
            Err(_) => break,
        };
        let p1 = reader.buffer_position() as usize;
        let raw = &text[p0..p1];

        match ev {
            Event::Start(ref e) => {
                let tag = local_of(e.local_name().as_ref());
                let name = attr_value(raw, "name").map(str::to_owned);
                stack.push(Frame { tag, name });
            }
            Event::End(_) => {
                stack.pop();
            }
            Event::Empty(ref e) => {
                let tag = local_of(e.local_name().as_ref());
                emit_leaf(&tag, raw, p0, &stack, fi, defs, out);
            }
            Event::Eof => break,
            _ => {}
        }
        buf.clear();
    }
}

/// Emit anchors for a self-closing leaf element given its context stack.
fn emit_leaf(
    tag: &str,
    raw: &str,
    p0: usize,
    stack: &[Frame],
    fi: usize,
    defs: &Defs,
    out: &mut Vec<FieldAnchor>,
) {
    let parent = stack.last().map(|f| f.tag.as_str()).unwrap_or("");
    let nearest = |tags: &[&str]| -> Option<&Frame> {
        stack.iter().rev().find(|f| tags.contains(&f.tag.as_str()))
    };

    match tag {
        "origin" => {
            let (kind, name, base) = match parent {
                "joint" => (
                    "joint",
                    nearest(&["joint"]).and_then(|f| f.name.as_deref()).unwrap_or(""),
                    "origin",
                ),
                "inertial" => (
                    "link",
                    nearest(&["link"]).and_then(|f| f.name.as_deref()).unwrap_or(""),
                    "inertial.origin",
                ),
                "visual" => (
                    "link",
                    nearest(&["link"]).and_then(|f| f.name.as_deref()).unwrap_or(""),
                    "visual.origin",
                ),
                "collision" => (
                    "link",
                    nearest(&["link"]).and_then(|f| f.name.as_deref()).unwrap_or(""),
                    "collision.origin",
                ),
                _ => return,
            };
            emit_attr(raw, p0, fi, defs, kind, name, &format!("{base}.xyz"), "xyz", out);
            emit_attr(raw, p0, fi, defs, kind, name, &format!("{base}.rpy"), "rpy", out);
        }
        "axis" if parent == "joint" => {
            let name = nearest(&["joint"]).and_then(|f| f.name.as_deref()).unwrap_or("");
            emit_attr(raw, p0, fi, defs, "joint", name, "axis", "xyz", out);
        }
        "limit" if parent == "joint" => {
            let name = nearest(&["joint"]).and_then(|f| f.name.as_deref()).unwrap_or("");
            for k in ["lower", "upper", "effort", "velocity"] {
                emit_attr(raw, p0, fi, defs, "joint", name, &format!("limit.{k}"), k, out);
            }
        }
        "mass" if parent == "inertial" => {
            let name = nearest(&["link"]).and_then(|f| f.name.as_deref()).unwrap_or("");
            emit_attr(raw, p0, fi, defs, "link", name, "inertial.mass", "value", out);
        }
        "inertia" if parent == "inertial" => {
            let name = nearest(&["link"]).and_then(|f| f.name.as_deref()).unwrap_or("");
            for k in ["ixx", "ixy", "ixz", "iyy", "iyz", "izz"] {
                emit_attr(raw, p0, fi, defs, "link", name, &format!("inertial.{k}"), k, out);
            }
        }
        "color" if parent == "material" => {
            let name = nearest(&["material"]).and_then(|f| f.name.as_deref()).unwrap_or("");
            emit_attr(raw, p0, fi, defs, "material", name, "color", "rgba", out);
        }
        "mesh" if parent == "geometry" => {
            let ctx = nearest(&["visual", "collision"]).map(|f| f.tag.as_str()).unwrap_or("visual");
            let name = nearest(&["link"]).and_then(|f| f.name.as_deref()).unwrap_or("");
            emit_attr(raw, p0, fi, defs, "link", name, &format!("{ctx}.mesh.filename"), "filename", out);
            emit_attr(raw, p0, fi, defs, "link", name, &format!("{ctx}.mesh.scale"), "scale", out);
        }
        _ => {}
    }
}

#[allow(clippy::too_many_arguments)]
fn emit_attr(
    raw: &str,
    p0: usize,
    fi: usize,
    defs: &Defs,
    kind: &str,
    name: &str,
    field: &str,
    attr: &str,
    out: &mut Vec<FieldAnchor>,
) {
    let Some((vs, ve)) = attr_value_span(raw, attr) else {
        return;
    };
    let value = &raw[vs..ve];
    let (file_index, value_start, value_end, value_kind) =
        match classify(value) {
            ValueKind::Literal => (fi, p0 + vs, p0 + ve, "literal"),
            ValueKind::Property(p) => match defs.props.get(&p) {
                Some(l) => (l.file_index, l.start, l.end, "property"),
                None => return,
            },
            ValueKind::Arg(a) => match defs.args.get(&a) {
                Some(l) => (l.file_index, l.start, l.end, "arg"),
                None => return,
            },
        };
    out.push(FieldAnchor {
        kind: kind.to_string(),
        name: name.to_string(),
        field: field.to_string(),
        file_index,
        value_start,
        value_end,
        value_kind: value_kind.to_string(),
    });
}

enum ValueKind {
    Literal,
    Property(String),
    Arg(String),
}

/// Classify an attribute value: a pure `${prop}` or `$(arg a)` redirects to its
/// definition; everything else (literals, mixed expressions) stays literal.
fn classify(value: &str) -> ValueKind {
    let v = value.trim();
    if let Some(inner) = v.strip_prefix("${").and_then(|s| s.strip_suffix('}')) {
        if !inner.contains(['{', '}']) {
            return ValueKind::Property(inner.trim().to_string());
        }
    }
    if let Some(inner) = v.strip_prefix("$(arg ").and_then(|s| s.strip_suffix(')')) {
        if !inner.contains(['(', ')']) {
            return ValueKind::Arg(inner.trim().to_string());
        }
    }
    ValueKind::Literal
}

/// Iterate `(raw_element_slice, byte_offset)` for every element in `text`.
fn elements(text: &str) -> Vec<(&str, usize)> {
    let mut reader = Reader::from_str(text);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut out = Vec::new();
    loop {
        let p0 = reader.buffer_position() as usize;
        let ev = match reader.read_event_into(&mut buf) {
            Ok(ev) => ev,
            Err(_) => break,
        };
        let p1 = reader.buffer_position() as usize;
        match ev {
            Event::Start(_) | Event::Empty(_) => out.push((&text[p0..p1], p0)),
            Event::Eof => break,
            _ => {}
        }
        buf.clear();
    }
    out
}

fn local_of(qname: &[u8]) -> String {
    String::from_utf8_lossy(qname).into_owned()
}

/// Local name of the first start tag in a raw element slice (after any `:`).
fn local_name(raw: &str) -> &str {
    let start = match raw.find('<') {
        Some(i) => i + 1,
        None => return "",
    };
    let rest = &raw[start..];
    let end = rest
        .find(|c: char| c.is_whitespace() || c == '>' || c == '/')
        .unwrap_or(rest.len());
    let tag = &rest[..end];
    tag.rsplit(':').next().unwrap_or(tag)
}

/// Read an attribute value (unescaped-enough for our literal needs).
fn attr_value<'a>(raw: &'a str, key: &str) -> Option<&'a str> {
    let (s, e) = attr_value_span(raw, key)?;
    Some(&raw[s..e])
}

/// Find the byte span of `key`'s quoted value within a raw element slice.
fn attr_value_span(raw: &str, key: &str) -> Option<(usize, usize)> {
    let bytes = raw.as_bytes();
    let mut i = 0;
    while let Some(rel) = raw[i..].find(key) {
        let at = i + rel;
        let after = at + key.len();
        let before_ok = at == 0 || !is_name_char(bytes[at - 1]);
        let after_ok = after >= bytes.len() || !is_name_char(bytes[after]);
        if before_ok && after_ok {
            let mut j = after;
            while j < bytes.len() && bytes[j].is_ascii_whitespace() {
                j += 1;
            }
            if j < bytes.len() && bytes[j] == b'=' {
                j += 1;
                while j < bytes.len() && bytes[j].is_ascii_whitespace() {
                    j += 1;
                }
                if j < bytes.len() && (bytes[j] == b'"' || bytes[j] == b'\'') {
                    let quote = bytes[j];
                    let vstart = j + 1;
                    if let Some(rel_end) = raw[vstart..].find(quote as char) {
                        return Some((vstart, vstart + rel_end));
                    }
                }
            }
        }
        i = after;
    }
    None
}

fn is_name_char(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_' || b == b'-' || b == b':'
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

    /// Helper: an in-memory editable source file.
    fn src(text: &str) -> SourceFile {
        SourceFile {
            path: "/ws/src/a.xacro".into(),
            label: "a.xacro".into(),
            text: text.into(),
            editable: true,
        }
    }

    /// The spliced span must equal the value we expect to edit.
    fn span_text<'a>(files: &'a [SourceFile], a: &FieldAnchor) -> &'a str {
        &files[a.file_index].text[a.value_start..a.value_end]
    }

    #[test]
    fn extracts_literal_joint_origin() {
        let files = vec![src(
            r#"<robot>
  <joint name="scalpel_joint" type="fixed">
    <parent link="tool0"/>
    <child link="scalpel_link"/>
    <origin xyz="0 0 -0.0062" rpy="0 0 0"/>
  </joint>
</robot>"#,
        )];
        let anchors = extract_anchors(&files);
        let xyz = anchors
            .iter()
            .find(|a| a.kind == "joint" && a.name == "scalpel_joint" && a.field == "origin.xyz")
            .expect("origin.xyz anchor");
        assert_eq!(span_text(&files, xyz), "0 0 -0.0062");
        assert_eq!(xyz.value_kind, "literal");

        let rpy = anchors
            .iter()
            .find(|a| a.field == "origin.rpy")
            .unwrap();
        assert_eq!(span_text(&files, rpy), "0 0 0");
    }

    #[test]
    fn extracts_inertial_and_mesh_and_material() {
        let files = vec![src(
            r#"<robot>
  <material name="orange"><color rgba="1 0.4 0 1"/></material>
  <link name="scalpel_link">
    <visual>
      <origin xyz="1 2 3" rpy="0 0 0"/>
      <geometry><mesh filename="package://p/m.stl" scale="0.001 0.001 0.001"/></geometry>
    </visual>
    <inertial>
      <mass value="2.5"/>
      <inertia ixx="0.1" ixy="0" ixz="0" iyy="0.2" iyz="0" izz="0.3"/>
    </inertial>
  </link>
</robot>"#,
        )];
        let a = extract_anchors(&files);
        let get = |kind: &str, name: &str, field: &str| {
            a.iter()
                .find(|x| x.kind == kind && x.name == name && x.field == field)
                .map(|x| span_text(&files, x))
        };
        assert_eq!(get("link", "scalpel_link", "inertial.mass"), Some("2.5"));
        assert_eq!(get("link", "scalpel_link", "inertial.ixx"), Some("0.1"));
        assert_eq!(get("link", "scalpel_link", "inertial.izz"), Some("0.3"));
        assert_eq!(get("link", "scalpel_link", "visual.mesh.filename"), Some("package://p/m.stl"));
        assert_eq!(get("link", "scalpel_link", "visual.mesh.scale"), Some("0.001 0.001 0.001"));
        assert_eq!(get("link", "scalpel_link", "visual.origin.xyz"), Some("1 2 3"));
        assert_eq!(get("material", "orange", "color"), Some("1 0.4 0 1"));
    }

    #[test]
    fn redirects_property_reference_to_def() {
        let files = vec![src(
            r#"<robot>
  <xacro:property name="off" value="0.5"/>
  <joint name="j" type="fixed">
    <origin xyz="${off}" rpy="0 0 0"/>
  </joint>
</robot>"#,
        )];
        let a = extract_anchors(&files);
        let xyz = a.iter().find(|x| x.field == "origin.xyz").unwrap();
        assert_eq!(xyz.value_kind, "property");
        // The span targets the property DEFINITION's value, not the reference.
        assert_eq!(span_text(&files, xyz), "0.5");
    }

    #[test]
    fn redirects_arg_reference_to_default() {
        let files = vec![src(
            r#"<robot>
  <xacro:arg name="len" default="1.0"/>
  <joint name="j" type="prismatic">
    <limit lower="0" upper="$(arg len)" effort="10" velocity="1"/>
  </joint>
</robot>"#,
        )];
        let a = extract_anchors(&files);
        let upper = a.iter().find(|x| x.field == "limit.upper").unwrap();
        assert_eq!(upper.value_kind, "arg");
        assert_eq!(span_text(&files, upper), "1.0");
    }

    #[test]
    fn no_anchor_for_unresolvable_reference() {
        // ${missing} has no def, and a mixed expression is not redirectable.
        let files = vec![src(
            r#"<robot>
  <joint name="j" type="fixed">
    <origin xyz="${missing}" rpy="${a} 0 ${b}"/>
  </joint>
</robot>"#,
        )];
        let a = extract_anchors(&files);
        // xyz references an undefined property -> no anchor.
        assert!(a.iter().all(|x| x.field != "origin.xyz"));
        // rpy is a mixed expression -> classified literal, so it IS editable
        // (the whole attribute is spliceable). It must point at the literal.
        let rpy = a.iter().find(|x| x.field == "origin.rpy").unwrap();
        assert_eq!(span_text(&files, rpy), "${a} 0 ${b}");
        assert_eq!(rpy.value_kind, "literal");
    }

    #[test]
    fn non_editable_files_yield_no_anchors() {
        let mut f = src(r#"<robot><joint name="j" type="fixed"><origin xyz="1 2 3" rpy="0 0 0"/></joint></robot>"#);
        f.editable = false;
        let a = extract_anchors(&[f]);
        assert!(a.is_empty());
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

        // scalpel_joint origin is a literal in the editable root file.
        let anchors = extract_anchors(&files);
        let xyz = anchors
            .iter()
            .find(|a| a.kind == "joint" && a.name == "scalpel_joint" && a.field == "origin.xyz")
            .expect("scalpel_joint origin.xyz must be editable");
        assert_eq!(
            &files[xyz.file_index].text[xyz.value_start..xyz.value_end],
            "0 0 -0.0062"
        );
        assert!(files[xyz.file_index].editable);
        // UR-arm joints are macro-expanded ⇒ no anchors.
        assert!(anchors.iter().all(|a| a.name != "shoulder_pan_joint"));
    }
}
