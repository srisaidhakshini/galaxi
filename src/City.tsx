import React, {
  Component,
  Suspense,
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";
import { workerPose } from "./workerMotion";
import {
  level,
  terminal,
  type Project,
  type Task,
  type Worker,
} from "../shared/domain";
const LabelPortal = createContext<React.RefObject<HTMLDivElement> | undefined>(
  undefined,
);
function Label(props: React.ComponentProps<typeof Html>) {
  const portal = useContext(LabelPortal);
  return <Html {...props} portal={portal} zIndexRange={[10, 0]} />;
}
const palette = [
  "#f07869",
  "#55b7d2",
  "#f3b744",
  "#9b86e5",
  "#e780b7",
  "#579adb",
];
export const plotPosition = (plot: number): [number, number, number] => {
  const col = plot % 4,
    row = Math.floor(plot / 4);
  return [(col - 1.5) * 5.3, 0, (row - 0.5) * 5.7];
};
function Box({
  at,
  size,
  color,
  ...props
}: {
  at: [number, number, number];
  size: [number, number, number];
  color: string;
  [key: string]: any;
}) {
  return (
    <mesh position={at} castShadow receiveShadow {...props}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}
function Tree({
  x,
  z,
  scale = 1,
  color = "#67b995",
}: {
  x: number;
  z: number;
  scale?: number;
  color?: string;
}) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <Box at={[0, 0.5, 0]} size={[0.17, 1, 0.17]} color="#9c6d5e" />
      <mesh position={[0, 1.4, 0]} castShadow>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.2, 1.9, 0]} castShadow>
        <icosahedronGeometry args={[0.47, 0]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}
