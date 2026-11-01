export const DISTRICT_WIDTH = 44;
export function districtPosition(
  plot: number,
  maxHabitatPlot = 0,
): [number, number, number] {
  return [plot * (districtDepth(maxHabitatPlot) + 10), 0, 0];
}
// Stable, irregular clearings: new chats do not move existing buildings.
const clearings: [number, number, number][] = [
  [7.6, 0, 4.2],
  [-5.5, 0, -8.8],
];
export function habitatPosition(plot: number): [number, number, number] {
  while (clearings.length <= plot) {
    const index = clearings.length;
    for (let attempt = 0; ; attempt++) {
      const n = index * 97 + attempt + 1,
        angle = n * 2.399963229728653;
      const radius =
        9 +
        Math.sqrt(index) * 4.8 +
        ((Math.sin(n * 17.13) + 1) / 2) * 4 +
        Math.floor(attempt / 50) * 2;
      const x = Math.cos(angle) * radius,
        z = Math.sin(angle) * radius;
      if (clearings.every((p) => Math.hypot(x - p[0], z - p[2]) >= 8.5)) {
        clearings.push([x, 0, z]);
        break;
      }
    }
  }
  return [...clearings[plot]];
}
export function districtDepth(maxHabitatPlot: number) {
  let radius = 10;
  for (let i = 0; i <= Math.max(0, maxHabitatPlot); i++) {
    const [x, , z] = habitatPosition(i);
    radius = Math.max(radius, Math.hypot(x, z));
  }
  return Math.max(32, radius * 2 + 12);
}
