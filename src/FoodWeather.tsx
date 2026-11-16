import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Procedural food props keep the world crisp at every camera distance. */
function Food({ kind }: { kind: number }) {
  if (kind === 0)
    return (
      <group rotation={[0.35, 0, 0.2]}>
        <mesh castShadow>
          <torusGeometry args={[0.8, 0.32, 12, 28]} />
          <meshStandardMaterial color="#e6a34f" roughness={0.65} />
        </mesh>
        <mesh position={[0, 0, 0.13]}>
          <torusGeometry args={[0.8, 0.27, 12, 28]} />
          <meshStandardMaterial color="#ff79b4" />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh
            key={i}
            position={[Math.cos(i * 2.4) * 0.8, Math.sin(i * 2.4) * 0.8, 0.4]}
            rotation={[0, 0, i]}
          >
            <capsuleGeometry args={[0.025, 0.13, 3, 4]} />
            <meshStandardMaterial
              color={["#fff2ac", "#61e6dc", "#fffaff"][i % 3]}
            />
          </mesh>
        ))}
      </group>
    );
  if (kind === 1)
    return (
      <group>
        <mesh position={[0, 0.35, 0]} castShadow>
          <sphereGeometry
            args={[0.95, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial color="#ffc15f" />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[1, 1, 0.15, 20]} />
          <meshStandardMaterial color="#76d94a" />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[1.5, 0.12, 1.5]} />
          <meshStandardMaterial color="#ffcf42" />
        </mesh>
        <mesh position={[0, -0.12, 0]} castShadow>
          <cylinderGeometry args={[0.9, 0.9, 0.25, 20]} />
          <meshStandardMaterial color="#87442f" />
        </mesh>
        <mesh position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.93, 0.8, 0.22, 20]} />
          <meshStandardMaterial color="#eda552" />
        </mesh>
      </group>
    );
  return (
    <mesh castShadow>
      <dodecahedronGeometry args={[0.75, 1]} />
      <meshStandardMaterial color="#b95732" roughness={0.95} />
    </mesh>
  );
}

export function FoodWeather({ motion }: { motion: boolean }) {
  const food = useRef<THREE.Group>(null);
  const clouds = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = motion ? clock.elapsedTime : 0;
    food.current?.children.forEach((item, i) => {
      item.position.y = 5 + ((((i * 3.7 - t * 0.38) % 11) + 11) % 11);
      item.rotation.set(
        t * 0.12 + i,
        t * 0.17 + i,
        Math.sin(t * 0.3 + i) * 0.25,
      );
    });
    clouds.current?.children.forEach((item, i) => {
      item.position.x = Math.sin(t * 0.045 + i * 1.8) * 15;
    });
  });
  return (
    <group>
      <group ref={clouds}>
        {Array.from({ length: 7 }, (_, i) => (
          <group
            key={i}
            position={[Math.sin(i * 1.8) * 15, 14 + (i % 3) * 3, -17 + i * 5]}
          >
            {[-1, 0, 1].map((x) => (
              <mesh
                key={x}
                position={[x * 1.3, x === 0 ? 0.4 : 0, 0]}
                scale={[1.65, 0.85, 1]}
              >
                <sphereGeometry args={[1.3, 16, 12]} />
                <meshStandardMaterial
                  color={i % 2 ? "#fff0ec" : "#ffffff"}
                  roughness={1}
                />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      <group ref={food}>
        {Array.from({ length: 9 }, (_, i) => (
          <group
            key={i}
            position={[
              Math.sin(i * 2.39) * (10 + (i % 4) * 3),
              5 + (i % 11),
              Math.cos(i * 2.39) * (10 + (i % 3) * 4),
            ]}
            scale={0.6 + (i % 3) * 0.25}
          >
            <Food kind={i % 3} />
          </group>
        ))}
      </group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 12, 0, -8]} scale={2}>
          <mesh position={[0, 0.9, 0]} castShadow>
            <coneGeometry args={[0.5, 1.8, 12]} />
            <meshStandardMaterial color="#e8af66" />
          </mesh>
          <mesh position={[0, 2, 0]} castShadow>
            <sphereGeometry args={[0.8, 20, 16]} />
            <meshStandardMaterial color={side === 1 ? "#ff91bd" : "#b5edbc"} />
          </mesh>
          <mesh position={[0.15, 2.7, 0]}>
            <sphereGeometry args={[0.16, 12, 8]} />
            <meshStandardMaterial color="#f04d59" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
