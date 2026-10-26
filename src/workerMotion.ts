import type { Worker } from "../shared/domain";
export type WorkerAction =
  | "walking"
  | "pickup"
  | "carrying"
  | "placing"
  | "hammering"
  | "measuring"
  | "inspecting"
  | "terminal"
  | "waiting"
  | "resting";
export interface Pose {
  x: number;
  z: number;
  heading: number;
  action: WorkerAction;
  progress: number;
  carrying: boolean;
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
// Choreography is presentation only. It never updates task progress or repository state.
export function workerPose(
  status: Worker["status"],
  elapsed: number,
  index: number,
): Pose {
  const offset = index * 0.18,
    supply: [number, number] = [-1.65 + offset, 1.6],
    station: [number, number] = [1.45 - offset, 1.6];
  const resting = {
    x: -1.6 + (index % 5) * 0.75,
    z: 2.6 + Math.floor(index / 5) * 0.4,
    heading: 0,
    action: "resting" as WorkerAction,
    progress: 0,
    carrying: false,
  };
  if (status.includes("waiting") || status === "blocked")
    return { ...resting, action: "waiting" };
  if (["completed", "interrupted", "failed", "queued", "idle"].includes(status))
    return resting;
  if (status === "editing") {
    const t = elapsed % 18;
    if (t < 1.8)
      return {
        x: supply[0],
        z: supply[1],
        heading: Math.PI,
        action: "pickup",
        progress: t / 1.8,
        carrying: t > 0.95,
      };
    if (t < 7.3)
      return {
        x: mix(supply[0], station[0], (t - 1.8) / 5.5),
        z: 1.7 + Math.sin(((t - 1.8) / 5.5) * Math.PI) * 0.55,
        heading: Math.PI / 2,
        action: "carrying",
        progress: (t - 1.8) / 5.5,
        carrying: true,
      };
    if (t < 9)
      return {
        x: station[0],
        z: station[1],
        heading: Math.PI,
        action: "placing",
        progress: (t - 7.3) / 1.7,
        carrying: t < 8.3,
      };
    if (t < 12.8)
      return {
        x: station[0],
        z: station[1],
        heading: Math.PI,
        action: "hammering",
        progress: (t - 9) / 3.8,
        carrying: false,
      };
    return {
      x: mix(station[0], supply[0], (t - 12.8) / 5.2),
      z: 1.7 + Math.sin(((t - 12.8) / 5.2) * Math.PI) * 0.65,
      heading: -Math.PI / 2,
      action: "walking",
      progress: (t - 12.8) / 5.2,
      carrying: false,
    };
  }
  const t = (elapsed + index * 2) % 14;
  if (status === "running commands" || status === "checking") {
    if (t > 5)
      return {
        x: -0.4 + index * 0.65,
        z: 2.25,
        heading: Math.PI,
        action: status === "checking" ? "measuring" : "terminal",
        progress: (t - 5) / 9,
        carrying: false,
      };
  }
  const travel = (t / 14) * Math.PI * 2;
  return {
    x: Math.sin(travel) * 1.7,
    z: 2.05 + Math.cos(travel) * 0.35,
    heading: Math.atan2(Math.cos(travel) * 1.7, -Math.sin(travel) * 0.35),
    action: "inspecting",
    progress: t / 14,
    carrying: false,
  };
}
