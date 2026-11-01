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
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import {
  districtPosition,
  habitatPosition,
  districtDepth,
} from "./districtLayout";
import {
  HabitatDetails,
  VillageLandscape,
  siteColours,
  DomeFurnishings,
} from "./Scenery";
import {
  domeScale,
  habitatPromptCount,
  habitatFeatures,
} from "../shared/habitatGrowth";
import { workerPose } from "./workerMotion";
import {
  terminal,
  currentObservedChat,
  type Project,
  type Task,
  type Worker,
  type ObservedChat,
  type Habitat,
} from "../shared/domain";
const VillageExtent = createContext(0);
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
export const plotPosition = districtPosition;
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
function Person({
  worker,
  index,
  onClick,
  motion,
  onPlacement,
  placedBricks = 0,
  siteScale = 1,
}: {
  worker: Worker;
  index: number;
  onClick: () => void;
  motion: boolean;
  onPlacement?: () => void;
  placedBricks?: number;
  siteScale?: number;
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
    previousItem = useRef(worker.observedItemId),
    placedCycle = useRef(-1),
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
          : ["#438faf", "#e18b54", "#62a088", "#c47d95"][index % 4];
  useFrame((_, dt) => {
    if (!root.current || !body.current) return;
    const delta = Math.min(dt, 0.05);
    if (
      previousStatus.current !== worker.status ||
      previousItem.current !== worker.observedItemId
    ) {
      previousStatus.current = worker.status;
      previousItem.current = worker.observedItemId;
      placedCycle.current = -1;
      age.current = index * 2.3;
    }
    if (motion) age.current += delta;
    const pose = workerPose(worker.status, age.current, index);
    const dx = pose.x * siteScale - root.current.position.x,
      dz = pose.z * siteScale - root.current.position.z,
      distance = Math.hypot(dx, dz);
    const walking = motion && distance > 0.001;
    if (
      motion &&
      distance > 0.1 &&
      ["pickup", "placing", "hammering", "terminal", "measuring"].includes(
        pose.action,
      )
    )
      age.current = Math.max(0, age.current - delta);
    const step = Math.min(
      distance,
      delta * (pose.carrying ? 1.05 : pose.action === "strolling" ? 0.7 : 1.65),
    );
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
      stride = walking ? Math.sin(phase) * (pose.carrying ? 0.58 : 0.8) : 0;
    const doing = motion && !walking,
      working = doing && pose.action === "hammering";
    if (
      doing &&
      pose.action === "placing" &&
      pose.progress > 0.6 &&
      placedCycle.current !== Math.floor(age.current / 18)
    ) {
      placedCycle.current = Math.floor(age.current / 18);
      onPlacement?.();
    }
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
      position={[(-1.5 + index * 0.4) * siteScale, 0.18, 1.55 * siteScale]}
      scale={1.65}
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
          data-placed-bricks={placedBricks}
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

function MarsTerrain({ projects }: { projects: Project[] }) {
  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.08, 0]}
        receiveShadow
      >
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color="#ba9479" roughness={1} />
      </mesh>
      {Array.from({ length: Math.max(35, projects.length * 18) }, (_, i) => {
        const side = i % 2 ? -1 : 1,
          x = Math.floor(i / 18) * 80 + side * (18 + (i % 7) * 1.1),
          z = -22 + (i % 18) * 5.2;
        return (
          <mesh
            key={i}
            position={[x, 0.12, z]}
            rotation={[i, 0.6 * i, 0.2]}
            scale={[0.6 + (i % 3) * 0.2, 0.3 + (i % 4) * 0.12, 0.5]}
            castShadow
          >
            <icosahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial
              color={["#b78366", "#d7ad88", "#b39783"][i % 3]}
              roughness={1}
            />
          </mesh>
        );
      })}
    </>
  );
}
function hasVillageSite(h: Habitat) {
  return h.members.length > 0 || (h.constructionStage ?? 5) > 0;
}
function HabitatDome({
  current,
  habitat,
  workers,
  ownedTasks,
  selected,
  onSelect,
  onWorker,
  motion,
}: {
  current: boolean;
  habitat: Habitat;
  workers: Worker[];
  ownedTasks: Task[];
  selected: boolean;
  onSelect: () => void;
  onWorker: (w: Worker) => void;
  motion: boolean;
}) {
  const promptCount = habitatPromptCount(habitat);
  const size = domeScale(promptCount);
  const initialSize = useRef(size);
  const structure = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (structure.current) {
      const next = motion
        ? THREE.MathUtils.damp(
            structure.current.scale.x,
            size,
            4,
            Math.min(dt, 0.1),
          )
        : size;
      structure.current.scale.setScalar(next);
    }
  });
  const [hovered, setHovered] = useState(false);
  const [bricks, setBricks] = useState<Record<string, number>>({});
  const [stage, setStage] = useState(habitat.constructionStage ?? 5);
  const targetStage = habitat.constructionStage ?? 5;
  useEffect(() => {
    if (stage >= targetStage) return;
    const timer = setTimeout(
      () => setStage((n) => Math.min(targetStage, n + 1)),
      1700,
    );
    return () => clearTimeout(timer);
  }, [stage, targetStage]);
  const features = habitatFeatures(promptCount, stage);
  const siteColour = siteColours[habitat.plot % siteColours.length];
  const editing = workers.some((w) => w.status === "editing"),
    busy =
      workers.some((w) =>
        [
          "editing",
          "checking",
          "running commands",
          "inspecting",
          "planning",
        ].includes(w.status),
      ) || ownedTasks.some((t) => !terminal(t.status));
  const waiting = workers.some(
    (w) => w.status.includes("waiting") || w.status === "blocked",
  );
  const failed = ownedTasks.at(-1)?.status === "failed";
  const accent = failed
    ? "#d78572"
    : waiting
      ? "#e9bd77"
      : busy
        ? "#9ecdc6"
        : "#b4c6c8";
  return (
    <group position={habitatPosition(habitat.plot)}>
      <group ref={structure} scale={initialSize.current}>
        {current && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
            <ringGeometry args={[2.58, 2.72, 48]} />
            <meshBasicMaterial color="#f3c761" transparent opacity={0.8} />
          </mesh>
        )}
        <HabitatDetails
          stage={features.stage}
          colour={siteColour}
          busy={busy}
        />
        <group
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = "auto";
          }}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
            <circleGeometry args={[2.65, 32]} />
            <meshStandardMaterial color="#ba9779" />
          </mesh>
          {features.foundation && (
            <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[2.35, 2.45, 0.18, 16]} />
              <meshStandardMaterial color="#b9b9ad" />
            </mesh>
          )}
          {Array.from({ length: features.glassPanels }, (_, i) => (
            <mesh key={"glass-" + i} position={[0, 0.21, 0]}>
              <sphereGeometry
                args={[
                  2.08,
                  4,
                  8,
                  (i * Math.PI) / 4,
                  Math.PI / 4 - 0.025,
                  0,
                  Math.PI / 2,
                ]}
              />
              <meshStandardMaterial
                color={siteColour}
                transparent
                opacity={selected || editing ? 0.1 : 0.2}
                roughness={0.15}
                metalness={0.15}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          ))}
          {features.frame && (
            <mesh position={[0, 0.22, 0]}>
              <sphereGeometry
                args={[2.1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              <meshStandardMaterial
                color="#e8e6db"
                wireframe
                roughness={0.65}
              />
            </mesh>
          )}
          <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.12, 0.055, 6, 36]} />
            <meshStandardMaterial
              color={current ? "#f2c65e" : siteColour}
              emissive={current ? "#efb935" : "#000000"}
              emissiveIntensity={current ? 0.7 : 0}
            />
          </mesh>
          {features.door && (
            <>
              <Box
                at={[0, 0.62, 1.98]}
                size={[0.86, 1.1, 0.38]}
                color="#e6e1ca"
              />
              <Box
                at={[0, 0.58, 2.19]}
                size={[0.62, 0.88, 0.06]}
                color="#7d8d91"
              />
              <Box
                at={[0, 1.04, 2.23]}
                size={[0.4, 0.055, 0.03]}
                color={accent}
              />
            </>
          )}
          <DomeFurnishings features={features} colour={siteColour} />
          {busy && stage >= 1 && stage < 5 && (
            <>
              <Box
                at={[2.25, 1.1, 0]}
                size={[0.055, 2.1, 0.055]}
                color="#e7be7c"
              />
              <Box
                at={[2.25, 1.1, 1.2]}
                size={[0.055, 2.1, 0.055]}
                color="#e7be7c"
              />
              {[0.5, 1, 1.5, 2].map((y) => (
                <Box
                  key={y}
                  at={[2.25, y, 0.6]}
                  size={[0.08, 0.05, 1.3]}
                  color="#e7be7c"
                />
              ))}
            </>
          )}
          <Label position={[0, 3.0, 0]} center>
            <button
              className={"habitat-label " + (selected ? "selected" : "")}
              aria-pressed={selected}
              data-active={busy}
              data-stage={stage}
              data-hovered={hovered}
              data-current={current}
              data-prompt-count={promptCount}
              data-dome-scale={size.toFixed(3)}
              data-building-stage={features.stage}
              data-glass-panels={features.glassPanels}
              data-features={Object.entries(features)
                .filter(
                  ([k, v]) =>
                    k !== "stage" && k !== "glassPanels" && v === true,
                )
                .map(([k]) => k)
                .join(",")}
              onClick={onSelect}
              title={habitat.members.map((m) => m.prompt).join(" · ")}
            >
              <strong>{habitat.name}</strong>
            </button>
          </Label>
        </group>
        <group position={[-3.15, 0, 2.15]}>
          <Box at={[0, 0.2, 0]} size={[0.85, 0.18, 0.85]} color="#8f7762" />
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              at={[(i % 2) * 0.25 - 0.15, 0.4 + Math.floor(i / 2) * 0.16, 0]}
              size={[0.4, 0.15, 0.3]}
              color="#d7aa83"
            />
          ))}
        </group>
        {Object.entries(bricks).map(([id, count], wi) => (
          <group key={id} position={[1.1 - wi * 0.35, 0.2, 1.15]}>
            {Array.from({ length: Math.min(count, 12) }, (_, i) => (
              <Box
                key={i}
                at={[(i % 3) * 0.23, Math.floor(i / 3) * 0.15, 0]}
                size={[0.22, 0.14, 0.18]}
                color={i % 2 ? "#cd9874" : "#dfad83"}
              />
            ))}
          </group>
        ))}
      </group>
      {workers.map((w, i) => (
        <Person
          key={w.threadId || w.id}
          worker={w}
          siteScale={size}
          index={i}
          onClick={() => onWorker(w)}
          motion={motion}
          onPlacement={() =>
            setBricks((prev) => ({ ...prev, [w.id]: (prev[w.id] || 0) + 1 }))
          }
          placedBricks={bricks[w.id] || 0}
        />
      ))}
    </group>
  );
}

