pub mod inertia;
pub mod kinematics;
pub mod schema;

use crate::model::Robot;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub enum Severity {
    Error,
    Warning,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct ValidationIssue {
    pub severity: Severity,
    pub code: String,
    pub message: String,
    pub target: Option<String>,
}

/// Run all validation checks on a robot model and return all issues found.
pub fn validate(robot: &Robot) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();
    issues.extend(schema::check_schema(robot));
    issues.extend(kinematics::check_kinematics(robot));
    issues.extend(inertia::check_inertia(robot));
    issues
}
