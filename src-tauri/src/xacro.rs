//! Xacro expansion by shelling out to the installed `xacro` CLI.
//!
//! Side-effecting (spawns a process, sources ROS setup files), so it lives in
//! the Tauri crate rather than `urdf-core`. We must `source` the ROS and
//! workspace `setup.bash` files — not call the `xacro` binary directly — so
//! that xacro's Python environment and `AMENT_PREFIX_PATH` (used to resolve
//! `$(find pkg)` includes) are set the way they are under a real ROS shell.

use std::path::Path;
use std::process::Command;

/// Heuristic: is this document a xacro that needs expansion before parsing?
///
/// True when the filename carries a `.xacro` extension or the contents declare
/// the xacro namespace / use a `<xacro:` element.
pub fn is_xacro(path: &str, contents: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".xacro") || lower.ends_with(".urdf.xacro") {
        return true;
    }
    contents.contains("xmlns:xacro") || contents.contains("<xacro:")
}

/// Expand a xacro file into a computed URDF string.
///
/// Discovers the ROS distro (`/opt/ros/<distro>`) and the enclosing colcon
/// workspace, sources their `setup.bash` files, then runs `xacro <path>`.
/// Returns stdout on success; on failure returns a message including stderr.
pub fn expand_xacro(path: &str) -> Result<String, String> {
    let file = Path::new(path);
    if !file.is_file() {
        return Err(format!("xacro file not found: {path}"));
    }

    let mut script = String::new();

    // Source each discovered ROS distro's setup. Normally exactly one.
    for prefix in urdf_core::ament::discover_ros_prefixes() {
        let setup = prefix.join("setup.bash");
        script.push_str(&format!(
            "[ -f {0} ] && source {0}; ",
            shell_quote(&setup.to_string_lossy())
        ));
    }

    // Source the workspace overlay if present (provides local packages).
    if let Some(ws) = urdf_core::find_workspace_root(file) {
        let ws_setup = ws.join("install/setup.bash");
        script.push_str(&format!(
            "[ -f {0} ] && source {0}; ",
            shell_quote(&ws_setup.to_string_lossy())
        ));
    }

    script.push_str(&format!("xacro {}", shell_quote(path)));

    let output = Command::new("bash")
        .arg("-lc")
        .arg(&script)
        .output()
        .map_err(|e| format!("failed to run xacro: {e}"))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("xacro produced non-UTF8 output: {e}"))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "xacro failed (exit {}):\n{}",
            output.status.code().unwrap_or(-1),
            stderr.trim()
        ))
    }
}

/// Single-quote a string for safe inclusion in a bash command.
fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_xacro_by_extension() {
        assert!(is_xacro("/a/b/robot.urdf.xacro", ""));
        assert!(is_xacro("/a/b/robot.xacro", ""));
        assert!(is_xacro("/a/b/ROBOT.XACRO", ""));
    }

    #[test]
    fn detects_xacro_by_contents() {
        assert!(is_xacro(
            "/a/b/robot.urdf",
            r#"<robot xmlns:xacro="http://ros.org/wiki/xacro">"#
        ));
        assert!(is_xacro("/a/b/robot.urdf", "<xacro:include filename=\"x\"/>"));
    }

    #[test]
    fn plain_urdf_is_not_xacro() {
        assert!(!is_xacro("/a/b/robot.urdf", "<robot name=\"r\"></robot>"));
    }

    #[test]
    fn shell_quote_escapes_single_quotes() {
        assert_eq!(shell_quote("a'b"), "'a'\\''b'");
        assert_eq!(shell_quote("/plain/path"), "'/plain/path'");
    }

    /// End-to-end against the real scalpel workspace. Opt-in: requires ROS
    /// Humble + the scalpel checkout, so it is `#[ignore]`d by default. Run with
    /// `cargo test -p urdf-studio --lib -- --ignored real_scalpel`.
    #[test]
    #[ignore]
    fn real_scalpel_xacro_expands_and_validates() {
        let file = "/home/wali/coding/scalpel_ur16e/src/scalpel_description/urdf/ur16e_with_scalpel.urdf.xacro";
        let computed = expand_xacro(file).expect("xacro expansion should succeed");
        assert!(computed.contains("tool0"), "computed URDF must contain tool0");
        assert!(
            computed.contains("base_link"),
            "computed URDF must contain base_link"
        );

        let robot = urdf_core::parse_urdf(&computed).expect("computed URDF should parse");
        assert!(robot.links.iter().any(|l| l.name == "tool0"));
        assert!(robot.links.iter().any(|l| l.name == "base_link"));

        let issues = urdf_core::validate(&robot);
        let errors: Vec<_> = issues
            .iter()
            .filter(|i| matches!(i.severity, urdf_core::Severity::Error))
            .collect();
        assert!(
            errors.is_empty(),
            "expected zero validation errors, got: {errors:?}"
        );
    }
}
