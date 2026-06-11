use urdf_core::{
    new_robot, validate, Geometry, InertiaTensor, Inertial, Joint, JointType, Link, Material,
    Pose, Robot, Visual,
};

#[test]
fn new_robot_has_one_link_and_no_issues() {
    let robot = new_robot("my_robot");
    assert_eq!(robot.name, "my_robot");
    assert_eq!(robot.links.len(), 1);
    assert_eq!(robot.links[0].name, "base_link");
    assert!(robot.joints.is_empty());
    assert!(validate(&robot).is_empty());
}

fn empty_robot() -> Robot {
    Robot { name: "r".to_string(), links: vec![], joints: vec![], materials: vec![] }
}

fn link(name: &str) -> Link {
    Link { name: name.to_string(), visual: None, collision: None, inertial: None }
}

fn fixed_joint(name: &str, parent: &str, child: &str) -> Joint {
    Joint {
        name: name.to_string(),
        joint_type: JointType::Fixed,
        parent: parent.to_string(),
        child: child.to_string(),
        origin: Pose::default(),
        axis: None,
        limit: None,
    }
}

fn has_code(issues: &[urdf_core::ValidationIssue], code: &str) -> bool {
    issues.iter().any(|i| i.code == code)
}

#[test]
fn detects_duplicate_link_names() {
    let mut robot = empty_robot();
    robot.links = vec![link("a"), link("a")];
    let issues = validate(&robot);
    assert!(has_code(&issues, "duplicate-name"));
}

#[test]
fn detects_duplicate_joint_names() {
    let mut robot = empty_robot();
    robot.links = vec![link("a"), link("b"), link("c")];
    robot.joints = vec![fixed_joint("j1", "a", "b"), fixed_joint("j1", "b", "c")];
    let issues = validate(&robot);
    assert!(has_code(&issues, "duplicate-name"));
}

#[test]
fn detects_missing_link_reference() {
    let mut robot = empty_robot();
    robot.links = vec![link("a")];
    robot.joints = vec![fixed_joint("j1", "a", "ghost")];
    let issues = validate(&robot);
    assert!(has_code(&issues, "missing-link-ref"));
}

#[test]
fn detects_multiple_roots() {
    let mut robot = empty_robot();
    // Two separate trees: a->b and c->d. Both 'a' and 'c' are roots.
    robot.links = vec![link("a"), link("b"), link("c"), link("d")];
    robot.joints = vec![fixed_joint("j1", "a", "b"), fixed_joint("j2", "c", "d")];
    let issues = validate(&robot);
    assert!(has_code(&issues, "multiple-roots"));
}

#[test]
fn single_root_is_not_flagged() {
    let mut robot = empty_robot();
    robot.links = vec![link("a"), link("b"), link("c")];
    robot.joints = vec![fixed_joint("j1", "a", "b"), fixed_joint("j2", "b", "c")];
    let issues = validate(&robot);
    assert!(!has_code(&issues, "multiple-roots"));
    assert!(!has_code(&issues, "disconnected-link"));
}

#[test]
fn detects_disconnected_link() {
    let mut robot = empty_robot();
    // 'a' -> 'b' connected, 'orphan' is isolated.
    robot.links = vec![link("a"), link("b"), link("orphan")];
    robot.joints = vec![fixed_joint("j1", "a", "b")];
    let issues = validate(&robot);
    assert!(has_code(&issues, "disconnected-link"));
}

#[test]
fn detects_kinematic_loop() {
    let mut robot = empty_robot();
    // 'c' has two parents: 'a' and 'b' -> loop.
    robot.links = vec![link("a"), link("b"), link("c")];
    robot.joints = vec![fixed_joint("j1", "a", "c"), fixed_joint("j2", "b", "c")];
    let issues = validate(&robot);
    assert!(has_code(&issues, "kinematic-loop"));
}

#[test]
fn detects_rootless_cycle() {
    let mut robot = empty_robot();
    // a -> b -> c -> a: every link is a child, no root link.
    robot.links = vec![link("a"), link("b"), link("c")];
    robot.joints = vec![
        fixed_joint("j1", "a", "b"),
        fixed_joint("j2", "b", "c"),
        fixed_joint("j3", "c", "a"),
    ];
    let issues = validate(&robot);
    assert!(has_code(&issues, "kinematic-loop"), "expected kinematic-loop, got: {issues:?}");
}

#[test]
fn detects_non_positive_mass() {
    let mut robot = empty_robot();
    let mut l = link("a");
    l.inertial = Some(Inertial {
        origin: Pose::default(),
        mass: 0.0,
        inertia: InertiaTensor { ixx: 1.0, ixy: 0.0, ixz: 0.0, iyy: 1.0, iyz: 0.0, izz: 1.0 },
    });
    robot.links = vec![l];
    let issues = validate(&robot);
    assert!(has_code(&issues, "invalid-mass"));
}

#[test]
fn detects_negative_mass() {
    let mut robot = empty_robot();
    let mut l = link("a");
    l.inertial = Some(Inertial {
        origin: Pose::default(),
        mass: -2.0,
        inertia: InertiaTensor { ixx: 1.0, ixy: 0.0, ixz: 0.0, iyy: 1.0, iyz: 0.0, izz: 1.0 },
    });
    robot.links = vec![l];
    let issues = validate(&robot);
    assert!(has_code(&issues, "invalid-mass"));
}

#[test]
fn detects_non_positive_definite_inertia() {
    let mut robot = empty_robot();
    let mut l = link("a");
    // ixx negative => fails Sylvester's first leading minor.
    l.inertial = Some(Inertial {
        origin: Pose::default(),
        mass: 1.0,
        inertia: InertiaTensor { ixx: -1.0, ixy: 0.0, ixz: 0.0, iyy: 1.0, iyz: 0.0, izz: 1.0 },
    });
    robot.links = vec![l];
    let issues = validate(&robot);
    assert!(has_code(&issues, "invalid-inertia"));
}

#[test]
fn valid_inertia_tensor_passes() {
    let mut robot = empty_robot();
    let mut l = link("a");
    l.inertial = Some(Inertial {
        origin: Pose::default(),
        mass: 1.0,
        inertia: InertiaTensor { ixx: 1.0, ixy: 0.0, ixz: 0.0, iyy: 1.0, iyz: 0.0, izz: 1.0 },
    });
    robot.links = vec![l];
    let issues = validate(&robot);
    assert!(!has_code(&issues, "invalid-inertia"));
    assert!(!has_code(&issues, "invalid-mass"));
}

#[test]
fn valid_robot_has_no_issues() {
    let mut robot = empty_robot();
    let mut a = link("base_link");
    a.visual = Some(Visual {
        origin: Pose::default(),
        geometry: Geometry::Box { size: [1.0, 1.0, 1.0] },
        material_name: None,
    });
    let b = link("arm_link");
    robot.links = vec![a, b];
    robot.joints = vec![fixed_joint("base_to_arm", "base_link", "arm_link")];
    robot.materials = vec![Material { name: "blue".to_string(), color: Some([0.0, 0.0, 1.0, 1.0]), texture: None }];
    let issues = validate(&robot);
    assert!(issues.is_empty(), "expected no issues, got: {issues:?}");
}
