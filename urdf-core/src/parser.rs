//! Hand-rolled URDF XML parser built on quick-xml's pull-event `Reader`.

use crate::model::*;
use crate::CoreError;
use quick_xml::events::{BytesStart, Event};
use quick_xml::reader::Reader;

/// Parse a URDF XML document into a [`Robot`].
pub fn parse_urdf(xml: &str) -> Result<Robot, CoreError> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut name = String::new();
    let mut links = Vec::new();
    let mut joints = Vec::new();
    let mut materials: Vec<Material> = Vec::new();

    let mut buf = Vec::new();
    loop {
        match reader
            .read_event_into(&mut buf)
            .map_err(|e| CoreError::Parse(e.to_string()))?
        {
            Event::Start(e) if e.local_name().as_ref() == b"robot" => {
                name = get_attr(&e, "name").unwrap_or_default();
            }
            Event::Start(e) if e.local_name().as_ref() == b"link" => {
                links.push(parse_link(&mut reader, &e, &mut materials)?);
            }
            Event::Empty(e) if e.local_name().as_ref() == b"link" => {
                links.push(Link {
                    name: get_attr(&e, "name").unwrap_or_default(),
                    visual: None,
                    collision: None,
                    inertial: None,
                });
            }
            Event::Start(e) if e.local_name().as_ref() == b"joint" => {
                joints.push(parse_joint(&mut reader, &e)?);
            }
            Event::Start(e) if e.local_name().as_ref() == b"material" => {
                if let Some(m) = parse_material(&mut reader, &e)? {
                    upsert_material(&mut materials, m);
                }
            }
            Event::Empty(e) if e.local_name().as_ref() == b"material" => {
                let mat_name = get_attr(&e, "name").unwrap_or_default();
                upsert_material(
                    &mut materials,
                    Material { name: mat_name, color: None, texture: None },
                );
            }
            Event::Eof => break,
            _ => {}
        }
        buf.clear();
    }

    Ok(Robot { name, links, joints, materials })
}

/// Read the value of attribute `key` from a start/empty tag, if present.
fn get_attr(e: &BytesStart, key: &str) -> Option<String> {
    e.attributes().flatten().find_map(|a| {
        if a.key.as_ref() == key.as_bytes() {
            Some(String::from_utf8_lossy(&a.value).into_owned())
        } else {
            None
        }
    })
}

/// Parse a whitespace-separated list of N floats from an attribute.
fn parse_floats<const N: usize>(s: &str, default: [f64; N]) -> [f64; N] {
    let mut out = default;
    for (i, tok) in s.split_whitespace().enumerate().take(N) {
        if let Ok(v) = tok.parse::<f64>() {
            out[i] = v;
        }
    }
    out
}

/// Parse an `<origin xyz="..." rpy="..."/>` element (or default to zero pose).
fn parse_origin(e: &BytesStart) -> Pose {
    let xyz = get_attr(e, "xyz")
        .map(|s| parse_floats::<3>(&s, [0.0; 3]))
        .unwrap_or([0.0; 3]);
    let rpy = get_attr(e, "rpy")
        .map(|s| parse_floats::<3>(&s, [0.0; 3]))
        .unwrap_or([0.0; 3]);
    Pose { xyz, rpy }
}

/// Insert a material into the robot-level list, replacing/merging by name.
/// If a material with the same name already exists and the new one carries
/// no color/texture (i.e. it's a bare reference), keep the existing entry.
fn upsert_material(materials: &mut Vec<Material>, mat: Material) {
    if let Some(existing) = materials.iter_mut().find(|m| m.name == mat.name) {
        if mat.color.is_some() {
            existing.color = mat.color;
        }
        if mat.texture.is_some() {
            existing.texture = mat.texture;
        }
    } else {
        materials.push(mat);
    }
}

