//! Minimal ament/ROS package index.
//!
//! Maps a package name to its `share/` directory so `package://pkg/rest`
//! references (and `$(find pkg)` in xacro includes) resolve the same way ROS
//! resolves them — by consulting the ament resource index of each install
//! prefix, with a `package.xml` scan of the workspace `src/` tree as a fallback.
//!
//! Pure and side-effect-free apart from reading the filesystem, so it is
//! exercised by temp-dir unit tests like [`crate::mesh`].

use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Resolves package names to their installed `share/` directory.
#[derive(Debug, Clone, Default)]
pub struct PackageIndex {
    share_dirs: HashMap<String, PathBuf>,
}

impl PackageIndex {
    /// The `share/<pkg>` directory for `pkg`, if known.
    pub fn share_dir(&self, pkg: &str) -> Option<PathBuf> {
        self.share_dirs.get(pkg).cloned()
    }

    /// Alias for [`Self::share_dir`] — the package root used by `$(find pkg)`.
    pub fn find(&self, pkg: &str) -> Option<PathBuf> {
        self.share_dir(pkg)
    }

    /// Number of indexed packages (mostly for tests/diagnostics).
    pub fn len(&self) -> usize {
        self.share_dirs.len()
    }

    pub fn is_empty(&self) -> bool {
        self.share_dirs.is_empty()
    }

    /// Insert only if absent, preserving higher-precedence earlier inserts.
    fn insert_if_absent(&mut self, pkg: String, share_dir: PathBuf) {
        self.share_dirs.entry(pkg).or_insert(share_dir);
    }

    /// Build an index from a workspace root and a set of ROS install prefixes.
    ///
    /// Precedence (highest first): workspace `install/` > workspace `src/`
    /// `package.xml` scan > the `ros_prefixes` (e.g. `/opt/ros/<distro>`), in
    /// the order given. Earlier sources win on name collisions.
    pub fn build(workspace_root: Option<&Path>, ros_prefixes: &[PathBuf]) -> PackageIndex {
        let mut index = PackageIndex::default();

        if let Some(ws) = workspace_root {
            // 1. Workspace install/ (merged or isolated ament layout).
            let install = ws.join("install");
            if install.is_dir() {
                index.scan_install_tree(&install);
            }
            // 2. Workspace src/**/package.xml fallback.
            let src = ws.join("src");
            if src.is_dir() {
                index.scan_src_packages(&src);
            }
        }

        // 3. Global ROS prefixes (merged ament layout).
        for prefix in ros_prefixes {
            index.scan_ament_prefix(prefix);
        }

        index
    }

    /// Scan a workspace `install/` directory, handling both the merged layout
    /// (`install/share/...`) and the isolated layout (`install/<pkg>/share/...`).
    fn scan_install_tree(&mut self, install: &Path) {
        // Merged: install/ is itself an ament prefix.
        let merged_marker = install
            .join("share/ament_index/resource_index/packages");
        let mut found_merged = false;
        if merged_marker.is_dir() {
            self.scan_ament_prefix(install);
            found_merged = true;
        }
        // Isolated: each install/<pkg>/ is its own ament prefix.
        if let Ok(entries) = std::fs::read_dir(install) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let marker = path.join("share/ament_index/resource_index/packages");
                    if marker.is_dir() {
                        self.scan_ament_prefix(&path);
                    }
                }
            }
        }
        let _ = found_merged;
    }

    /// Scan one ament install prefix: read the package markers under
    /// `share/ament_index/resource_index/packages/` and map each `<pkg>` to
    /// `<prefix>/share/<pkg>` (only when that share dir exists).
    fn scan_ament_prefix(&mut self, prefix: &Path) {
        let markers = prefix.join("share/ament_index/resource_index/packages");
        let Ok(entries) = std::fs::read_dir(&markers) else {
            return;
        };
        for entry in entries.flatten() {
            let Some(pkg) = entry.file_name().to_str().map(str::to_owned) else {
                continue;
            };
            let share = prefix.join("share").join(&pkg);
            if share.is_dir() {
                self.insert_if_absent(pkg, share);
            }
        }
    }

    /// Fallback: recursively scan `src/` for `package.xml` files and map the
    /// declared `<name>` to the directory containing the manifest.
    fn scan_src_packages(&mut self, src: &Path) {
        let mut stack = vec![src.to_path_buf()];
        while let Some(dir) = stack.pop() {
            let Ok(entries) = std::fs::read_dir(&dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    stack.push(path);
                } else if path.file_name().and_then(|n| n.to_str()) == Some("package.xml") {
                    if let Some(name) = read_package_name(&path) {
                        if let Some(parent) = path.parent() {
                            self.insert_if_absent(name, parent.to_path_buf());
                        }
                    }
                }
            }
        }
    }
}

/// Walk up from `start` to the enclosing colcon workspace root, returning that
/// directory. `start` may be a file (its parent is used).
///
/// A directory qualifies as a workspace root when it contains an `install/`
/// space, or a `src/` space that is not itself a ROS package (no `package.xml`
/// alongside it). The package-manifest guard is essential: a ROS package may
/// have its own `src/` subdirectory (C++ sources), which must not be mistaken
/// for the workspace `src/` space.
pub fn find_workspace_root(start: &Path) -> Option<PathBuf> {
    let mut dir = if start.is_dir() {
        Some(start.to_path_buf())
    } else {
        start.parent().map(Path::to_path_buf)
    };
    while let Some(current) = dir {
        if is_workspace_root(&current) {
            return Some(current);
        }
        dir = current.parent().map(Path::to_path_buf);
    }
    None
}

