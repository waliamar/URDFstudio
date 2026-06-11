use std::path::{Path, PathBuf};

/// Resolve a mesh path from a URDF `filename` attribute.
///
/// - If `package_path` starts with `package://<pkg>/rest`, walk up from
///   `urdf_dir` looking for a directory named `<pkg>` containing
///   `package.xml` (checking both the directory itself and its siblings at
///   each level), and return `<pkgdir>/rest`.
/// - Otherwise, treat `package_path` as relative to `urdf_dir` and join them.
pub fn resolve_mesh_path(package_path: &str, urdf_dir: &str) -> Option<PathBuf> {
    if let Some(rest) = package_path.strip_prefix("package://") {
        let mut parts = rest.splitn(2, '/');
        let pkg = parts.next()?;
        let rest_path = parts.next().unwrap_or("");

        let mut dir = Some(Path::new(urdf_dir).to_path_buf());
        while let Some(current) = dir {
            // Check the current directory itself.
            if dir_is_package(&current, pkg) {
                return Some(current.join(rest_path));
            }
            // Check siblings of the current directory.
            if let Some(parent) = current.parent() {
                if let Ok(entries) = std::fs::read_dir(parent) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() && dir_is_package(&path, pkg) {
                            return Some(path.join(rest_path));
                        }
                    }
                }
                dir = Some(parent.to_path_buf());
            } else {
                dir = None;
            }
        }
        None
    } else {
        Some(Path::new(urdf_dir).join(package_path))
    }
}

/// True if `path` is a directory named `pkg` containing `package.xml`.
fn dir_is_package(path: &Path, pkg: &str) -> bool {
    path.file_name().and_then(|n| n.to_str()) == Some(pkg) && path.join("package.xml").is_file()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn unique_temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "urdf_core_mesh_test_{name}_{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn resolves_relative_path() {
        let urdf_dir = unique_temp_dir("relative");
        let resolved = resolve_mesh_path("meshes/base.stl", urdf_dir.to_str().unwrap()).unwrap();
        assert_eq!(resolved, urdf_dir.join("meshes/base.stl"));
        fs::remove_dir_all(&urdf_dir).ok();
    }

    #[test]
    fn resolves_package_path_in_ancestor() {
        // Layout:
        //   root/
        //     my_pkg/
        //       package.xml
        //       urdf/robot.urdf  (urdf_dir)
        //       meshes/base.stl
        let root = unique_temp_dir("ancestor");
        let pkg = root.join("my_pkg");
        let urdf_dir = pkg.join("urdf");
        fs::create_dir_all(&urdf_dir).unwrap();
        fs::write(pkg.join("package.xml"), "<package/>").unwrap();
        fs::create_dir_all(pkg.join("meshes")).unwrap();

        let resolved = resolve_mesh_path(
            "package://my_pkg/meshes/base.stl",
            urdf_dir.to_str().unwrap(),
        )
        .unwrap();
        assert_eq!(resolved, pkg.join("meshes/base.stl"));

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn resolves_package_path_via_sibling() {
        // Layout:
        //   root/
        //     workspace_robot/
        //       urdf/robot.urdf  (urdf_dir)
        //     my_pkg/
        //       package.xml
        //       meshes/base.stl
        let root = unique_temp_dir("sibling");
        let urdf_dir = root.join("workspace_robot/urdf");
        fs::create_dir_all(&urdf_dir).unwrap();
        let pkg = root.join("my_pkg");
        fs::create_dir_all(pkg.join("meshes")).unwrap();
        fs::write(pkg.join("package.xml"), "<package/>").unwrap();

        let resolved = resolve_mesh_path(
            "package://my_pkg/meshes/base.stl",
            urdf_dir.to_str().unwrap(),
        )
        .unwrap();
        assert_eq!(resolved, pkg.join("meshes/base.stl"));

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn returns_none_when_package_not_found() {
        let urdf_dir = unique_temp_dir("notfound");
        let resolved = resolve_mesh_path(
            "package://nonexistent_pkg/meshes/base.stl",
            urdf_dir.to_str().unwrap(),
        );
        assert!(resolved.is_none());
        fs::remove_dir_all(&urdf_dir).ok();
    }
}