function Person({
  worker,
  index,
  onClick,
  motion,
}: {
  worker: Worker;
  index: number;
  onClick: () => void;
  motion: boolean;
}) {
  const root = useRef<THREE.Group>(null),
    body = useRef<THREE.Group>(null),
    head = useRef<THREE.Group>(null),
    leftHip = useRef<THREE.Group>(null),
    rightHip = useRef<THREE.Group>(null),
    leftKnee = useRef<THREE.Group>(null),
    rightKnee = useRef<THREE.Group>(null),
    leftArm = useRef<THREE.Group>(null),
    rightArm = useRef<THREE.Group>(null),
    forearm = useRef<THREE.Group>(null),
    brick = useRef<THREE.Group>(null),
    hammer = useRef<THREE.Group>(null),
    board = useRef<THREE.Group>(null),
    dust = useRef<THREE.Group>(null),
    screen = useRef<THREE.Group>(null);
  const age = useRef(index * 2.3),
    gait = useRef(index * 1.7),
    previousStatus = useRef(worker.status),
    action = useRef("resting"),
    badge = useRef<HTMLButtonElement>(null);
  const waiting =
    worker.status.includes("waiting") || worker.status === "blocked";
  const ended = [
    "completed",
    "failed",
    "interrupted",
    "queued",
    "idle",
  ].includes(worker.status);
  const skin = ["#e7b58b", "#b67857", "#e6c4a4"][index % 3],
    shirt = waiting
      ? "#efb644"
      : worker.status === "failed"
        ? "#dc6b7e"
        : worker.role === "Lead"
          ? "#9673d8"
          : "#468bd7";
  useFrame((_, dt) => {
    if (!root.current || !body.current) return;
    const delta = Math.min(dt, 0.05);
    if (previousStatus.current !== worker.status) {
      previousStatus.current = worker.status;
      age.current = index * 2.3;
    }
    if (motion) age.current += delta;
    const pose = workerPose(worker.status, age.current, index);
    const dx = pose.x - root.current.position.x,
      dz = pose.z - root.current.position.z,
      distance = Math.hypot(dx, dz);
    const walking = motion && distance > 0.035;
    if (
      motion &&
      distance > 0.1 &&
      ["pickup", "placing", "hammering", "terminal", "measuring"].includes(
        pose.action,
      )
    )
      age.current = Math.max(0, age.current - delta);
    const step = Math.min(distance, delta * (pose.carrying ? 0.72 : 0.9));
    if (motion && distance > 0.001) {
      root.current.position.x += (dx / distance) * step;
      root.current.position.z += (dz / distance) * step;
    }
    let heading = walking ? Math.atan2(dx, dz) : pose.heading;
    if (motion) {
      const turn = Math.atan2(
        Math.sin(heading - root.current.rotation.y),
        Math.cos(heading - root.current.rotation.y),
      );
      root.current.rotation.y += turn * (1 - Math.exp(-9 * delta));
    }
    if (walking) gait.current += step * 12;
    const t = age.current,
      phase = gait.current,
      stride = walking ? Math.sin(phase) * 0.62 : 0;
    const doing = motion && !walking,
      working = doing && pose.action === "hammering";
    const bend =
      doing && (pose.action === "pickup" || pose.action === "placing")
        ? Math.sin(pose.progress * Math.PI) * 0.65
        : 0;
    body.current.rotation.x = THREE.MathUtils.damp(
      body.current.rotation.x,
      bend,
      10,
      delta,
    );
    body.current.rotation.z = motion
      ? walking
        ? Math.sin(phase) * 0.045
        : Math.sin(t * 1.5 + index) * 0.012
      : 0;
    body.current.position.y =
      (walking
        ? Math.abs(Math.cos(phase)) * 0.035
        : motion
          ? Math.sin(t * 2) * 0.006
          : 0) -
      bend * 0.13;
    if (leftHip.current) leftHip.current.rotation.x = stride;
    if (rightHip.current) rightHip.current.rotation.x = -stride;
    if (leftKnee.current)
      leftKnee.current.rotation.x = walking
        ? Math.max(0, -Math.sin(phase)) * 0.8
        : bend * 0.6;
    if (rightKnee.current)
      rightKnee.current.rotation.x = walking
        ? Math.max(0, Math.sin(phase)) * 0.8
        : bend * 0.6;
    if (head.current) {
      head.current.rotation.y =
        motion && !working ? Math.sin(t * 0.75 + index) * 0.18 : 0;
      head.current.rotation.x = working ? 0.15 : bend * 0.25;
    }
    const carry = pose.carrying;
    if (leftArm.current) {
      const target = carry
        ? -1.05
        : doing && pose.action === "terminal"
          ? -0.85 + Math.sin(t * 12) * 0.05
          : doing && pose.action === "measuring"
            ? -0.8
            : walking
              ? -stride * 0.8
              : -0.1;
      leftArm.current.rotation.x = THREE.MathUtils.damp(
        leftArm.current.rotation.x,
        target,
        22,
        delta,
      );
    }
    if (rightArm.current) {
      const target = working
        ? -1.1 - Math.max(0, Math.sin(t * 10)) * 0.9
        : carry
          ? -1.05
          : doing && pose.action === "terminal"
            ? -0.85 - Math.sin(t * 12) * 0.05
            : doing && pose.action === "pickup"
              ? -bend * 1.1
              : walking
                ? stride * 0.8
                : -0.12;
      rightArm.current.rotation.x = THREE.MathUtils.damp(
        rightArm.current.rotation.x,
        target,
        22,
        delta,
      );
    }
    if (forearm.current) {
      const target = working
        ? -0.3 - Math.max(0, Math.sin(t * 10)) * 0.5
        : carry
          ? -0.55
          : 0;
      forearm.current.rotation.x = THREE.MathUtils.damp(
        forearm.current.rotation.x,
        target,
        22,
        delta,
      );
    }
    if (brick.current) brick.current.visible = carry;
    if (hammer.current) hammer.current.visible = working;
    if (board.current)
      board.current.visible =
        doing && ["inspecting", "measuring", "waiting"].includes(pose.action);
    if (screen.current)
      screen.current.visible = doing && pose.action === "terminal";
    if (dust.current) {
      dust.current.visible = working && Math.sin(t * 10) < -0.7;
      dust.current.rotation.y = t;
      dust.current.scale.setScalar(0.65 + Math.abs(Math.sin(t * 10)) * 0.5);
    }
    const activity = walking
      ? carry
        ? "Carrying materials"
        : "Walking"
      : pose.action;
    if (action.current !== activity) {
      action.current = activity;
      if (badge.current) badge.current.dataset.action = activity;
    }
  });
  const limb = (
    side: number,
    hip: React.RefObject<THREE.Group | null>,
    knee: React.RefObject<THREE.Group | null>,
  ) => (
    <group ref={hip} position={[side * 0.095, 0.37, 0]}>
      <Box at={[0, -0.1, 0]} size={[0.115, 0.21, 0.13]} color="#394c76" />
      <group ref={knee} position={[0, -0.2, 0]}>
        <Box at={[0, -0.09, 0]} size={[0.1, 0.19, 0.12]} color="#425881" />
        <Box at={[0, -0.18, 0.04]} size={[0.15, 0.09, 0.23]} color="#303c57" />
        <Box at={[0, -0.22, 0.04]} size={[0.15, 0.025, 0.23]} color="#bdc4d6" />
      </group>
    </group>
  );
  return (
    <group
      ref={root}
      position={[-1.5 + index * 0.4, 0.18, 1.55]}
      scale={1.3}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <group ref={body}>
        {limb(-1, leftHip, leftKnee)}
        {limb(1, rightHip, rightKnee)}
        <Box at={[0, 0.57, 0]} size={[0.32, 0.38, 0.22]} color={shirt} />
        <Box at={[0, 0.57, 0.119]} size={[0.21, 0.25, 0.02]} color="#edc35f" />
        {[-0.09, 0.09].map((x) => (
          <Box
            key={x}
            at={[x, 0.58, 0.135]}
            size={[0.035, 0.3, 0.02]}
            color="#fff3ae"
          />
        ))}
        <Box at={[0, 0.43, 0.13]} size={[0.33, 0.045, 0.035]} color="#626178" />
        <group ref={head} position={[0, 0.82, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.15, 8, 7]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          <Box
            at={[0, 0.03, 0.135]}
            size={[0.2, 0.045, 0.03]}
            color="#424e69"
          />
          {[-0.05, 0.05].map((x) => (
            <Box
              key={x}
              at={[x, 0.03, 0.154]}
              size={[0.07, 0.04, 0.018]}
              color="#b6dce9"
            />
          ))}
          <mesh position={[0, 0.13, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.21, 0.11, 8]} />
            <meshStandardMaterial
              color={worker.role === "Lead" ? "#eee9ff" : "#ffd04f"}
            />
          </mesh>
          <Box at={[0, 0.19, 0]} size={[0.045, 0.025, 0.27]} color="#fff1a0" />
        </group>
        <group ref={leftArm} position={[-0.22, 0.72, 0]}>
          <Box at={[0, -0.105, 0]} size={[0.12, 0.22, 0.14]} color={shirt} />
          <Box at={[0, -0.26, 0]} size={[0.095, 0.16, 0.1]} color={skin} />
          <Box
            at={[0, -0.35, 0.015]}
            size={[0.11, 0.09, 0.11]}
            color="#c69258"
          />
        </group>
        <group ref={rightArm} position={[0.22, 0.72, 0]}>
          <Box at={[0, -0.105, 0]} size={[0.12, 0.22, 0.14]} color={shirt} />
          <group ref={forearm} position={[0, -0.21, 0]}>
            <Box at={[0, -0.08, 0]} size={[0.095, 0.16, 0.1]} color={skin} />
            <Box
              at={[0, -0.17, 0.015]}
              size={[0.11, 0.09, 0.11]}
              color="#c69258"
            />
            <group ref={hammer} position={[0, -0.18, 0.07]} visible={false}>
              <Box
                at={[0, 0, 0.08]}
                size={[0.045, 0.045, 0.3]}
                color="#96704c"
              />
              <Box
                at={[0, 0, 0.23]}
                size={[0.23, 0.09, 0.09]}
                color="#758399"
              />
            </group>
          </group>
        </group>
        <group ref={brick} position={[0, 0.63, 0.37]} visible={false}>
          <Box at={[0, 0, 0]} size={[0.38, 0.18, 0.23]} color="#e88c68" />
          {[-0.1, 0.1].map((x) => (
            <Box
              key={x}
              at={[x, 0.095, 0]}
              size={[0.05, 0.01, 0.08]}
              color="#b66b56"
            />
          ))}
        </group>
        <group ref={board} position={[0, 0.56, 0.34]} visible={false}>
          <Box at={[0, 0, 0]} size={[0.34, 0.04, 0.3]} color="#79b7e2" />
          {[-0.06, 0, 0.06].map((z) => (
            <Box
              key={z}
              at={[0, 0.025, z]}
              size={[0.25, 0.008, 0.008]}
              color="#e1f1fc"
            />
          ))}
        </group>
        <group ref={screen} position={[0, 0.56, 0.34]} visible={false}>
          <Box at={[0, 0, 0]} size={[0.38, 0.035, 0.28]} color="#5e6d92" />
          <Box
            at={[0, 0.14, 0.11]}
            size={[0.38, 0.25, 0.025]}
            color="#344c75"
          />
          <Box
            at={[0, 0.14, 0.127]}
            size={[0.31, 0.18, 0.01]}
            color="#83dfc5"
          />
        </group>
      </group>
      <group ref={dust} position={[0.15, 0.8, 0.45]} visible={false}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            at={[(i - 1) * 0.14, i * 0.06, 0.05]}
            size={[0.04, 0.04, 0.04]}
            color="#f6ca86"
          />
        ))}
      </group>
      <Label position={[0, 1.28, 0]} center>
        <button
          ref={badge}
          className={`worker-state ${waiting ? "attention" : ""}`}
          data-state={worker.status}
          data-action="resting"
          aria-label={`${worker.id}: ${worker.status}`}
          title={`${worker.id}: ${worker.status} — ${worker.latest}`}
          onClick={onClick}
        >
          {waiting
            ? "!"
            : ended
              ? "✓"
              : worker.status === "editing"
                ? "⚒"
                : "↗"}
          <span className="worker-caption">
            {worker.id} · {worker.status}
          </span>
        </button>
      </Label>
    </group>
  );
}
function Fountain({ motion }: { motion: boolean }) {
  const water = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (water.current && motion)
      water.current.scale.y = 1 + Math.sin(clock.elapsedTime * 3) * 0.12;
  });
  return (
    <group position={[0, 0.08, 0]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[0.64, 0.72, 0.16, 12]} />
        <meshStandardMaterial color="#b5bfdc" />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.04, 16]} />
        <meshStandardMaterial color="#59c9ef" roughness={0.2} />
      </mesh>
      <mesh ref={water} position={[0, 0.38, 0]}>
        <coneGeometry args={[0.12, 0.48, 8]} />
        <meshStandardMaterial color="#94e8ff" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}
