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
        <group
          key={joint.name}
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
        <NodeGroup key={node.link.name} node={node} />
      ))}
    </>
  );
}
