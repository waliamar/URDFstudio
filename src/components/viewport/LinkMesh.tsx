// src/components/viewport/LinkMesh.tsx
import { useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import type { Link, Geometry, Material } from "../../types/robot";
import { rpyToEuler } from "../../lib/transforms";
import { neutralizeColladaUpAxis } from "../../lib/collada";
import { useUiStore } from "../../state/uiStore";
import { useSelectionStore } from "../../state/selectionStore";
import { useRobotStore } from "../../state/robotStore";
import { useShallow } from "zustand/react/shallow";
import { readMeshFile, resolveMeshPath } from "../../api/commands";
import { dirname, isAbsolutePath } from "../../lib/paths";

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

/** A loaded mesh asset: either an STL geometry or a DAE scene object. */
type MeshAsset =
  | { kind: "geometry"; geometry: THREE.BufferGeometry }
  | { kind: "object"; object: THREE.Object3D };

/** Resolve `filename` to an absolute path (via the package index when needed). */
async function resolveAbsolute(filename: string, urdfDir: string): Promise<string> {
  if (isAbsolutePath(filename)) return filename;
  const resolved = await resolveMeshPath(filename, urdfDir);
  if (!resolved) throw new Error("could not resolve mesh path");
  return resolved;
}

/**
 * Async mesh loader supporting STL (-> BufferGeometry) and Collada/DAE
 * (-> Object3D scene). Returns a placeholder signal (`failed`) for unsupported
 * formats or load errors.
 */
function useMeshAsset(filename: string, scale: [number, number, number]) {
  const [asset, setAsset] = useState<MeshAsset | null>(null);
  const [failed, setFailed] = useState(false);
  const filePath = useRobotStore((s) => s.filePath);
  const urdfDir = filePath ? dirname(filePath) : "";

  useEffect(() => {
    let cancelled = false;
    setAsset(null);
    setFailed(false);

    (async () => {
      try {
        const lower = filename.toLowerCase();
        const path = await resolveAbsolute(filename, urdfDir);
        const bytes = await readMeshFile(path);

        if (lower.endsWith(".stl")) {
          const g = new STLLoader().parse(bytes.buffer as ArrayBuffer);
          g.scale(scale[0], scale[1], scale[2]);
          g.computeVertexNormals();
          if (!cancelled) setAsset({ kind: "geometry", geometry: g });
        } else if (lower.endsWith(".dae")) {
          const text = new TextDecoder().decode(bytes);
          // The base path lets the loader resolve any relative texture refs.
          const base = path.slice(0, path.lastIndexOf("/") + 1);
          const collada = new ColladaLoader().parse(text, base);
          const object = collada.scene;
          // ColladaLoader rotates Z_UP assets by -90deg about X to reach
          // three.js Y-up. URDF Studio already converts Z-up -> Y-up globally
          // (Viewport) and the DAE vertices live in the URDF link frame, so the
          // loader's extra rotation just misaligns each link's mesh -> drop it.
          neutralizeColladaUpAxis(object);
          object.scale.set(scale[0], scale[1], scale[2]);
          if (!cancelled) setAsset({ kind: "object", object });
        } else {
          throw new Error("unsupported mesh format");
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => { cancelled = true; };
  }, [filename, scale[0], scale[1], scale[2], urdfDir]);

  return { asset, failed };
}

/** Tint every mesh material under `object` to reflect selection state. */
function applySelectionEmissive(object: THREE.Object3D, selected: boolean) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if (std && "emissive" in std) {
        std.emissive = new THREE.Color(selected ? "#2266aa" : "#000000");
        std.emissiveIntensity = selected ? 0.6 : 0;
      }
    }
  });
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
  const { asset, failed } = useMeshAsset(geometry.filename, geometry.scale);

  // DAE scenes carry their own materials; reflect selection by tinting them.
  useEffect(() => {
    if (asset?.kind === "object") applySelectionEmissive(asset.object, selected);
  }, [asset, selected]);

  if (asset?.kind === "geometry") {
    return (
      <mesh geometry={asset.geometry}>
        <StdMaterial matProps={matProps} selected={selected} />
      </mesh>
    );
  }
  if (asset?.kind === "object") {
    return <primitive object={asset.object} />;
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
  const materials = useRobotStore(useShallow((s) => s.robot?.materials ?? []));
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
