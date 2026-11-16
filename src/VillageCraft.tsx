import { useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";

import * as THREE from "three";

export function MeadowMaterial() {
  const texture = useMemo(() => {
    const pixels = new Uint8Array(128 * 128 * 4);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 4;
        const grain = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        const n =
          (grain - Math.floor(grain)) * 17 +
          Math.sin(x * 0.12) * Math.cos(y * 0.09) * 7;
        pixels[i] = 127 + n;
        pixels[i + 1] = 149 + n;
        pixels[i + 2] = 99 + n;
        pixels[i + 3] = 255;
      }
    const map = new THREE.DataTexture(pixels, 128, 128);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(600, 600);
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <meshStandardMaterial map={texture} roughness={0.95} />;
}

function SoftBlock({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <RoundedBox
      position={position}
      args={size}
      radius={Math.min(...size) * 0.16}
      smoothness={3}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={0.75} />
    </RoundedBox>
  );
}

export function ChatHouse({
  position,
  color,
  turn = 0,
  accent = "#6b8680",
}: {
  position: [number, number, number];
  color: string;
  turn?: number;
  accent?: string;
}) {
  return (
    <group position={position} rotation={[0, turn, 0]}>
      <SoftBlock
        position={[0, 0.17, 0]}
        size={[3.5, 0.34, 2.9]}
        color="#a7947d"
      />
      <SoftBlock position={[0, 1.37, 0]} size={[3, 2.3, 2.4]} color={color} />
      {/* Individually laid overlapping roof tiles catch light along their edges. */}
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * 0.85, 2.9, 0]}
          rotation={[0, 0, -side * 0.58]}
        >
          <SoftBlock
            position={[0, 0, 0]}
            size={[2.12, 0.18, 3.05]}
            color="#68594f"
          />
          {Array.from({ length: 6 }, (_, row) =>
            Array.from({ length: 7 }, (_, col) => (
              <SoftBlock
                key={`${row}-${col}`}
                position={[
                  -0.87 + row * 0.34,
                  0.12 + row * 0.009,
                  -1.28 + col * 0.43,
                ]}
                size={[0.41, 0.09, 0.46]}
                color={
                  ["#a26753", "#b8775b", "#945e50", "#bd8064"][
                    (row + col * 3) % 4
                  ]
                }
              />
            )),
          )}
        </group>
      ))}
      <SoftBlock
        position={[0, 3.5, 0]}
        size={[0.18, 0.18, 3.2]}
        color="#ce9872"
      />
      <SoftBlock
        position={[0.88, 3.25, -0.55]}
        size={[0.47, 1.35, 0.49]}
        color="#c3ae94"
      />
      <SoftBlock
        position={[0.88, 3.95, -0.55]}
        size={[0.62, 0.16, 0.64]}
        color="#87796a"
      />
      <SoftBlock
        position={[0, 0.98, 1.24]}
        size={[0.72, 1.7, 0.13]}
        color="#627b7b"
      />
      {[-0.23, 0, 0.23].map((x) => (
        <SoftBlock
          key={x}
          position={[x, 0.9, 1.32]}
          size={[0.025, 1.35, 0.025]}
          color="#47605e"
        />
      ))}
      <mesh position={[0.23, 0.95, 1.37]}>
        <sphereGeometry args={[0.055, 12, 8]} />
        <meshStandardMaterial
          color="#dfb26a"
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>
      {[-0.98, 0.98].map((x) => (
        <group key={x} position={[x, 1.57, 1.24]}>
          <SoftBlock
            position={[0, 0, 0]}
            size={[0.66, 0.83, 0.09]}
            color="#ece0c4"
          />
          <mesh position={[0, 0, 0.056]}>
            <planeGeometry args={[0.5, 0.65]} />
            <meshPhysicalMaterial
              color="#c9e1dc"
              roughness={0.12}
              metalness={0.25}
              emissive="#eab777"
              emissiveIntensity={0.18}
            />
          </mesh>
          <SoftBlock
            position={[0, 0, 0.09]}
            size={[0.045, 0.7, 0.04]}
            color="#fff0d2"
          />
          <SoftBlock
            position={[0, 0, 0.09]}
            size={[0.54, 0.045, 0.04]}
            color="#fff0d2"
          />
          {[-1, 1].map((side) => (
            <SoftBlock
              key={side}
              position={[side * 0.43, 0, 0.02]}
              size={[0.18, 0.77, 0.08]}
              color={accent}
            />
          ))}
          <SoftBlock
            position={[0, -0.58, 0.12]}
            size={[0.85, 0.23, 0.33]}
            color="#a47b5c"
          />
          {Array.from({ length: 5 }, (_, i) => (
            <group key={i} position={[-0.3 + i * 0.15, -0.4, 0.17]}>
              <mesh scale={[1, 0.7, 0.8]}>
                <sphereGeometry args={[0.13, 12, 8]} />
                <meshStandardMaterial color="#618465" />
              </mesh>
              <mesh position={[0.03, 0.07, 0.04]}>
                <sphereGeometry args={[0.065, 12, 8]} />
                <meshStandardMaterial color={i % 2 ? "#e9bb8f" : "#d68c9e"} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      <SoftBlock
        position={[0, 0.14, 1.7]}
        size={[1.12, 0.2, 0.6]}
        color="#c8bb9e"
      />
      <SoftBlock
        position={[0, 0.07, 2.12]}
        size={[1.35, 0.12, 0.36]}
        color="#d6c9af"
      />
      {[-1.4, 1.4].map((x) => (
        <SoftBlock
          key={x}
          position={[x, 1.4, 1.24]}
          size={[0.12, 2.2, 0.12]}
          color="#ac9479"
        />
      ))}
    </group>
  );
}
