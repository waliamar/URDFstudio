use super::{Severity, ValidationIssue};
use crate::model::Robot;
use std::collections::{HashMap, HashSet};

/// Kinematic chain checks: missing link references, multiple roots,
/// disconnected links, and cycles.
pub fn check_kinematics(robot: &Robot) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();

    let link_names: HashSet<&str> = robot.links.iter().map(|l| l.name.as_str()).collect();

    // Missing parent/child link references.
    for joint in &robot.joints {
        if !link_names.contains(joint.parent.as_str()) {
            issues.push(ValidationIssue {
                severity: Severity::Error,
                code: "missing-link-ref".to_string(),
                message: format!(
                    "Joint '{}' references unknown parent link '{}'",
                    joint.name, joint.parent
                ),
                target: Some(joint.name.clone()),
            });
        }
        if !link_names.contains(joint.child.as_str()) {
            issues.push(ValidationIssue {
                severity: Severity::Error,
                code: "missing-link-ref".to_string(),
                message: format!(
                    "Joint '{}' references unknown child link '{}'",
                    joint.name, joint.child
                ),
                target: Some(joint.name.clone()),
            });
        }
    }

    if robot.links.is_empty() {
        return issues;
    }

    // Build child -> parent map (only for joints whose endpoints both exist).
    let mut child_to_parent: HashMap<&str, &str> = HashMap::new();
    let mut adjacency: HashMap<&str, Vec<&str>> = HashMap::new();
    for joint in &robot.joints {
        if link_names.contains(joint.parent.as_str()) && link_names.contains(joint.child.as_str())
        {
            child_to_parent
                .entry(joint.child.as_str())
                .or_insert(joint.parent.as_str());
            adjacency
                .entry(joint.parent.as_str())
                .or_default()
                .push(joint.child.as_str());
            adjacency
                .entry(joint.child.as_str())
                .or_default()
                .push(joint.parent.as_str());
        }
    }

    // Roots = links that are never a child.
    let roots: Vec<&str> = robot
        .links
        .iter()
        .map(|l| l.name.as_str())
        .filter(|name| !child_to_parent.contains_key(name))
        .collect();

    if roots.len() > 1 {
        for root in &roots {
            issues.push(ValidationIssue {
                severity: Severity::Error,
                code: "multiple-roots".to_string(),
                message: format!(
                    "Robot has multiple root links (no parent joint): '{root}'"
                ),
                target: Some(root.to_string()),
            });
        }
    }

    // Disconnected links: find connected components over the undirected
    // adjacency graph; any link not in the largest component is disconnected
    // from the main robot tree.
    let mut visited: HashSet<&str> = HashSet::new();
    let mut components: Vec<Vec<&str>> = Vec::new();
    for link in &robot.links {
        let start = link.name.as_str();
        if visited.contains(start) {
            continue;
        }
        let mut component = Vec::new();
        let mut stack = vec![start];
        while let Some(node) = stack.pop() {
            if !visited.insert(node) {
                continue;
            }
            component.push(node);
            if let Some(neighbors) = adjacency.get(node) {
                for n in neighbors {
                    if !visited.contains(n) {
                        stack.push(n);
                    }
                }
            }
        }
        components.push(component);
    }

    let main_component_idx = components
        .iter()
        .enumerate()
        .max_by_key(|(_, c)| c.len())
        .map(|(i, _)| i);

    for (idx, component) in components.iter().enumerate() {
        if Some(idx) == main_component_idx || components.len() <= 1 {
            continue;
        }
        for link in component {
            issues.push(ValidationIssue {
                severity: Severity::Error,
                code: "disconnected-link".to_string(),
                message: format!("Link '{}' is not connected to the robot tree", link),
                target: Some(link.to_string()),
            });
        }
    }

    // Cycle detection: a child appearing as a child of more than one joint
    // (i.e. a link with two parents) indicates a kinematic loop.
    let mut child_count: HashMap<&str, usize> = HashMap::new();
    for joint in &robot.joints {
        if link_names.contains(joint.parent.as_str()) && link_names.contains(joint.child.as_str())
        {
            *child_count.entry(joint.child.as_str()).or_insert(0) += 1;
        }
    }
    for (link, count) in child_count {
        if count > 1 {
            issues.push(ValidationIssue {
                severity: Severity::Error,
                code: "kinematic-loop".to_string(),
                message: format!(
                    "Link '{link}' has multiple parent joints, forming a kinematic loop"
                ),
                target: Some(link.to_string()),
            });
        }
    }

    issues
}