function Windmill({ motion }: { motion: boolean }) {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (blades.current && motion) blades.current.rotation.z += delta * 0.4;
  });
  return (
    <group position={[-11.5, 0, 5.8]}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.5, 2.4, 6]} />
        <meshStandardMaterial color="#d4dcf0" />
      </mesh>
      <group ref={blades} position={[0, 2.15, 0.3]}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
            <Box
              at={[0, 0.6, 0]}
              size={[0.2, 1.2, 0.07]}
              color={i % 2 ? "#f2929a" : "#f6e5c7"}
            />
          </group>
        ))}
      </group>
    </group>
  );
}
function Streetscape({ rows, motion }: { rows: number; motion: boolean }) {
  const depth = Math.max(21, rows * 5.7 + 9);
  return (
    <>
      <Box at={[0, -0.8, 2]} size={[29, 1.5, depth]} color="#8493c2" />
      <Box at={[0, -0.03, 2]} size={[29, 0.1, depth]} color="#a9c9c0" />
      <Box at={[12.15, 0.06, 2]} size={[2.7, 0.06, depth]} color="#52b5df" />
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          at={[11.4 + i * 0.6, 0.1, 2]}
          size={[0.035, 0.02, depth]}
          color="#8cd7ed"
        />
      ))}
      <Box at={[10.55, 0.12, 2]} size={[0.6, 0.12, depth]} color="#d9a582" />
      {Array.from({ length: rows + 1 }, (_, i) => i * 5.7 - 5.7).map((z) => (
        <group key={z}>
          <Box at={[-0.4, 0.045, z]} size={[22, 0.08, 1.2]} color="#74839e" />
          <Box
            at={[-0.4, 0.09, z - 0.68]}
            size={[22, 0.07, 0.18]}
            color="#d3d8ec"
          />
          <Box
            at={[-0.4, 0.09, z + 0.68]}
            size={[22, 0.07, 0.18]}
            color="#d3d8ec"
          />
          {[-9, -6, -3, 3, 6, 9].map((x) => (
            <Box
              key={x}
              at={[x, 0.095, z]}
              size={[0.65, 0.012, 0.035]}
              color="#ffe7a7"
            />
          ))}
          <Box at={[12, 0.17, z]} size={[3.5, 0.17, 1.05]} color="#e2b18b" />
        </group>
      ))}
      <Box at={[0, 0.06, 2]} size={[1, 0.08, depth]} color="#74839e" />
      <Fountain motion={motion} />
      {Array.from({ length: rows * 4 + 8 }, (_, i) => (
        <Tree
          key={i}
          x={i % 2 ? -11.5 : 9.8}
          z={-6 + Math.floor(i / 2) * 2}
          scale={0.65 + (i % 3) * 0.12}
          color={["#76bd9d", "#efa78c", "#a493d5", "#dfb763"][i % 4]}
        />
      ))}
      {[-8, -4, 3, 7].map((x, i) => (
        <group key={x}>
          <Tree
            x={x}
            z={8.4}
            color={["#ef9ead", "#8eacd9", "#e5bc66", "#74bca2"][i]}
          />
          <Box
            at={[x + 0.8, 0.32, 8.3]}
            size={[0.7, 0.18, 0.3]}
            color="#a77765"
          />
          <Box
            at={[x + 0.8, 0.2, 8.3]}
            size={[0.5, 0.25, 0.2]}
            color="#5d6c8c"
          />
        </group>
      ))}
      {[-8, 8].flatMap((x) =>
        [-5.7, 0, 5.7].map((z) => (
          <group key={`${x}-${z}`} position={[x, 0.12, z + 0.8]}>
            <Box at={[0, 0.7, 0]} size={[0.06, 1.4, 0.06]} color="#56627e" />
            <mesh position={[0, 1.45, 0]}>
              <sphereGeometry args={[0.13, 6, 6]} />
              <meshStandardMaterial
                color="#ffdc85"
                emissive="#ffbd53"
                emissiveIntensity={0.6}
              />
            </mesh>
          </group>
        )),
      )}
      <Windmill motion={motion} />
    </>
  );
}
function Building({
  project,
  task,
  selected,
  onSelect,
  onWorker,
  motion,
}: {
  project: Project;
  task?: Task;
  selected: boolean;
  onSelect: () => void;
  onWorker: (w: Worker) => void;
  motion: boolean;
}) {
  const [hover, setHover] = useState(false);
  const l = level(project.successes),
    color = palette[project.plot % palette.length],
    height = 0.85 + (l - 1) * 0.55;
  const busy = task && !terminal(task.status);
  return (
    <group position={plotPosition(project.plot)}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => {
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "auto";
        }}
      >
        <Box
          at={[0, 0.06, 0]}
          size={[4.25, 0.12, 4.35]}
          color={selected ? "#c9bdff" : hover ? "#e2d9ff" : "#dce3ee"}
        />
        <Box at={[0, 0.17, 0]} size={[3.25, 0.14, 2.7]} color="#bec5da" />
        <Box
          at={[0, height / 2 + 0.24, 0]}
          size={[2.5, height, 2]}
          color={color}
        />
        {l < 3 ? (
          <mesh
            position={[0, height + 0.6, 0]}
            rotation={[0, Math.PI / 4, 0]}
            castShadow
          >
            <coneGeometry args={[1.95, 0.9, 4]} />
            <meshStandardMaterial color="#465579" />
          </mesh>
        ) : (
          <Box
            at={[0, height + 0.32, 0]}
            size={[2.7, 0.16, 2.2]}
            color="#51618c"
          />
        )}
        {l >= 3 && (
          <Box
            at={[-0.75, height + 0.65, 0]}
            size={[0.75, 0.6, 1.4]}
            color="#ddd4ba"
          />
        )}
        {l >= 4 && (
          <Box
            at={[1.2, height * 0.5 + 0.2, -0.3]}
            size={[0.7, height * 0.85, 1.5]}
            color={color}
          />
        )}{" "}
        {l === 5 && (
          <>
            <Box
              at={[0, height + 1, 0]}
              size={[0.15, 1.4, 0.15]}
              color="#5c6a61"
            />
            <Box
              at={[0.3, height + 1.45, 0]}
              size={[0.6, 0.35, 0.05]}
              color="#ddb658"
            />
          </>
        )}
        <Box at={[0, 0.65, 1.015]} size={[0.45, 0.85, 0.04]} color="#415c59" />
        {Array.from({ length: l < 3 ? 1 : l }).map((_, floor) =>
          [-0.75, 0.75].map((x, i) => (
            <group key={`${floor}-${i}`}>
              <Box
                at={[x, 0.85 + floor * 0.43, 1.025]}
                size={[0.42, 0.34, 0.045]}
                color={busy ? "#ffe0a1" : "#a3dcf2"}
              />
              <Box
                at={[x, 0.85 + floor * 0.43, 1.06]}
                size={[0.035, 0.35, 0.035]}
                color="#e6d5b6"
              />
            </group>
          )),
        )}
        <Box
          at={[0.7, height + 0.6, -0.3]}
          size={[0.25, 0.9, 0.3]}
          color="#b5a48e"
        />
        {busy &&
          [-1.5, 1.5].map((x) => (
            <group key={x}>
              <Box
                at={[x, height / 2, 1.3]}
                size={[0.07, height + 0.6, 0.07]}
                color="#d7aa62"
              />
              <Box
                at={[x, height / 2, -1.3]}
                size={[0.07, height + 0.6, 0.07]}
                color="#d7aa62"
              />
              <Box
                at={[x, height * 0.7, 0]}
                size={[0.1, 0.08, 2.7]}
                color="#d7aa62"
              />
            </group>
          ))}
        <Label position={[0, height + 1.35, 0]} center>
          <button
            className={`plot-label ${selected ? "selected" : ""}`}
            onClick={onSelect}
          >
            {project.name}
            <span>
              LV {l} {busy ? " • WORKING" : ""}
            </span>
          </button>
        </Label>
      </group>
      {busy && (
        <group>
          <Box at={[-1.65, 0.3, 1.5]} size={[0.5, 0.4, 0.55]} color="#d58b68" />
          <Box
            at={[-1.65, 0.55, 1.5]}
            size={[0.4, 0.12, 0.4]}
            color="#f4b481"
          />
          <Box
            at={[1.55, 0.22, -1.5]}
            size={[0.5, 0.18, 0.65]}
            color="#91b9df"
          />
          {[0.4, 0.9, 1.4].map((y) => (
            <Box
              key={y}
              at={[1.6, y, 0]}
              size={[0.08, 0.06, 2.8]}
              color="#ffcc64"
            />
          ))}
        </group>
      )}
      {task?.workers
        .filter((w) => w.threadId)
        .map((w, i) => (
          <Person
            key={w.id}
            worker={w}
            index={i}
            onClick={() => onWorker(w)}
            motion={motion}
          />
        ))}
    </group>
  );
}
export type CameraCommand = {
  action: "left" | "right" | "in" | "out" | "top";
  id: number;
};
function Camera({
  focus,
  reset,
  command,
  pan,
}: {
  focus?: number;
  reset: number;
  command?: CameraCommand;
  pan: boolean;
}) {
  const controls = useRef<any>(null);
  const { camera } = useThree();
  useEffect(() => {
    const p = focus === undefined ? [0, 0, 1.5] : plotPosition(focus);
    controls.current?.target.set(p[0], 0, p[2]);
    const distance = focus === undefined ? 1 : 0.58;
    camera.position.set(
      p[0] + 17 * distance,
      19 * distance,
      p[2] + 22 * distance,
    );
    controls.current?.update();
  }, [focus, reset, camera]);
  useEffect(() => {
    if (!command || !controls.current) return;
    const c = controls.current,
      offset = camera.position.clone().sub(c.target),
      s = new THREE.Spherical().setFromVector3(offset);
    if (command.action === "left") s.theta -= Math.PI / 8;
    if (command.action === "right") s.theta += Math.PI / 8;
    if (command.action === "in") s.radius = Math.max(6, s.radius * 0.8);
    if (command.action === "out") s.radius = Math.min(60, s.radius * 1.25);
    if (command.action === "top") s.phi = 0.15;
    camera.position.copy(c.target).add(new THREE.Vector3().setFromSpherical(s));
    c.update();
  }, [command, camera]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      mouseButtons={{
        LEFT: pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: pan ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
      }}
      touches={{
        ONE: pan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      minPolarAngle={0.1}
      maxPolarAngle={1.25}
      minDistance={6}
      maxDistance={60}
      zoomSpeed={0.65}
      panSpeed={0.65}
      rotateSpeed={0.55}
      enableDamping
      dampingFactor={0.12}
      onChange={() => {
        if (controls.current) {
          controls.current.target.x = THREE.MathUtils.clamp(
            controls.current.target.x,
            -20,
            20,
          );
          controls.current.target.z = THREE.MathUtils.clamp(
            controls.current.target.z,
            -12,
            40,
          );
        }
      }}
    />
  );
}
class Boundary extends Component<
  { children: React.ReactNode; onFail: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        The 3D view is unavailable. Your projects and execution console are
        still accessible.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function City({
  projects,
  tasks,
  selected,
  onSelect,
  onWorker,
  motion,
  simple,
  reset,
  focus,
  onFail,
  cameraCommand,
  pan,
}: {
  projects: Project[];
  tasks: Task[];
  selected?: string;
  onSelect: (id: string) => void;
  onWorker: (w: Worker) => void;
  motion: boolean;
  simple: boolean;
  reset: number;
  focus?: number;
  onFail: () => void;
  cameraCommand?: CameraCommand;
  pan: boolean;
}) {
  const labels = useRef<HTMLDivElement>(null!);
  const simpleView = (
    <div className="simple-city">
      {projects.length ? (
        projects.map((p) => (
          <button
            key={p.id}
            className="simple-building"
            onClick={() => onSelect(p.id)}
          >
            <span style={{ color: palette[p.plot % palette.length] }}>▥</span>
            <strong>{p.name}</strong>
            <small>
              Level {level(p.successes)} · {p.successes} successful tasks
            </small>
          </button>
        ))
      ) : (
        <div className="simple-empty">Your first project starts here.</div>
      )}
    </div>
  );
  return (
    <>
      {simple && simpleView}
      <LabelPortal.Provider value={labels}>
        <div
          style={{
            display: simple ? "none" : "block",
            height: "100%",
            position: "relative",
          }}
        >
          <Boundary onFail={onFail}>
            <Suspense
              fallback={
                <div className="scene-fallback">Preparing your city…</div>
              }
            >
              <Canvas
                frameloop={simple ? "never" : "always"}
                shadows
                dpr={[1, 1.5]}
                camera={{ position: [17, 19, 22], fov: 40 }}
                gl={{ antialias: true }}
              >
                <color attach="background" args={["#dce7fa"]} />
                <fog attach="fog" args={["#dce7fa", 45, 100]} />
                <ambientLight intensity={0.7} />
                <hemisphereLight args={["#dceaff", "#bca1b7", 0.8]} />
                <directionalLight
                  position={[-10, 18, 8]}
                  intensity={1.9}
                  castShadow
                  shadow-mapSize={[2048, 2048]}
                  shadow-camera-left={-24}
                  shadow-camera-right={24}
                  shadow-camera-top={24}
                  shadow-camera-bottom={-24}
                />
                <group position={[0, -0.2, 0]}>
                  <Streetscape
                    rows={Math.max(2, Math.ceil(projects.length / 4))}
                    motion={motion}
                  />
                  {Array.from(
                    { length: Math.max(8, ...projects.map((p) => p.plot + 1)) },
                    (_, i) =>
                      projects[i] ? (
                        <Building
                          key={projects[i].id}
                          project={projects[i]}
                          task={tasks
                            .filter((t) => t.projectId === projects[i].id)
                            .at(-1)}
                          selected={selected === projects[i].id}
                          onSelect={() => onSelect(projects[i].id)}
                          onWorker={onWorker}
                          motion={motion}
                        />
                      ) : (
                        <group key={i} position={plotPosition(i)}>
                          <Box
                            at={[0, 0.09, 0]}
                            size={[4.25, 0.1, 4.35]}
                            color={
                              i % 3 === 0
                                ? "#c8d4ea"
                                : i % 3 === 1
                                  ? "#b8d5cc"
                                  : "#ddcce4"
                            }
                          />
                          {i === 0 && (
                            <>
                              <Box
                                at={[0, 0.2, 0]}
                                size={[1.8, 0.18, 1.5]}
                                color="#ded6bf"
                              />
                              <Box
                                at={[0, 0.8, 0]}
                                size={[0.08, 1.2, 0.08]}
                                color="#8d9176"
                              />
                              <Box
                                at={[0.35, 1.2, 0]}
                                size={[0.7, 0.38, 0.04]}
                                color="#d7a963"
                              />
                            </>
                          )}
                        </group>
                      ),
                  )}
                </group>
                <ContactShadows
                  position={[0, -0.09, 0]}
                  opacity={0.18}
                  scale={45}
                  blur={2.5}
                  far={12}
                  resolution={256}
                />
                <Camera
                  focus={focus}
                  reset={reset}
                  command={cameraCommand}
                  pan={pan}
                />
              </Canvas>
            </Suspense>
          </Boundary>
          <div className="city-labels" ref={labels} />
        </div>
      </LabelPortal.Provider>
    </>
  );
}
