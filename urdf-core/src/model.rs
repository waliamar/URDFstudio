//! Canonical robot data model (PRD §6.1), mirrored to TypeScript via ts-rs.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct Robot {
    pub name: String,
    pub links: Vec<Link>,
    pub joints: Vec<Joint>,
    pub materials: Vec<Material>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct Link {
    pub name: String,
    pub visual: Option<Visual>,
    pub collision: Option<Collision>,
    pub inertial: Option<Inertial>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct Visual {
    pub origin: Pose,
    pub geometry: Geometry,
    pub material_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct Collision {
    pub origin: Pose,
    pub geometry: Geometry,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct Inertial {
    pub origin: Pose,
    pub mass: f64,
    pub inertia: InertiaTensor,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "lowercase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub enum Geometry {
    Box { size: [f64; 3] },
    Cylinder { radius: f64, length: f64 },
    Sphere { radius: f64 },
    Mesh { filename: String, scale: [f64; 3] },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct Joint {
    pub name: String,
    pub joint_type: JointType,
    pub parent: String,
    pub child: String,
    pub origin: Pose,
    pub axis: Option<[f64; 3]>,
    pub limit: Option<JointLimit>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub enum JointType {
    Fixed,
    Revolute,
    Continuous,
    Prismatic,
    Planar,
    Floating,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct JointLimit {
    pub lower: f64,
    pub upper: f64,
    pub effort: f64,
    pub velocity: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct Pose {
    pub xyz: [f64; 3],
    pub rpy: [f64; 3],
}

impl Default for Pose {
    fn default() -> Self {
        Pose { xyz: [0.0, 0.0, 0.0], rpy: [0.0, 0.0, 0.0] }
    }
}

impl Pose {
    pub fn is_zero(&self) -> bool {
        self.xyz == [0.0, 0.0, 0.0] && self.rpy == [0.0, 0.0, 0.0]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct InertiaTensor {
    pub ixx: f64,
    pub ixy: f64,
    pub ixz: f64,
    pub iyy: f64,
    pub iyz: f64,
    pub izz: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct Material {
    pub name: String,
    pub color: Option<[f64; 4]>,
    pub texture: Option<String>,
}
