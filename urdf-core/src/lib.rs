pub mod ament;
pub mod mesh;
pub mod model;
pub mod parser;
pub mod serializer;
pub mod source_tree;
pub mod validation;

pub use ament::{build_index_for, find_workspace_root, PackageIndex};
pub use mesh::{resolve_mesh_path, resolve_mesh_path_indexed};
pub use source_tree::{build_source_tree, SourceFile};
pub use model::*;
pub use parser::parse_urdf;
pub use serializer::serialize_urdf;
pub use validation::{validate, Severity, ValidationIssue};

use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("XML parse error: {0}")]
    Parse(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

/// Create a new, empty robot with a single base_link and no joints.
pub fn new_robot(name: &str) -> Robot {
    Robot {
        name: name.to_string(),
        links: vec![Link {
            name: "base_link".to_string(),
            visual: None,
            collision: None,
            inertial: None,
        }],
        joints: vec![],
        materials: vec![],
    }
}
