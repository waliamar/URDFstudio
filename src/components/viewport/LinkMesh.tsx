// src/components/viewport/LinkMesh.tsx
import { useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { Link, Geometry, Material } from "../../types/robot";
import { rpyToEuler } from "../../lib/transforms";
import { useUiStore } from "../../state/uiStore";
import { useSelectionStore } from "../../state/selectionStore";
import { useRobotStore } from "../../state/robotStore";
import { readMeshFile, resolveMeshPath } from "../../api/commands";

const DEFAULT_COLOR = "#999999";

function materialColor(
  materials: Material[],
  name: string | undefined,
): { color: string; opacity: number } {
  const m = name ? materials.find((mm) => mm.name === name) : undefined;
  if (!m?.color) return { color: DEFAULT_COLOR, opacity: 1 };
  const [r, g, b, a] = m.color;
  return { color: new THREE.Color(r, g, b).getStyle(), opacity: a };
}

/** Renders the appropriate three.js geometry for a URDF geometry node. */
function GeometryMesh({ geometry }: { geometry: Geometry }) {
  switch (geometry.type) {
    case "box":
      return <boxGeometry args={geometry.size} />;
    case "sphere":
      return <sphereGeometry args={[geometry.radius, 24, 16]} />;
    case "cylinder":
      // URDF cylinders are along +Z; three's are along +Y -> rotate.
      return <cylinderGeometry args={[geometry.radius, geometry.radius, geometry.length, 24]} />;
    case "mesh":
      return null; // handled by MeshGeometry async path
  }
}

/** Async STL loader -> BufferGeometry; placeholder box on failure / DAE. */
function useMeshGeometry(filename: string, scale: [number, number, number]) {
  const [geom, setGeom] = useState<THREE.BufferGeometry | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setGeom(null);
    setFailed(false);

    (async () => {
      try {
        if (!filename.toLowerCase().endsWith(".stl")) {
          // DAE and others: placeholder for now (next-session work).
          throw new Error("unsupported mesh format");
        }
        let path = filename;
        if (filename.startsWith("package://")) {
          const resolved = await resolveMeshPath(filename, "");
          if (!resolved) throw new Error("could not resolve package:// path");
          path = resolved;
        }
        const bytes = await readMeshFile(path);
        const g = new STLLoader().parse(bytes.buffer as ArrayBuffer);
        g.scale(scale[0], scale[1], scale[2]);
        g.computeVertexNormals();
        if (!cancelled) setGeom(g);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => { cancelled = true; };
  }, [filename, scale[0], scale[1], scale[2]]);

  return { geom, failed };
}

function MeshNode({
  geometry,
  matProps,
  selected,
}: {
  geometry: Extract<Geometry, { type: "mesh" }>;
  matProps: { color: string; opacity: number };
  selected: boolean;
}) {
  const { geom, failed } = useMeshGeometry(geometry.filename, geometry.scale);
  if (geom) {
    return (
      <mesh geometry={geom}>
        <StdMaterial matProps={matProps} selected={selected} />
      </mesh>
    );
  }
  // Placeholder while loading or on failure.
  return (
    <mesh>
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshStandardMaterial
        color={failed ? "#cc6666" : matProps.color}
        wireframe={failed}
        flatShading
      />
    </mesh>
  );
}

function StdMaterial({
  matProps,
  selected,
}: {
  matProps: { color: string; opacity: number };
  selected: boolean;
}) {
  return (
    <meshStandardMaterial
      color={matProps.color}
      transparent={matProps.opacity < 1}
      opacity={matProps.opacity}
      emissive={selected ? "#2266aa" : "#000000"}
      emissiveIntensity={selected ? 0.6 : 0}
      roughness={0.7}
      metalness={0.1}
    />
  );
}

/** A geometry wrapped with the cylinder-axis fix where needed. */
function GeometryWithMaterial({
  geometry,
  matProps,
  selected,
}: {
  geometry: Geometry;
  matProps: { color: string; opacity: number };
  selected: boolean;
}) {
  if (geometry.type === "mesh") {
    return <MeshNode geometry={geometry} matProps={matProps} selected={selected} />;
  }
  // Cylinder: rotate the mesh so the cylinder runs along +Z (URDF convention).
  const content = (
    <mesh>
      <GeometryMesh geometry={geometry} />
      <StdMaterial matProps={matProps} selected={selected} />
    </mesh>
  );
  if (geometry.type === "cylinder") {
    return <group rotation={[Math.PI / 2, 0, 0]}>{content}</group>;
  }
  return content;
}

export function LinkMesh({ link }: { link: Link }) {
  const layers = useUiStore((s) => s.layers);
  const materials = useRobotStore((s) => s.robot?.materials ?? []);
  const selected = useSelectionStore((s) => s.selected);
  const select = useSelectionStore((s) => s.select);

  const isSelected = selected?.kind === "link" && selected.name === link.name;
  const visMat = useMemo(
    () => materialColor(materials, link.visual?.materialName),
    [materials, link.visual?.materialName],
  );

  const parts: ReactNode[] = [];

  if (layers.visual && link.visual) {
    parts.push(
      <group
        key="visual"
        position={link.visual.origin.xyz}
        rotation={rpyToEuler(link.visual.origin.rpy)}
        onClick={(e) => { e.stopPropagation(); select("link", link.name); }}
      >
        <GeometryWithMaterial geometry={link.visual.geometry} matProps={visMat} selected={isSelected} />
      </group>,
    );
  }

  if (layers.collision && link.collision) {
    parts.push(
      <group
        key="collision"
        position={link.collision.origin.xyz}
        rotation={rpyToEuler(link.collision.origin.rpy)}
      >
        <CollisionWire geometry={link.collision.geometry} />
      </group>,
    );
  }

  if (layers.inertial && link.inertial) {
    parts.push(
      <mesh key="inertial" position={link.inertial.origin.xyz}>
        <octahedronGeometry args={[0.03]} />
        <meshBasicMaterial color="#ffcc00" wireframe />
      </mesh>,
    );
  }

  return <>{parts}</>;
}

function CollisionWire({ geometry }: { geometry: Geometry }) {
  if (geometry.type === "mesh") {
    return (
      <mesh>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshBasicMaterial color="#33cc66" wireframe />
      </mesh>
    );
  }
  const content = (
    <mesh>
      <GeometryMesh geometry={geometry} />
      <meshBasicMaterial color="#33cc66" wireframe />
    </mesh>
  );
  if (geometry.type === "cylinder") {
    return <group rotation={[Math.PI / 2, 0, 0]}>{content}</group>;
  }
  return content;
}