fn is_workspace_root(dir: &Path) -> bool {
    if dir.join("install").is_dir() {
        return true;
    }
    dir.join("src").is_dir() && !dir.join("package.xml").is_file()
}

/// Discover global ROS install prefixes: each `/opt/ros/<distro>` that contains
/// a `setup.bash`. Returns them sorted for deterministic precedence.
pub fn discover_ros_prefixes() -> Vec<PathBuf> {
    let mut prefixes = Vec::new();
    if let Ok(entries) = std::fs::read_dir("/opt/ros") {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && path.join("setup.bash").is_file() {
                prefixes.push(path);
            }
        }
    }
    prefixes.sort();
    prefixes
}

/// Convenience constructor used by the app: locate the workspace from `start`
/// and include the discovered `/opt/ros/<distro>` prefixes.
pub fn build_index_for(start: &Path) -> PackageIndex {
    let ws = find_workspace_root(start);
    PackageIndex::build(ws.as_deref(), &discover_ros_prefixes())
}

/// Extract the `<name>...</name>` text from a `package.xml` manifest.
fn read_package_name(manifest: &Path) -> Option<String> {
    let text = std::fs::read_to_string(manifest).ok()?;
    let start = text.find("<name>")? + "<name>".len();
    let end = text[start..].find("</name>")? + start;
    let name = text[start..end].trim();
    if name.is_empty() {
        None
    } else {
        Some(name.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn unique_temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "urdf_core_ament_test_{name}_{}_{:?}",
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

    /// Create an ament package marker + share dir under `prefix`.
    fn make_ament_pkg(prefix: &Path, pkg: &str) {
        let markers = prefix.join("share/ament_index/resource_index/packages");
        fs::create_dir_all(&markers).unwrap();
        fs::write(markers.join(pkg), "").unwrap();
        fs::create_dir_all(prefix.join("share").join(pkg)).unwrap();
    }

    #[test]
    fn resolves_isolated_install_layout() {
        let ws = unique_temp_dir("isolated");
        // install/<pkg>/share/<pkg>
        make_ament_pkg(&ws.join("install/scalpel_description"), "scalpel_description");

        let index = PackageIndex::build(Some(&ws), &[]);
        assert_eq!(
            index.share_dir("scalpel_description"),
            Some(ws.join("install/scalpel_description/share/scalpel_description")),
        );
        fs::remove_dir_all(&ws).ok();
    }

    #[test]
    fn resolves_merged_install_layout() {
        let ws = unique_temp_dir("merged");
        // install/share/<pkg>
        make_ament_pkg(&ws.join("install"), "my_robot");

        let index = PackageIndex::build(Some(&ws), &[]);
        assert_eq!(
            index.share_dir("my_robot"),
            Some(ws.join("install/share/my_robot")),
        );
        fs::remove_dir_all(&ws).ok();
    }

    #[test]
    fn resolves_src_package_xml_fallback() {
        let ws = unique_temp_dir("srcfallback");
        let pkg_dir = ws.join("src/some/nested/my_pkg");
        fs::create_dir_all(&pkg_dir).unwrap();
        fs::write(
            pkg_dir.join("package.xml"),
            "<package><name>my_pkg</name></package>",
        )
        .unwrap();

        let index = PackageIndex::build(Some(&ws), &[]);
        assert_eq!(index.share_dir("my_pkg"), Some(pkg_dir));
        fs::remove_dir_all(&ws).ok();
    }

    #[test]
    fn resolves_ros_prefix() {
        let root = unique_temp_dir("rosprefix");
        let prefix = root.join("opt/ros/humble");
        make_ament_pkg(&prefix, "ur_description");

        let index = PackageIndex::build(None, &[prefix.clone()]);
        assert_eq!(
            index.share_dir("ur_description"),
            Some(prefix.join("share/ur_description")),
        );
        assert_eq!(index.find("ur_description"), index.share_dir("ur_description"));
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn workspace_install_wins_over_ros_prefix() {
        let root = unique_temp_dir("precedence");
        let ws = root.join("ws");
        make_ament_pkg(&ws.join("install/shared_pkg"), "shared_pkg");
        let ros = root.join("opt/ros/humble");
        make_ament_pkg(&ros, "shared_pkg");

        let index = PackageIndex::build(Some(&ws), &[ros]);
        assert_eq!(
            index.share_dir("shared_pkg"),
            Some(ws.join("install/shared_pkg/share/shared_pkg")),
            "workspace install must take precedence over /opt/ros",
        );
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn find_workspace_root_skips_package_with_own_src() {
        // ws/install/ exists; the package dir has its own src/ + package.xml and
        // must NOT be mistaken for the workspace root.
        let ws = unique_temp_dir("pkgsrc");
        fs::create_dir_all(ws.join("install")).unwrap();
        let pkg = ws.join("src/scalpel_description");
        fs::create_dir_all(pkg.join("src")).unwrap();
        fs::create_dir_all(pkg.join("urdf")).unwrap();
        fs::write(pkg.join("package.xml"), "<package><name>scalpel_description</name></package>").unwrap();

        let start = pkg.join("urdf/robot.urdf.xacro");
        assert_eq!(find_workspace_root(&start), Some(ws.clone()));
        fs::remove_dir_all(&ws).ok();
    }

    #[test]
    fn find_workspace_root_walks_up() {
        let ws = unique_temp_dir("findroot");
        fs::create_dir_all(ws.join("src/pkg/urdf")).unwrap();
        let start = ws.join("src/pkg/urdf/robot.urdf.xacro");
        // start need not exist as a file for the walk (we use its parent).
        assert_eq!(find_workspace_root(&start), Some(ws.clone()));
        fs::remove_dir_all(&ws).ok();
    }
}