/// Parse a `<material>...</material>` block, returning `None` for an empty
/// reference-only element with no children (handled separately for `<material/>`).
fn parse_material(reader: &mut Reader<&[u8]>, start: &BytesStart) -> Result<Option<Material>, CoreError> {
    let mat_name = get_attr(start, "name").unwrap_or_default();
    let mut color = None;
    let mut texture = None;

    let mut buf = Vec::new();
    loop {
        match reader
            .read_event_into(&mut buf)
            .map_err(|e| CoreError::Parse(e.to_string()))?
        {
            Event::Empty(e) | Event::Start(e) if e.local_name().as_ref() == b"color" => {
                if let Some(rgba) = get_attr(&e, "rgba") {
                    color = Some(parse_floats::<4>(&rgba, [0.0, 0.0, 0.0, 1.0]));
                }
            }
            Event::Empty(e) | Event::Start(e) if e.local_name().as_ref() == b"texture" => {
                texture = get_attr(&e, "filename");
            }
            Event::End(e) if e.local_name().as_ref() == b"material" => break,
            Event::Eof => return Err(CoreError::Parse("unexpected EOF in <material>".into())),
            _ => {}
        }
        buf.clear();
    }

    Ok(Some(Material { name: mat_name, color, texture }))
}

/// Parse a `<geometry>...</geometry>` block, expecting exactly one shape child.
fn parse_geometry(reader: &mut Reader<&[u8]>) -> Result<Geometry, CoreError> {
    let mut buf = Vec::new();
    loop {
        match reader
            .read_event_into(&mut buf)
            .map_err(|e| CoreError::Parse(e.to_string()))?
        {
            Event::Empty(e) | Event::Start(e) if e.local_name().as_ref() == b"box" => {
                let size = get_attr(&e, "size")
                    .map(|s| parse_floats::<3>(&s, [0.0; 3]))
                    .unwrap_or([0.0; 3]);
                skip_to_end(reader, "geometry")?;
                return Ok(Geometry::Box { size });
            }
            Event::Empty(e) | Event::Start(e) if e.local_name().as_ref() == b"cylinder" => {
                let radius = get_attr(&e, "radius").and_then(|s| s.parse().ok()).unwrap_or(0.0);
                let length = get_attr(&e, "length").and_then(|s| s.parse().ok()).unwrap_or(0.0);
                skip_to_end(reader, "geometry")?;
                return Ok(Geometry::Cylinder { radius, length });
            }
            Event::Empty(e) | Event::Start(e) if e.local_name().as_ref() == b"sphere" => {
                let radius = get_attr(&e, "radius").and_then(|s| s.parse().ok()).unwrap_or(0.0);
                skip_to_end(reader, "geometry")?;
                return Ok(Geometry::Sphere { radius });
            }
            Event::Empty(e) | Event::Start(e) if e.local_name().as_ref() == b"mesh" => {
                let filename = get_attr(&e, "filename").unwrap_or_default();
                let scale = get_attr(&e, "scale")
                    .map(|s| parse_floats::<3>(&s, [1.0, 1.0, 1.0]))
                    .unwrap_or([1.0, 1.0, 1.0]);
                skip_to_end(reader, "geometry")?;
                return Ok(Geometry::Mesh { filename, scale });
            }
            Event::End(e) if e.local_name().as_ref() == b"geometry" => {
                return Err(CoreError::Parse("empty <geometry> element".into()));
            }
            Event::Eof => return Err(CoreError::Parse("unexpected EOF in <geometry>".into())),
            _ => {}
        }
        buf.clear();
    }
}

/// Consume events until (and including) the `</tag>` close, allowing nested
/// elements (e.g. `<box/>` already self-closed inside `<geometry>`).
fn skip_to_end(reader: &mut Reader<&[u8]>, tag: &str) -> Result<(), CoreError> {
    let mut buf = Vec::new();
    let target = tag.as_bytes();
    loop {
        match reader
            .read_event_into(&mut buf)
            .map_err(|e| CoreError::Parse(e.to_string()))?
        {
            Event::End(e) if e.local_name().as_ref() == target => return Ok(()),
            Event::Eof => return Err(CoreError::Parse(format!("unexpected EOF, expected </{tag}>"))),
            _ => {}
        }
        buf.clear();
    }
}