function ProjectDistrict({
  project,
  habitats,
  tasks,
  observed,
  selected,
  selectedHabitat,
  onSelect,
  onSelectHabitat,
  onWorker,
  motion,
}: {
  project: Project;
  habitats: Habitat[];
  tasks: Task[];
  observed: ObservedChat[];
  selected: boolean;
  selectedHabitat?: string;
  onSelect: () => void;
  onSelectHabitat: (id: string) => void;
  onWorker: (w: Worker) => void;
  motion: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const watched = currentObservedChat(observed.filter((c) => c.habitatId));
  const running = tasks.filter((t) => !terminal(t.status)).at(-1);
  const currentHabitat = running?.habitatId || watched?.habitatId;
  const villageExtent = useContext(VillageExtent);
  const maxPlot = Math.max(0, ...habitats.map((h) => h.plot)),
    depth = districtDepth(maxPlot);
  return (
    <group position={districtPosition(project.plot, villageExtent)}>
      <group
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.035, 0]}
          receiveShadow
        >
          <circleGeometry args={[depth / 2, 80]} />
          <meshStandardMaterial color={selected ? "#b3b98d" : "#aeb38a"} />
        </mesh>
        <VillageLandscape
          radius={depth / 2}
          motion={motion}
          sites={habitats
            .filter(hasVillageSite)
            .map((h) => habitatPosition(h.plot))}
        />
        {habitats.filter(hasVillageSite).map((h) => {
          const [x, , z] = habitatPosition(h.plot),
            length = Math.hypot(x, z);
          return (
            <group key={h.id} rotation={[0, Math.atan2(x, z), 0]}>
              <Box
                at={[0, 0.006, length / 2]}
                size={[0.8, 0.025, length - 3]}
                color="#dfc8a2"
                castShadow={false}
              />
            </group>
          );
        })}
        <Label position={[0, 3.7, 0]} center>
          <button
            className={
              "plot-label district-label " + (selected ? "selected" : "")
            }
            onClick={onSelect}
            data-hovered={hovered}
          >
            <strong>{project.name}</strong>
          </button>
        </Label>
      </group>
      {habitats.filter(hasVillageSite).map((h) => {
        const own = tasks.filter((t) => t.habitatId === h.id);
        const seen = new Set<string>();
        const workers = [
          ...own.filter((t) => !terminal(t.status)).flatMap((t) => t.workers),
          ...observed.filter((c) => c.habitatId === h.id).map((c) => c.worker),
          ...own
            .filter((t) => terminal(t.status))
            .slice(-1)
            .flatMap((t) => t.workers),
        ].filter((w) => {
          if (!w.threadId || seen.has(w.threadId)) return false;
          seen.add(w.threadId);
          return true;
        });
        return (
          <HabitatDome
            key={h.id}
            habitat={h}
            current={currentHabitat === h.id}
            workers={workers}
            ownedTasks={own}
            selected={selectedHabitat === h.id}
            onSelect={() => onSelectHabitat(h.id)}
            onWorker={onWorker}
            motion={motion}
          />
        );
      })}
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
  projects,
  habitats,
  focusHabitat,
}: {
  focus?: number;
  reset: number;
  command?: CameraCommand;
  pan: boolean;
  projects: Project[];
  habitats: Habitat[];
  focusHabitat?: string;
}) {
  const controls = useRef<any>(null),
    { camera, gl } = useThree();
  const villageExtent = useContext(VillageExtent);
  const farX = Math.max(
    0,
    ...projects.map((p) => districtPosition(p.plot, villageExtent)[0]),
  );
  const farZ = Math.max(28, ...habitats.map((h) => districtDepth(h.plot)));

  const heldKeys = useRef(new Set<string>());
  useEffect(() => {
    const keys = heldKeys.current;
    const movement = new Set([
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
    ]);
    const clear = () => keys.clear();
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        target.closest?.(
          "input,textarea,select,[contenteditable=true],[role=textbox]",
        )
      )
        return;
      const surface = gl.domElement.closest("[data-camera-surface]");
      if (
        !surface ||
        (!surface.matches(":hover") &&
          !surface.contains(document.activeElement))
      )
        return;
      const key = e.key.toLowerCase();
      if (movement.has(key)) {
        e.preventDefault();
        keys.add(key);
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      clear();
    };
  }, [gl]);
  useFrame((_, dt) => {
    const c = controls.current,
      keys = heldKeys.current;
    if (!c || !keys.size) return;
    const x =
      Number(keys.has("d") || keys.has("arrowright")) -
      Number(keys.has("a") || keys.has("arrowleft"));
    const z =
      Number(keys.has("w") || keys.has("arrowup")) -
      Number(keys.has("s") || keys.has("arrowdown"));
    const forward = c.target.clone().sub(camera.position);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(
      forward,
      new THREE.Vector3(0, 1, 0),
    );
    const offset = forward.multiplyScalar(z).add(right.multiplyScalar(x));
    if (!offset.lengthSq()) return;
    offset
      .normalize()
      .multiplyScalar(
        Math.min(dt, 0.05) *
          Math.max(4, camera.position.distanceTo(c.target) * 0.35),
      );
    const next = c.target.clone().add(offset);
    next.x = THREE.MathUtils.clamp(next.x, -30, farX + 30);
    next.z = THREE.MathUtils.clamp(next.z, -farZ, farZ + 35);
    offset.copy(next).sub(c.target);
    camera.position.add(offset);
    c.target.copy(next);
    c.update();
  });

  useEffect(() => {
    let target = new THREE.Vector3(farX / 2, 0, 0),
      span = Math.max(34, farX + 35, farZ);
    const dome = habitats.find((h) => h.id === focusHabitat),
      project = dome
        ? projects.find((p) => p.id === dome.projectId)
        : undefined;
    if (dome && project) {
      const origin = districtPosition(project.plot, villageExtent),
        local = habitatPosition(dome.plot);
      target.set(origin[0] + local[0], 0, local[2]);
      span = 13;
    } else if (focus !== undefined) {
      const origin = districtPosition(focus, villageExtent),
        group = habitats.filter(
          (h) => h.projectId === projects.find((p) => p.plot === focus)?.id,
        ),
        depth = districtDepth(Math.max(0, ...group.map((h) => h.plot)));
      target.set(origin[0], 0, 0);
      span = Math.max(32, depth);
    }
    camera.position
      .copy(target)
      .add(new THREE.Vector3(span * 0.68, span * 0.82, span * 0.95));
    controls.current?.target.copy(target);
    controls.current?.update();
  }, [focus, reset, focusHabitat, projects.length, camera]);
  useEffect(() => {
    if (!command || !controls.current) return;
    const c = controls.current,
      spherical = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(c.target),
      );
    if (command.action === "left") spherical.theta -= Math.PI / 8;
    if (command.action === "right") spherical.theta += Math.PI / 8;
    if (command.action === "in")
      spherical.radius = Math.max(6, spherical.radius * 0.8);
    if (command.action === "out")
      spherical.radius = Math.min(500, spherical.radius * 1.25);
    if (command.action === "top") spherical.phi = 0.15;
    camera.position
      .copy(c.target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
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
      maxDistance={500}
      zoomSpeed={0.7}
      panSpeed={0.8}
      rotateSpeed={0.55}
      enableDamping
      dampingFactor={0.12}
      onChange={() => {
        if (controls.current) {
          controls.current.target.x = THREE.MathUtils.clamp(
            controls.current.target.x,
            -30,
            farX + 30,
          );
          controls.current.target.z = THREE.MathUtils.clamp(
            controls.current.target.z,
            -35,
            farZ + 35,
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
  observedChats = [],
  habitats = [],
  selectedHabitat,
  focusHabitat,
  onSelectHabitat,
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
  observedChats?: ObservedChat[];
  habitats?: Habitat[];
  selectedHabitat?: string;
  focusHabitat?: string;
  onSelectHabitat: (id: string, projectId: string) => void;
}) {
  const labels = useRef<HTMLDivElement>(null!);
  const simpleView = (
    <div className="simple-city">
      {projects.length ? (
        projects.map((p) => (
          <section key={p.id} className="simple-district">
            <button className="simple-building" onClick={() => onSelect(p.id)}>
              <span style={{ color: palette[p.plot % palette.length] }}>⌒</span>
              <strong>{p.name}</strong>
              <small>
                {
                  habitats.filter(
                    (h) => h.projectId === p.id && hasVillageSite(h),
                  ).length
                }{" "}
                habitats · {p.successes} verified tasks
              </small>
            </button>
            <div className="simple-habitats">
              {habitats
                .filter((h) => h.projectId === p.id)
                .map((h) => (
                  <button
                    key={h.id}
                    className="simple-habitat"
                    onClick={() => onSelectHabitat(h.id, p.id)}
                  >
                    <strong>⌒ {h.name}</strong>
                    <small>{h.members.length} assignments</small>
                  </button>
                ))}
            </div>
          </section>
        ))
      ) : (
        <div className="simple-empty">Your first project starts here.</div>
      )}
    </div>
  );
  return (
    <>
      {simple && simpleView}
      {!simple &&
        (observedChats.some((c) => c.habitatId) ||
          tasks.some((t) => !terminal(t.status) && t.habitatId)) && (
          <button
            className="find-crew"
            onClick={() => {
              const t = tasks
                  .filter((t) => !terminal(t.status) && t.habitatId)
                  .at(-1),
                c = currentObservedChat(
                  observedChats.filter((c) => c.habitatId),
                );
              const id = t?.habitatId || c?.habitatId,
                project = t?.projectId || c?.projectId;
              if (id && project) onSelectHabitat(id, project);
            }}
          >
            ◎ Find current crew
          </button>
        )}
      <VillageExtent.Provider
        value={Math.max(0, ...habitats.map((h) => h.plot))}
      >
        <LabelPortal.Provider value={labels}>
          <div
            data-camera-surface
            tabIndex={0}
            role="region"
            aria-label="3D village. Move with WASD or arrow keys."
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
                  <color attach="background" args={["#c4d5da"]} />
                  <fog attach="fog" args={["#c4d5da", 170, 520]} />
                  <ambientLight intensity={0.7} />
                  <hemisphereLight args={["#ffe9d2", "#a77b63", 1]} />
                  <directionalLight
                    position={[-30, 70, 25]}
                    intensity={1.9}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                    shadow-bias={-0.0002}
                    shadow-normalBias={0.06}
                    shadow-camera-left={-50}
                    shadow-camera-right={Math.max(
                      70,
                      ...projects.map(
                        (p) =>
                          districtPosition(
                            p.plot,
                            Math.max(0, ...habitats.map((h) => h.plot)),
                          )[0] + 50,
                      ),
                    )}
                    shadow-camera-top={100}
                    shadow-camera-bottom={-100}
                  />
                  <group position={[0, -0.2, 0]}>
                    <MarsTerrain projects={projects} />
                    {projects.map((project) => (
                      <ProjectDistrict
                        key={project.id}
                        project={project}
                        habitats={habitats.filter(
                          (h) => h.projectId === project.id,
                        )}
                        tasks={tasks.filter((t) => t.projectId === project.id)}
                        observed={observedChats.filter(
                          (c) => c.projectId === project.id,
                        )}
                        selected={selected === project.id}
                        selectedHabitat={selectedHabitat}
                        onSelect={() => onSelect(project.id)}
                        onSelectHabitat={(id) =>
                          onSelectHabitat(id, project.id)
                        }
                        onWorker={onWorker}
                        motion={motion}
                      />
                    ))}
                  </group>
                  <Camera
                    focus={focus}
                    reset={reset}
                    command={cameraCommand}
                    pan={pan}
                    projects={projects}
                    habitats={habitats}
                    focusHabitat={focusHabitat}
                  />
                </Canvas>
              </Suspense>
            </Boundary>
            <div className="city-labels" ref={labels} />
          </div>
        </LabelPortal.Provider>
      </VillageExtent.Provider>
    </>
  );
}
