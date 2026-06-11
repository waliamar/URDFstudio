// src/types/robot.ts
// TypeScript mirror of the canonical Rust data model (PRD §6.2, verbatim).

export interface Robot {
  name: string;
  links: Link[];
  joints: Joint[];
  materials: Material[];
}

export interface Link {
  name: string;
  visual?: Visual;
  collision?: Collision;
  inertial?: Inertial;
}

export interface Visual {
  origin: Pose;
  geometry: Geometry;
  materialName?: string;
}

export interface Collision {
  origin: Pose;
  geometry: Geometry;
}

export interface Inertial {
  origin: Pose;
  mass: number;
  inertia: InertiaTensor;
}

export type Geometry =
  | { type: "box"; size: [number, number, number] }
  | { type: "cylinder"; radius: number; length: number }
  | { type: "sphere"; radius: number }
  | { type: "mesh"; filename: string; scale: [number, number, number] };

export type JointType =
  | "fixed" | "revolute" | "continuous"
  | "prismatic" | "planar" | "floating";

export interface Joint {
  name: string;
  jointType: JointType;
  parent: string;
  child: string;
  origin: Pose;
  axis?: [number, number, number];
  limit?: JointLimit;
}

export interface JointLimit {
  lower: number;
  upper: number;
  effort: number;
  velocity: number;
}

export interface Pose {
  xyz: [number, number, number];
  rpy: [number, number, number];
}

export interface InertiaTensor {
  ixx: number; ixy: number; ixz: number;
  iyy: number; iyz: number; izz: number;
}

export interface Material {
  name: string;
  color?: [number, number, number, number];
  texture?: string;
}