/// Parse a `<link>...</link>` block.
fn parse_link(
    reader: &mut Reader<&[u8]>,
    start: &BytesStart,
    materials: &mut Vec<Material>,
) -> Result<Link, CoreError> {
    let name = get_attr(start, "name").unwrap_or_default();
    let mut visual = None;
    let mut collision = None;
    let mut inertial = None;

    let mut buf = Vec::new();
    loop {
        match reader
            .read_event_into(&mut buf)
            .map_err(|e| CoreError::Parse(e.to_string()))?
        {
            Event::Start(e) if e.local_name().as_ref() == b"visual" => {
                visual = Some(parse_visual(reader, materials)?);
            }
            Event::Start(e) if e.local_name().as_ref() == b"collision" => {
                collision = Some(parse_collision(reader)?);
            }
            Event::Start(e) if e.local_name().as_ref() == b"inertial" => {
                inertial = Some(parse_inertial(reader)?);
            }
            Event::End(e) if e.local_name().as_ref() == b"link" => break,
            Event::Eof => return Err(CoreError::Parse("unexpected EOF in <link>".into())),
            _ => {}
        }
        buf.clear();
    }

    Ok(Link { name, visual, collision, inertial })
}

/// Parse a `<visual>...</visual>` block.
fn parse_visual(reader: &mut Reader<&[u8]>, materials: &mut Vec<Material>) -> Result<Visual, CoreError> {
    let mut origin = Pose::default();
    let mut geometry = None;
    let mut material_name = None;

    let mut buf = Vec::new();
    loop {
        match reader
            .read_event_into(&mut buf)
            .map_err(|e| CoreError::Parse(e.to_string()))?
        {
            Event::Empty(e) if e.local_name().as_ref() == b"origin" => {
                origin = parse_origin(&e);
            }
            Event::Start(e) if e.local_name().as_ref() == b"geometry" => {
                geometry = Some(parse_geometry(reader)?);
            }
            Event::Start(e) if e.local_name().as_ref() == b"material" => {
                let mat_name = get_attr(&e, "name").unwrap_or_default();
                if let Some(m) = parse_material(reader, &e)? {
                    upsert_material(materials, m);
                }
                material_name = Some(mat_name);
            }
            Event::Empty(e) if e.local_name().as_ref() == b"material" => {
                material_name = get_attr(&e, "name");
            }
            Event::End(e) if e.local_name().as_ref() == b"visual" => break,
            Event::Eof => return Err(CoreError::Parse("unexpected EOF in <visual>".into())),
            _ => {}
        }
        buf.clear();
    }

    Ok(Visual {
        origin,
        geometry: geometry.ok_or_else(|| CoreError::Parse("<visual> missing <geometry>".into()))?,
        material_name,
    })
}

/// Parse a `<collision>...</collision>` block.
fn parse_collision(reader: &mut Reader<&[u8]>) -> Result<Collision, CoreError> {
    let mut origin = Pose::default();
    let mut geometry = None;

    let mut buf = Vec::new();
    loop {
        match reader
            .read_event_into(&mut buf)
            .map_err(|e| CoreError::Parse(e.to_string()))?
        {
            Event::Empty(e) if e.local_name().as_ref() == b"origin" => {
                origin = parse_origin(&e);
            }
            Event::Start(e) if e.local_name().as_ref() == b"geometry" => {
                geometry = Some(parse_geometry(reader)?);
            }
            Event::End(e) if e.local_name().as_ref() == b"collision" => break,
            Event::Eof => return Err(CoreError::Parse("unexpected EOF in <collision>".into())),
            _ => {}
        }
        buf.clear();
    }

    Ok(Collision {
        origin,
        geometry: geometry.ok_or_else(|| CoreError::Parse("<collision> missing <geometry>".into()))?,
    })
}

