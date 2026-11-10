/** Paired clients can submit/steer/cancel tasks, never manage local trust or apply code. */
export function pairedMutationAllowed(
  permission: string | undefined,
  path: string,
) {
  return (
    path === "/pair/disconnect" ||
    (permission === "prompt" &&
      (path === "/tasks" || /^\/tasks\/[^/]+\/(steer|cancel)$/.test(path)))
  );
}
