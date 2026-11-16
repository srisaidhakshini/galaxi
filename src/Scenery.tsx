import { useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const siteColours = [
  "#e77f62",
  "#45aeb1",
  "#7292d5",
  "#b391d1",
  "#e4af4d",
  "#71a78a",
];
function Block({
  position,
  scale,
  colour,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  colour: string;
}) {
  return (
    <RoundedBox
      position={position}
      args={scale}
      radius={Math.min(...scale) * 0.15}
      smoothness={3}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={colour} roughness={0.7} />
    </RoundedBox>
  );
}
export function WindTree({
  x,
  z,
  index,
  motion,
}: {
  x: number;
  z: number;
  index: number;
  motion: boolean;
}) {
  const crown = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (crown.current) {
      crown.current.rotation.z = motion
        ? Math.sin(clock.elapsedTime * 0.85 + index) * 0.035
        : 0;
      crown.current.rotation.x = motion
        ? Math.cos(clock.elapsedTime * 0.65 + index) * 0.018
        : 0;
    }
  });
  return (
    <group position={[x, 0, z]} rotation={[0, index * 1.13, 0]}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <cylinderGeometry args={[0.095, 0.17, 1.7, 7]} />
        <meshStandardMaterial color="#856249" />
      </mesh>
      <group ref={crown} position={[0, 1.25, 0]}>
        <mesh position={[0, 0.2, 0]} rotation={[0, 0, 0.5]} castShadow>
          <cylinderGeometry args={[0.065, 0.09, 0.9, 6]} />
          <meshStandardMaterial color="#856249" />
        </mesh>
        {Array.from({ length: 15 }, (_, i) => {
          const angle = i * 2.399;
          const width = 0.25 + (i % 4) * 0.17;
          return [
            Math.sin(angle) * width,
            0.45 + (i % 5) * 0.24,
            Math.cos(angle) * width,
            0.4 + (i % 3) * 0.12,
          ];
        }).map(([a, b, c, r], i) => (
          <mesh key={i} position={[a, b, c]} castShadow>
            <sphereGeometry args={[r, 28, 20]} />
            <meshStandardMaterial
              color={
                ["#557c54", "#79965c", "#9aaa6a", "#6c905e"][(index + i) % 4]
              }
              roughness={0.95}
            />
          </mesh>
        ))}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <circleGeometry args={[0.6, 12]} />
        <meshStandardMaterial color="#a3b47b" />
      </mesh>
    </group>
  );
}
function Fountain({ motion }: { motion: boolean }) {
  const spray = useRef<THREE.Group>(null),
    ripples = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = motion ? clock.elapsedTime : 0;
    spray.current?.children.forEach((m, i) => {
      const phase = (t * 0.7 + i / 12) % 1;
      m.position.y = 0.6 + Math.sin(phase * Math.PI) * 1.4;
      const r = 0.1 + phase * 1.25,
        angle = (i * Math.PI * 2) / 12;
      m.position.x = Math.cos(angle) * r;
      m.position.z = Math.sin(angle) * r;
      m.scale.setScalar(0.65 + Math.sin(phase * Math.PI) * 0.4);
    });
    ripples.current?.children.forEach((m, i) => {
      const phase = (t * 0.4 + i / 3) % 1;
      m.scale.setScalar(0.25 + phase * 1.4);
      (
        m as THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>
      ).material.opacity = (1 - phase) * 0.5;
    });
  });
  return (
    <group>
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[2, 2.12, 0.3, 48]} />
        <meshStandardMaterial color="#c8bdac" roughness={0.85} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.31, 0]} castShadow>
        <torusGeometry args={[1.88, 0.14, 8, 48]} />
        <meshStandardMaterial color="#eee4d0" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.32, 0]}>
        <circleGeometry args={[1.79, 48]} />
        <meshStandardMaterial
          color="#3ca9bd"
          roughness={0.18}
          metalness={0.3}
        />
      </mesh>
      <mesh position={[0, 0.66, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.3, 0.75, 12]} />
        <meshStandardMaterial color="#899da2" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.04, 0.085, 0.9, 8]} />
        <meshStandardMaterial color="#b4edf2" transparent opacity={0.8} />
      </mesh>
      <group ref={spray}>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.055, 5, 5]} />
            <meshStandardMaterial color="#dbfbff" transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
      <group ref={ripples}>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.335 + i * 0.003, 0]}
          >
            <torusGeometry args={[1, 0.012, 4, 40]} />
            <meshStandardMaterial
              color="#c6eff0"
              transparent
              opacity={0.4}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
