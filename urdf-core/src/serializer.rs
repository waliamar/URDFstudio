//! Deterministic URDF XML serializer (NFR-5: same model -> byte-identical output).
//!
//! Rules:
//! - 2-space indentation.
//! - Field order: name, links, joints, materials; within a link: visual,
//!   collision, inertial.
//! - Optional elements (`Option::None`) are omitted entirely.
//! - An `<origin>` element is omitted when both xyz and rpy are all zero
//!   (the URDF default), otherwise it is always emitted with both attributes.
//! - Floats are written via Rust's `{}` Display, which produces the
//!   shortest representation that round-trips exactly.

use crate::model::*;
use crate::CoreError;
use std::fmt::Write;

pub fn serialize_urdf(robot: &Robot) -> Result<String, CoreError> {
    let mut out = String::new();
    out.push_str("<?xml version=\"1.0\"?>\n");
    writeln!(out, "<robot name=\"{}\">", escape(&robot.name)).unwrap();

    for link in &robot.links {
        write_link(&mut out, link, 1);
    }
    for joint in &robot.joints {
        write_joint(&mut out, joint, 1);
    }
    for material in &robot.materials {
        write_material(&mut out, material, 1);
    }

    out.push_str("</robot>\n");
    Ok(out)
}

fn indent(out: &mut String, level: usize) {
    for _ in 0..level {
        out.push_str("  ");
    }
}

fn fmt_floats(values: &[f64]) -> String {
    values.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(" ")
}

fn write_origin(out: &mut String, origin: &Pose, level: usize) {
    if origin.is_zero() {
        return;
    }
    indent(out, level);
    writeln!(
        out,
        "<origin xyz=\"{}\" rpy=\"{}\"/>",
        fmt_floats(&origin.xyz),
        fmt_floats(&origin.rpy)
    )
    .unwrap();
}

fn write_geometry(out: &mut String, geometry: &Geometry, level: usize) {
    indent(out, level);
    out.push_str("<geometry>\n");
    indent(out, level + 1);
    match geometry {
        Geometry::Box { size } => {
            writeln!(out, "<box size=\"{}\"/>", fmt_floats(size)).unwrap();
        }
        Geometry::Cylinder { radius, length } => {
            writeln!(out, "<cylinder radius=\"{radius}\" length=\"{length}\"/>").unwrap();
        }
        Geometry::Sphere { radius } => {
            writeln!(out, "<sphere radius=\"{radius}\"/>").unwrap();
        }
        Geometry::Mesh { filename, scale } => {
            if *scale == [1.0, 1.0, 1.0] {
                writeln!(out, "<mesh filename=\"{}\"/>", escape(filename)).unwrap();
            } else {
                writeln!(
                    out,
                    "<mesh filename=\"{}\" scale=\"{}\"/>",
                    escape(filename),
                    fmt_floats(scale)
                )
                .unwrap();
            }
        }
    }
    indent(out, level);
    out.push_str("</geometry>\n");
}

fn write_link(out: &mut String, link: &Link, level: usize) {
    indent(out, level);
    let has_children = link.visual.is_some() || link.collision.is_some() || link.inertial.is_some();
    if !has_children {
        writeln!(out, "<link name=\"{}\"/>", escape(&link.name)).unwrap();
        return;
    }
    writeln!(out, "<link name=\"{}\">", escape(&link.name)).unwrap();

    if let Some(visual) = &link.visual {
        indent(out, level + 1);
        out.push_str("<visual>\n");
        write_origin(out, &visual.origin, level + 2);
        write_geometry(out, &visual.geometry, level + 2);
        if let Some(material_name) = &visual.material_name {
            indent(out, level + 2);
            writeln!(out, "<material name=\"{}\"/>", escape(material_name)).unwrap();
        }
        indent(out, level + 1);
        out.push_str("</visual>\n");
    }

    if let Some(collision) = &link.collision {
        indent(out, level + 1);
        out.push_str("<collision>\n");
        write_origin(out, &collision.origin, level + 2);
        write_geometry(out, &collision.geometry, level + 2);
        indent(out, level + 1);
        out.push_str("</collision>\n");
    }

    if let Some(inertial) = &link.inertial {
        indent(out, level + 1);
        out.push_str("<inertial>\n");
        write_origin(out, &inertial.origin, level + 2);
        indent(out, level + 2);
        writeln!(out, "<mass value=\"{}\"/>", inertial.mass).unwrap();
        indent(out, level + 2);
        let i = &inertial.inertia;
        writeln!(
            out,
            "<inertia ixx=\"{}\" ixy=\"{}\" ixz=\"{}\" iyy=\"{}\" iyz=\"{}\" izz=\"{}\"/>",
            i.ixx, i.ixy, i.ixz, i.iyy, i.iyz, i.izz
        )
        .unwrap();
        indent(out, level + 1);
        out.push_str("</inertial>\n");
    }

    indent(out, level);
    out.push_str("</link>\n");
}

fn write_joint(out: &mut String, joint: &Joint, level: usize) {
    indent(out, level);
    let type_str = match joint.joint_type {
        JointType::Fixed => "fixed",
        JointType::Revolute => "revolute",
        JointType::Continuous => "continuous",
        JointType::Prismatic => "prismatic",
        JointType::Planar => "planar",
        JointType::Floating => "floating",
    };
    writeln!(out, "<joint name=\"{}\" type=\"{}\">", escape(&joint.name), type_str).unwrap();

    write_origin(out, &joint.origin, level + 1);

    indent(out, level + 1);
    writeln!(out, "<parent link=\"{}\"/>", escape(&joint.parent)).unwrap();
    indent(out, level + 1);
    writeln!(out, "<child link=\"{}\"/>", escape(&joint.child)).unwrap();

    if let Some(axis) = &joint.axis {
        indent(out, level + 1);
        writeln!(out, "<axis xyz=\"{}\"/>", fmt_floats(axis)).unwrap();
    }

    if let Some(limit) = &joint.limit {
        indent(out, level + 1);
        writeln!(
            out,
            "<limit lower=\"{}\" upper=\"{}\" effort=\"{}\" velocity=\"{}\"/>",
            limit.lower, limit.upper, limit.effort, limit.velocity
        )
        .unwrap();
    }

    indent(out, level);
    out.push_str("</joint>\n");
}

fn write_material(out: &mut String, material: &Material, level: usize) {
    indent(out, level);
    let has_children = material.color.is_some() || material.texture.is_some();
    if !has_children {
        writeln!(out, "<material name=\"{}\"/>", escape(&material.name)).unwrap();
        return;
    }
    writeln!(out, "<material name=\"{}\">", escape(&material.name)).unwrap();
    if let Some(color) = &material.color {
        indent(out, level + 1);
        writeln!(out, "<color rgba=\"{}\"/>", fmt_floats(color)).unwrap();
    }
    if let Some(texture) = &material.texture {
        indent(out, level + 1);
        writeln!(out, "<texture filename=\"{}\"/>", escape(texture)).unwrap();
    }
    indent(out, level);
    out.push_str("</material>\n");
}

/// Minimal XML attribute/text escaping for the characters URDF commonly contains.
fn escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
