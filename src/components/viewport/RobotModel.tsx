// src/components/viewport/RobotModel.tsx
import { useRobotStore } from "../../state/robotStore";
import { buildTree, type LinkNode } from "../../lib/kinematics";
import { rpyToEuler } from "../../lib/transforms";
import { LinkMesh } from "./LinkMesh";

function NodeGroup({ node }: { node: LinkNode }) {
  return (
    <group>
      <LinkMesh link={node.link} />
      {node.children.map(({ joint, node: childNode }) => (
        // This wrapper's LOCAL transform == joint.origin, so the transform
        // gizmo can read it straight back. Named for getObjectByName lookup.
        <group
          key={joint.name}
          name={`link:${childNode.link.name}`}
          position={joint.origin.xyz}
          rotation={rpyToEuler(joint.origin.rpy)}
        >
          <NodeGroup node={childNode} />
        </group>
      ))}
    </group>
  );
}

export function RobotModel() {
  const robot = useRobotStore((s) => s.robot);
  if (!robot) return null;
  const { roots } = buildTree(robot);
  return (
    <>
      {roots.map((node) => (
        <group key={node.link.name} name={`link:${node.link.name}`}>
          <NodeGroup node={node} />
        </group>
      ))}
    </>
  );
}
