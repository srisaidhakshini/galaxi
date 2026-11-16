import type { ObservedChat } from "./domain";

export const isCheckCommand = (command: string) =>
  /(?:^|[\s;&|])(?:npm|pnpm|yarn|bun)(?:\s+(?:run|exec))?\s+(?:test(?::[\w-]+)?|build|lint|typecheck|type-check)(?=$|[\s;&|])/i.test(
    command,
  ) ||
  /(?:^|[\s;&|])(?:npx\s+)?(?:tsc|vitest|jest|pytest|playwright)(?=$|[\s;&|])/i.test(
    command,
  ) ||
  /\b(?:cargo|go|dotnet|make)\s+(?:test|check|clippy|vet)\b|\bpython(?:3)?\s+-m\s+(?:pytest|unittest)\b|\bnode\s+--test\b/i.test(
    command,
  );

export const isWriteCommand = (command: string) =>
  /\b(apply_patch|Set-Content|Add-Content|Out-File|writeFile(?:Sync)?|write_text)\b/i.test(
    command,
  );

export function observedItems(activity: ObservedChat["activity"], tab: string) {
  return activity.filter((a) => {
    if (tab === "Chat")
      return a.kind === "userMessage" || a.kind === "agentMessage";
    if (tab === "Changes")
      return (
        a.kind === "fileChange" ||
        (a.kind === "commandExecution" && isWriteCommand(a.message))
      );
    if (tab === "Checks")
      return a.kind === "commandExecution" && isCheckCommand(a.message);
    return true;
  });
}