function GardenBed({ x, z, colour }: { x: number; z: number; colour: string }) {
  return (
    <group position={[x, 0, z]}>
      <Block position={[0, 0.16, 0]} scale={[1.8, 0.3, 0.7]} colour="#bfaa8f" />
      <Block
        position={[0, 0.32, 0]}
        scale={[1.62, 0.05, 0.52]}
        colour="#705e49"
      />
      {Array.from({ length: 9 }, (_, i) => (
        <group
          key={i}
          position={[
            -0.66 + i * 0.165,
            0.43 + (i % 2) * 0.06,
            Math.sin(i * 2) * 0.12,
          ]}
        >
          <mesh scale={[1, 0.65, 1]}>
            <sphereGeometry args={[0.16, 16, 12]} />
            <meshStandardMaterial color="#597c59" />
          </mesh>
          {[0, 1, 2, 3, 4].map((p) => (
            <mesh
              key={p}
              position={[
                Math.sin(p * 1.256) * 0.06,
                0.12,
                Math.cos(p * 1.256) * 0.06,
              ]}
            >
              <sphereGeometry args={[0.048, 10, 8]} />
              <meshStandardMaterial color={colour} />
            </mesh>
          ))}
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshStandardMaterial color="#f5d48b" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ParkBench({ x, z, angle }: { x: number; z: number; angle: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, angle, 0]}>
      {[-0.66, 0.66].map((x) => (
        <Block
          key={x}
          position={[x, 0.28, 0]}
          scale={[0.09, 0.52, 0.55]}
          colour="#365c60"
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Block
          key={i}
          position={[0, 0.55, -0.23 + i * 0.15]}
          scale={[1.85, 0.08, 0.12]}
          colour={i % 2 ? "#bc8e63" : "#cb9b70"}
        />
      ))}
      {[-0.76, 0.76].map((x) => (
        <Block
          key={x}
          position={[x, 0.86, -0.3]}
          scale={[0.06, 0.72, 0.06]}
          colour="#365c60"
        />
      ))}
      {[0, 1, 2].map((i) => (
        <Block
          key={i}
          position={[0, 0.85 + i * 0.16, -0.32]}
          scale={[1.85, 0.1, 0.07]}
          colour="#bc8e63"
        />
      ))}
    </group>
  );
}

export function VillageLandscape({
  radius,
  motion,
  sites = [],
}: {
  radius: number;
  motion: boolean;
  sites?: [number, number, number][];
}) {
  return (
    <group>
      {/* A continuous pedestrian square; furnishings sit outside the walking routes. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.016, 0]}
        receiveShadow
      >
        <circleGeometry args={[5.1, 80]} />
        <meshStandardMaterial color="#d8c7a8" roughness={0.95} />
      </mesh>
      {[2.5, 4.85].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.023, 0]}>
          <ringGeometry args={[r, r + 0.1, 80]} />
          <meshStandardMaterial color="#b7a385" roughness={1} />
        </mesh>
      ))}
      {Array.from({ length: 48 }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, (i * Math.PI) / 24]}
          position={[0, 0.026, 0]}
        >
          <ringGeometry
            args={[4.96, 5.11, 1, 1, (i * Math.PI) / 24, Math.PI / 24 - 0.012]}
          />
          <meshStandardMaterial color={i % 2 ? "#c2ae8e" : "#e9d9bc"} />
        </mesh>
      ))}
      <Fountain motion={motion} />
      <ParkBench x={-3.65} z={0} angle={Math.PI / 2} />
      <ParkBench x={3.65} z={0} angle={-Math.PI / 2} />
      <GardenBed x={0} z={-3.75} colour="#dc8e99" />
      <GardenBed x={0} z={3.75} colour="#e9b45c" />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 4.4, 0, 1.65]}>
          <Block
            position={[0, 0.08, 0]}
            scale={[0.28, 0.16, 0.28]}
            colour="#a99e8a"
          />
          <mesh position={[0, 1.3, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.065, 2.5, 12]} />
            <meshStandardMaterial
              color="#31595c"
              metalness={0.45}
              roughness={0.45}
            />
          </mesh>
          <mesh position={[0, 2.6, 0]}>
            <sphereGeometry args={[0.18, 20, 16]} />
            <meshStandardMaterial
              color="#fff0cc"
              emissive="#ffd690"
              emissiveIntensity={0.6}
            />
          </mesh>
          <mesh position={[0, 2.8, 0]}>
            <coneGeometry args={[0.27, 0.18, 20]} />
            <meshStandardMaterial color="#31595c" />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 9 }, (_, i) => {
        const angle = i * 2.399;
        const r = Math.min(radius - 2.5, 12 + (i % 3) * 2);
        const x = Math.sin(angle) * r,
          z = Math.cos(angle) * r;
        if (sites.some(([a, , b]) => Math.hypot(x - a, z - b) < 4.5))
          return null;
        return <WindTree key={i} x={x} z={z} index={i} motion={motion} />;
      })}
    </group>
  );
}

export function HabitatDetails({
  stage,
  colour,
  busy,
}: {
  stage: number;
  colour: string;
  busy: boolean;
}) {
  return (
    <group>
      {stage >= 1 && (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.18, 0]}>
            <torusGeometry args={[2.29, 0.07, 6, 48]} />
            <meshStandardMaterial
              color={colour}
              roughness={0.45}
              metalness={0.3}
            />
          </mesh>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <mesh
              key={i}
              position={[
                Math.sin((i * Math.PI) / 4) * 2.3,
                0.16,
                Math.cos((i * Math.PI) / 4) * 2.3,
              ]}
            >
              <cylinderGeometry args={[0.05, 0.05, 0.1, 6]} />
              <meshStandardMaterial
                color="#556c75"
                metalness={0.7}
                roughness={0.35}
              />
            </mesh>
          ))}
        </>
      )}
      {stage >= 4 && (
        <>
          <Block
            position={[-0.48, 0.66, 2.14]}
            scale={[0.08, 1.2, 0.1]}
            colour={colour}
          />
          <Block
            position={[0.48, 0.66, 2.14]}
            scale={[0.08, 1.2, 0.1]}
            colour={colour}
          />
          <Block
            position={[0, 1.28, 2.14]}
            scale={[1.04, 0.08, 0.15]}
            colour={colour}
          />
          <Block
            position={[0.21, 0.65, 2.25]}
            scale={[0.04, 0.2, 0.05]}
            colour="#e4d5b2"
          />
          <Block
            position={[0, 0.08, 2.5]}
            scale={[1.2, 0.15, 0.5]}
            colour="#c6c5b5"
          />
          <Block
            position={[0, 0.045, 2.8]}
            scale={[1.45, 0.08, 0.4]}
            colour="#d7d1bc"
          />
        </>
      )}
      {stage >= 5 && (
        <>
          <group position={[-1.45, 0.5, -1.25]} rotation={[-0.35, 0, 0]}>
            <Block
              position={[0, 0, 0]}
              scale={[0.9, 0.06, 0.8]}
              colour="#365b80"
            />
            {[-0.3, 0, 0.3].map((x) => (
              <Block
                key={x}
                position={[x, 0.04, 0]}
                scale={[0.02, 0.02, 0.78]}
                colour="#87bdd5"
              />
            ))}
          </group>
          <mesh position={[1.65, 0.46, -0.9]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.7, 12]} />
            <meshStandardMaterial
              color={colour}
              roughness={0.4}
              metalness={0.3}
            />
          </mesh>
          {[-1, 1].map((x) => (
            <group key={x} position={[x * 1.1, 0, 2.25]}>
              <mesh position={[0, 0.17, 0]}>
                <cylinderGeometry args={[0.24, 0.18, 0.34, 8]} />
                <meshStandardMaterial color={colour} />
              </mesh>
              <mesh position={[0, 0.48, 0]}>
                <icosahedronGeometry args={[0.31, 1]} />
                <meshStandardMaterial color="#69a17b" />
              </mesh>
            </group>
          ))}
        </>
      )}
      {busy && stage < 5 && (
        <>
          {[-1, 1].map((x) => (
            <group key={x} position={[x * 2.7, 0, 0.6]}>
              <Block
                position={[0, 0.03, 0]}
                scale={[0.34, 0.06, 0.34]}
                colour="#444e54"
              />
              <mesh position={[0, 0.25, 0]}>
                <coneGeometry args={[0.13, 0.45, 8]} />
                <meshStandardMaterial color="#ee9350" />
              </mesh>
              <mesh position={[0, 0.29, 0]}>
                <cylinderGeometry args={[0.075, 0.09, 0.09, 8]} />
                <meshStandardMaterial color="#fff4dc" />
              </mesh>
            </group>
          ))}
          <group position={[-2.8, 0, 3.1]} rotation={[0, 0.5, 0]}>
            <Block
              position={[0, 0.38, 0]}
              scale={[0.65, 0.22, 0.85]}
              colour={colour}
            />
            <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.22, 0.53]}>
              <torusGeometry args={[0.2, 0.055, 6, 12]} />
              <meshStandardMaterial color="#414d53" />
            </mesh>
            {[-0.24, 0.24].map((x) => (
              <Block
                key={x}
                position={[x, 0.3, -0.65]}
                scale={[0.045, 0.05, 0.6]}
                colour="#637b81"
              />
            ))}
          </group>
        </>
      )}
    </group>
  );
}

export function DomeFurnishings({
  features,
  colour,
}: {
  features: ReturnType<
    typeof import("../shared/habitatGrowth").habitatFeatures
  >;
  colour: string;
}) {
  return (
    <group>
      {features.windows &&
        [-1, 1].map((side) => (
          <group
            key={side}
            position={[side * 1.88, 0.95, 0.45]}
            rotation={[0, side * 1.3, 0]}
          >
            <mesh>
              <torusGeometry args={[0.34, 0.055, 8, 24]} />
              <meshStandardMaterial
                color={colour}
                metalness={0.4}
                roughness={0.4}
              />
            </mesh>
            <mesh>
              <circleGeometry args={[0.32, 24]} />
              <meshStandardMaterial
                color="#99dbeb"
                transparent
                opacity={0.45}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Block
              position={[0, 0, 0.02]}
              scale={[0.035, 0.64, 0.025]}
              colour="#e3e9de"
            />
            <Block
              position={[0, 0, 0.02]}
              scale={[0.64, 0.035, 0.025]}
              colour="#e3e9de"
            />
          </group>
        ))}
      {features.table && (
        <group position={[0, 0, -0.25]}>
          <Block
            position={[0, 0.73, 0]}
            scale={[1.25, 0.09, 0.75]}
            colour="#c59365"
          />
          {[-0.5, 0.5].flatMap((x) =>
            [-0.24, 0.24].map((z) => (
              <Block
                key={x + "," + z}
                position={[x, 0.45, z]}
                scale={[0.065, 0.55, 0.065]}
                colour="#677d82"
              />
            )),
          )}
        </group>
      )}
      {features.chairs &&
        [-1, 1].map((side) => (
          <group
            key={side}
            position={[side * 0.85, 0, -0.25]}
            rotation={[0, (-side * Math.PI) / 2, 0]}
          >
            <Block
              position={[0, 0.48, 0]}
              scale={[0.42, 0.08, 0.43]}
              colour={colour}
            />
            <Block
              position={[0, 0.72, -0.18]}
              scale={[0.42, 0.45, 0.06]}
              colour={colour}
            />
            {[-0.15, 0.15].flatMap((x) =>
              [-0.14, 0.14].map((z) => (
                <Block
                  key={x + "," + z}
                  position={[x, 0.31, z]}
                  scale={[0.04, 0.3, 0.04]}
                  colour="#627780"
                />
              )),
            )}
          </group>
        ))}
      {features.workstation && (
        <group position={[0, 0.8, -0.35]}>
          <Block
            position={[0, 0.26, -0.13]}
            scale={[0.53, 0.35, 0.055]}
            colour="#354d5e"
          />
          <Block
            position={[0, 0.26, -0.095]}
            scale={[0.46, 0.28, 0.012]}
            colour="#79c7d2"
          />
          <Block
            position={[0, 0.08, -0.13]}
            scale={[0.045, 0.17, 0.05]}
            colour="#677d82"
          />
          <Block
            position={[0, 0.015, 0.12]}
            scale={[0.4, 0.025, 0.14]}
            colour="#526779"
          />
        </group>
      )}
      {features.lights && (
        <>
          <mesh position={[0, 1.85, -0.4]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshStandardMaterial
              color="#ffedbd"
              emissive="#ffe7a9"
              emissiveIntensity={1}
            />
          </mesh>
          <Block
            position={[0, 2, -0.4]}
            scale={[0.025, 0.25, 0.025]}
            colour="#c8d3c9"
          />
        </>
      )}
      {features.shelving && (
        <group position={[0, 0, -1.5]}>
          {[-0.6, 0.6].map((x) => (
            <Block
              key={x}
              position={[x, 0.77, 0]}
              scale={[0.055, 1.1, 0.32]}
              colour="#69818a"
            />
          ))}
          {[0.3, 0.65, 1].map((y, i) => (
            <group key={y}>
              <Block
                position={[0, y, 0]}
                scale={[1.25, 0.055, 0.35]}
                colour="#c5a277"
              />
              <Block
                position={[-0.25, y + 0.13, 0]}
                scale={[0.35, 0.2, 0.23]}
                colour={i % 2 ? colour : "#d9cba9"}
              />
            </group>
          ))}
        </group>
      )}
    </group>
  );
}
