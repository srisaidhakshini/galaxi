import type { Habitat } from "./domain";

export const DOME_MAX_PROMPTS = 20;
export const DOME_MIN_SCALE = 0.85;
export const DOME_MAX_SCALE = 1.45;

export function habitatPromptCount(habitat: Habitat) {
  return new Set(
    habitat.members
      .filter(
        (m) =>
          !habitat.chatThreadId ||
          (m.kind === "chat" && m.threadId === habitat.chatThreadId),
      )
      .map((m) => `${m.kind}/${m.id}`),
  ).size;
}

export function domeScale(promptCount: number) {
  const progress = Math.min(
    1,
    Math.max(0, promptCount - 1) / (DOME_MAX_PROMPTS - 1),
  );
  return DOME_MIN_SCALE + progress * (DOME_MAX_SCALE - DOME_MIN_SCALE);
}

export function habitatFeatures(promptCount: number, constructionStage = 5) {
  const count = Math.max(0, Math.floor(promptCount));
  const stage = Math.min(
    constructionStage,
    count < 2 ? 1 : count < 3 ? 2 : count < 5 ? 3 : count < 7 ? 4 : 5,
  );
  return {
    stage,
    foundation: stage >= 1,
    frame: stage >= 2,
    glassPanels: stage >= 3 ? Math.min(8, Math.max(0, (count - 2) * 4)) : 0,
    door: stage >= 4 && count >= 5,
    windows: stage >= 4 && count >= 6,
    table: stage >= 5 && count >= 7,
    chairs: stage >= 5 && count >= 8,
    workstation: stage >= 5 && count >= 9,
    planting: stage >= 5 && count >= 10,
    lights: stage >= 5 && count >= 12,
    shelving: stage >= 5 && count >= 14,
  };
}
