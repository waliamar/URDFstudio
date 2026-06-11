use super::{Severity, ValidationIssue};
use crate::model::Robot;
use std::collections::HashSet;

/// Schema-level checks: duplicate names for links/joints.
pub fn check_schema(robot: &Robot) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();

    let mut seen_links = HashSet::new();
    for link in &robot.links {
        if !seen_links.insert(link.name.as_str()) {
            issues.push(ValidationIssue {
                severity: Severity::Error,
                code: "duplicate-name".to_string(),
                message: format!("Duplicate link name: '{}'", link.name),
                target: Some(link.name.clone()),
            });
        }
    }

    let mut seen_joints = HashSet::new();
    for joint in &robot.joints {
        if !seen_joints.insert(joint.name.as_str()) {
            issues.push(ValidationIssue {
                severity: Severity::Error,
                code: "duplicate-name".to_string(),
                message: format!("Duplicate joint name: '{}'", joint.name),
                target: Some(joint.name.clone()),
            });
        }
    }

    issues
}