/// Parse an `<inertial>...</inertial>` block.
fn parse_inertial(reader: &mut Reader<&[u8]>) -> Result<Inertial, CoreError> {
    let mut origin = Pose::default();
    let mut mass = 0.0;
    let mut inertia = InertiaTensor { ixx: 0.0, ixy: 0.0, ixz: 0.0, iyy: 0.0, iyz: 0.0, izz: 0.0 };

    let mut buf = Vec::new();
    loop {
        match reader
            .read_event_into(&mut buf)
            .map_err(|e| CoreError::Parse(e.to_string()))?
        {
            Event::Empty(e) if e.local_name().as_ref() == b"origin" => {
                origin = parse_origin(&e);
            }
            Event::Empty(e) if e.local_name().as_ref() == b"mass" => {
                mass = get_attr(&e, "value").and_then(|s| s.parse().ok()).unwrap_or(0.0);
            }
            Event::Empty(e) if e.local_name().as_ref() == b"inertia" => {
                inertia = InertiaTensor {
                    ixx: get_attr(&e, "ixx").and_then(|s| s.parse().ok()).unwrap_or(0.0),
                    ixy: get_attr(&e, "ixy").and_then(|s| s.parse().ok()).unwrap_or(0.0),
                    ixz: get_attr(&e, "ixz").and_then(|s| s.parse().ok()).unwrap_or(0.0),
                    iyy: get_attr(&e, "iyy").and_then(|s| s.parse().ok()).unwrap_or(0.0),
                    iyz: get_attr(&e, "iyz").and_then(|s| s.parse().ok()).unwrap_or(0.0),
                    izz: get_attr(&e, "izz").and_then(|s| s.parse().ok()).unwrap_or(0.0),
                };
            }
            Event::End(e) if e.local_name().as_ref() == b"inertial" => break,
            Event::Eof => return Err(CoreError::Parse("unexpected EOF in <inertial>".into())),
            _ => {}
        }
        buf.clear();
    }

    Ok(Inertial { origin, mass, inertia })
}

/// Parse a `<joint type="..." ...>...</joint>` block.
fn parse_joint(reader: &mut Reader<&[u8]>, start: &BytesStart) -> Result<Joint, CoreError> {
    let name = get_attr(start, "name").unwrap_or_default();
    let joint_type = match get_attr(start, "type").unwrap_or_default().as_str() {
        "revolute" => JointType::Revolute,
        "continuous" => JointType::Continuous,
        "prismatic" => JointType::Prismatic,
        "planar" => JointType::Planar,
        "floating" => JointType::Floating,
        _ => JointType::Fixed,
    };

    let mut parent = String::new();
    let mut child = String::new();
    let mut origin = Pose::default();
    let mut axis = None;
    let mut limit = None;

    let mut buf = Vec::new();
    loop {
        match reader
            .read_event_into(&mut buf)
            .map_err(|e| CoreError::Parse(e.to_string()))?
        {
            Event::Empty(e) if e.local_name().as_ref() == b"parent" => {
                parent = get_attr(&e, "link").unwrap_or_default();
            }
            Event::Empty(e) if e.local_name().as_ref() == b"child" => {
                child = get_attr(&e, "link").unwrap_or_default();
            }
            Event::Empty(e) if e.local_name().as_ref() == b"origin" => {
                origin = parse_origin(&e);
            }
            Event::Empty(e) if e.local_name().as_ref() == b"axis" => {
                axis = get_attr(&e, "xyz").map(|s| parse_floats::<3>(&s, [0.0; 3]));
            }
            Event::Empty(e) if e.local_name().as_ref() == b"limit" => {
                limit = Some(JointLimit {
                    lower: get_attr(&e, "lower").and_then(|s| s.parse().ok()).unwrap_or(0.0),
                    upper: get_attr(&e, "upper").and_then(|s| s.parse().ok()).unwrap_or(0.0),
                    effort: get_attr(&e, "effort").and_then(|s| s.parse().ok()).unwrap_or(0.0),
                    velocity: get_attr(&e, "velocity").and_then(|s| s.parse().ok()).unwrap_or(0.0),
                });
            }
            Event::End(e) if e.local_name().as_ref() == b"joint" => break,
            Event::Eof => return Err(CoreError::Parse("unexpected EOF in <joint>".into())),
            _ => {}
        }
        buf.clear();
    }

    Ok(Joint { name, joint_type, parent, child, origin, axis, limit })
}
