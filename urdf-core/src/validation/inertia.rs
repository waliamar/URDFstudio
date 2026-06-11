use super::{Severity, ValidationIssue};
use crate::model::{InertiaTensor, Robot};

/// Inertia sanity checks: non-positive mass and non-positive-definite
/// inertia tensors (via Sylvester's criterion on leading principal minors).
pub fn check_inertia(robot: &Robot) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();

    for link in &robot.links {
        let Some(inertial) = &link.inertial else {
            continue;
        };

        if inertial.mass <= 0.0 {
            issues.push(ValidationIssue {
                severity: Severity::Error,
                code: "invalid-mass".to_string(),
                message: format!(
                    "Link '{}' has non-positive mass ({})",
                    link.name, inertial.mass
                ),
                target: Some(link.name.clone()),
            });
        }

        if !is_positive_definite(&inertial.inertia) {
            issues.push(ValidationIssue {
                severity: Severity::Error,
                code: "invalid-inertia".to_string(),
                message: format!(
                    "Link '{}' has a non-positive-definite inertia tensor",
                    link.name
                ),
                target: Some(link.name.clone()),
            });
        }
    }

    issues
}

/// Sylvester's criterion: a symmetric matrix is positive definite iff all
/// leading principal minors are strictly positive.
fn is_positive_definite(t: &InertiaTensor) -> bool {
    let m1 = t.ixx;
    let m2 = t.ixx * t.iyy - t.ixy * t.ixy;
    let m3 = t.ixx * (t.iyy * t.izz - t.iyz * t.iyz)
        - t.ixy * (t.ixy * t.izz - t.iyz * t.ixz)
        + t.ixz * (t.ixy * t.iyz - t.iyy * t.ixz);

    m1 > 0.0 && m2 > 0.0 && m3 > 0.0
}
