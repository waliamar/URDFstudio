// src/samples/sampleRobot.ts
// A small 4-link / 3-joint demo robot used in browser-dev (mock) mode.
// base (box) --revolute--> arm (cylinder) --fixed--> head (sphere)
//                       \--fixed--> sensor (box)
import type { Robot } from "../types/robot";

export const sampleRobot: Robot = {
  name: "sample_bot",
  materials: [
    { name: "blue", color: [0.2, 0.4, 0.9, 1] },
    { name: "orange", color: [0.95, 0.55, 0.15, 1] },
    { name: "gray", color: [0.6, 0.6, 0.6, 1] },
  ],
  links: [
    {
      name: "base_link",
      visual: {
        origin: { xyz: [0, 0, 0.05], rpy: [0, 0, 0] },
        geometry: { type: "box", size: [0.3, 0.3, 0.1] },
        materialName: "blue",
      },
      collision: {
        origin: { xyz: [0, 0, 0.05], rpy: [0, 0, 0] },
        geometry: { type: "box", size: [0.3, 0.3, 0.1] },
      },
      inertial: {
        origin: { xyz: [0, 0, 0.05], rpy: [0, 0, 0] },
        mass: 2.0,
        inertia: { ixx: 0.02, ixy: 0, ixz: 0, iyy: 0.02, iyz: 0, izz: 0.03 },
      },
    },
    {
      name: "arm_link",
      visual: {
        origin: { xyz: [0, 0, 0.2], rpy: [0, 0, 0] },
        geometry: { type: "cylinder", radius: 0.04, length: 0.4 },
        materialName: "orange",
      },
      inertial: {
        origin: { xyz: [0, 0, 0.2], rpy: [0, 0, 0] },
        mass: 0.8,
        inertia: { ixx: 0.01, ixy: 0, ixz: 0, iyy: 0.01, iyz: 0, izz: 0.001 },
      },
    },
    {
      name: "head_link",
      visual: {
        origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] },
        geometry: { type: "sphere", radius: 0.07 },
        materialName: "gray",
      },
      inertial: {
        origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] },
        mass: 0.3,
        inertia: { ixx: 0.001, ixy: 0, ixz: 0, iyy: 0.001, iyz: 0, izz: 0.001 },
      },
    },
    {
      name: "sensor_link",
      visual: {
        origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] },
        geometry: { type: "box", size: [0.05, 0.1, 0.05] },
        materialName: "gray",
      },
    },
  ],
  joints: [
    {
      name: "base_to_arm",
      jointType: "revolute",
      parent: "base_link",
      child: "arm_link",
      origin: { xyz: [0, 0, 0.1], rpy: [0, 0, 0] },
      axis: [0, 0, 1],
      limit: { lower: -1.57, upper: 1.57, effort: 10, velocity: 1 },
    },
    {
      name: "arm_to_head",
      jointType: "fixed",
      parent: "arm_link",
      child: "head_link",
      origin: { xyz: [0, 0, 0.4], rpy: [0, 0, 0] },
    },
    {
      name: "arm_to_sensor",
      jointType: "fixed",
      parent: "arm_link",
      child: "sensor_link",
      origin: { xyz: [0.06, 0, 0.2], rpy: [0, 0, 0] },
    },
  ],
};
