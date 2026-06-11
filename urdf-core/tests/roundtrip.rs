use urdf_core::{parse_urdf, serialize_urdf, Geometry, JointType};

const FIXTURE: &str = include_str!("fixtures/basic.urdf");

#[test]
fn parses_basic_fixture() {
    let robot = parse_urdf(FIXTURE).expect("should parse");

    assert_eq!(robot.name, "test_robot");
    assert_eq!(robot.links.len(), 3);
    assert_eq!(robot.joints.len(), 2);
    assert_eq!(robot.materials.len(), 1);

    let base = robot.links.iter().find(|l| l.name == "base_link").unwrap();
    let visual = base.visual.as_ref().unwrap();
    assert_eq!(visual.origin.xyz, [0.0, 0.0, 0.1]);
    assert_eq!(visual.material_name.as_deref(), Some("blue"));
    match &visual.geometry {
        Geometry::Box { size } => assert_eq!(*size, [0.2, 0.3, 0.1]),
        other => panic!("expected box, got {other:?}"),
    }
    assert!(base.collision.is_some());
    let inertial = base.inertial.as_ref().unwrap();
    assert_eq!(inertial.mass, 1.5);
    assert_eq!(inertial.inertia.ixx, 0.01);
    assert_eq!(inertial.inertia.iyy, 0.02);
    assert_eq!(inertial.inertia.izz, 0.03);

    let wheel = robot.links.iter().find(|l| l.name == "wheel_link").unwrap();
    match &wheel.visual.as_ref().unwrap().geometry {
        Geometry::Cylinder { radius, length } => {
            assert_eq!(*radius, 0.05);
            assert_eq!(*length, 0.02);
        }
        other => panic!("expected cylinder, got {other:?}"),
    }

    let sensor = robot.links.iter().find(|l| l.name == "sensor_link").unwrap();
    assert!(sensor.collision.is_none());
    assert!(sensor.inertial.is_none());
    match &sensor.visual.as_ref().unwrap().geometry {
        Geometry::Sphere { radius } => assert_eq!(*radius, 0.03),
        other => panic!("expected sphere, got {other:?}"),
    }

    let wheel_joint = robot.joints.iter().find(|j| j.name == "wheel_joint").unwrap();
    assert_eq!(wheel_joint.joint_type, JointType::Revolute);
    assert_eq!(wheel_joint.parent, "base_link");
    assert_eq!(wheel_joint.child, "wheel_link");
    assert_eq!(wheel_joint.axis, Some([0.0, 1.0, 0.0]));
    let limit = wheel_joint.limit.as_ref().unwrap();
    assert_eq!(limit.lower, -1.57);
    assert_eq!(limit.upper, 1.57);
    assert_eq!(limit.effort, 10.0);
    assert_eq!(limit.velocity, 2.0);

    let sensor_joint = robot.joints.iter().find(|j| j.name == "sensor_joint").unwrap();
    assert_eq!(sensor_joint.joint_type, JointType::Fixed);
    assert!(sensor_joint.axis.is_none());
    assert!(sensor_joint.limit.is_none());

    let blue = robot.materials.iter().find(|m| m.name == "blue").unwrap();
    assert_eq!(blue.color, Some([0.0, 0.0, 1.0, 1.0]));
}

#[test]
fn roundtrip_parse_serialize_parse_equal() {
    let robot = parse_urdf(FIXTURE).expect("should parse");
    let xml = serialize_urdf(&robot).expect("should serialize");
    let robot2 = parse_urdf(&xml).expect("should reparse");
    assert_eq!(robot, robot2);
}

#[test]
fn serialization_is_deterministic() {
    let robot = parse_urdf(FIXTURE).expect("should parse");
    let xml1 = serialize_urdf(&robot).expect("should serialize");
    let xml2 = serialize_urdf(&robot).expect("should serialize");
    assert_eq!(xml1, xml2);
}

#[test]
fn parses_minimal_link_no_optional_elements() {
    let xml = r#"<?xml version="1.0"?>
<robot name="minimal">
  <link name="only_link"/>
</robot>"#;
    let robot = parse_urdf(xml).expect("should parse");
    assert_eq!(robot.links.len(), 1);
    let link = &robot.links[0];
    assert_eq!(link.name, "only_link");
    assert!(link.visual.is_none());
    assert!(link.collision.is_none());
    assert!(link.inertial.is_none());
}

#[test]
fn parses_mesh_geometry_with_default_scale() {
    let xml = r#"<?xml version="1.0"?>
<robot name="mesh_robot">
  <link name="base_link">
    <visual>
      <geometry>
        <mesh filename="package://my_pkg/meshes/base.stl"/>
      </geometry>
    </visual>
  </link>
</robot>"#;
    let robot = parse_urdf(xml).expect("should parse");
    let visual = robot.links[0].visual.as_ref().unwrap();
    match &visual.geometry {
        Geometry::Mesh { filename, scale } => {
            assert_eq!(filename, "package://my_pkg/meshes/base.stl");
            assert_eq!(*scale, [1.0, 1.0, 1.0]);
        }
        other => panic!("expected mesh, got {other:?}"),
    }
    // origin defaults to zero pose when absent
    assert!(visual.origin.is_zero());
}

#[test]
fn parses_mesh_geometry_with_explicit_scale() {
    let xml = r#"<?xml version="1.0"?>
<robot name="mesh_robot">
  <link name="base_link">
    <visual>
      <geometry>
        <mesh filename="meshes/base.dae" scale="2 2 2"/>
      </geometry>
    </visual>
  </link>
</robot>"#;
    let robot = parse_urdf(xml).expect("should parse");
    let visual = robot.links[0].visual.as_ref().unwrap();
    match &visual.geometry {
        Geometry::Mesh { filename, scale } => {
            assert_eq!(filename, "meshes/base.dae");
            assert_eq!(*scale, [2.0, 2.0, 2.0]);
        }
        other => panic!("expected mesh, got {other:?}"),
    }
}

#[test]
fn inline_material_with_color_is_hoisted_to_robot_materials() {
    let xml = r#"<?xml version="1.0"?>
<robot name="hoist_robot">
  <link name="base_link">
    <visual>
      <geometry>
        <box size="1 1 1"/>
      </geometry>
      <material name="custom_red">
        <color rgba="1 0 0 1"/>
      </material>
    </visual>
  </link>
</robot>"#;
    let robot = parse_urdf(xml).expect("should parse");
    let mat = robot.materials.iter().find(|m| m.name == "custom_red");
    assert!(mat.is_some(), "expected custom_red to be hoisted to robot materials");
    assert_eq!(mat.unwrap().color, Some([1.0, 0.0, 0.0, 1.0]));
    assert_eq!(
        robot.links[0].visual.as_ref().unwrap().material_name.as_deref(),
        Some("custom_red")
    );
}

#[test]
fn inline_material_reference_only_does_not_duplicate() {
    let xml = r#"<?xml version="1.0"?>
<robot name="ref_robot">
  <material name="green">
    <color rgba="0 1 0 1"/>
  </material>
  <link name="base_link">
    <visual>
      <geometry>
        <box size="1 1 1"/>
      </geometry>
      <material name="green"/>
    </visual>
  </link>
</robot>"#;
    let robot = parse_urdf(xml).expect("should parse");
    let count = robot.materials.iter().filter(|m| m.name == "green").count();
    assert_eq!(count, 1);
}
