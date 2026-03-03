import type { Project } from "./types";

function getProjectIdentityKey(project: Project): string {
  return `${project.toolId}:${project.id}`;
}

export function mergeStreamedProject(current: Project[], incoming: Project): Project[] {
  const next = [...current];
  const incomingKey = getProjectIdentityKey(incoming);
  const existingIndex = next.findIndex(project => getProjectIdentityKey(project) === incomingKey);

  if (existingIndex >= 0) {
    next[existingIndex] = incoming;
  } else {
    next.push(incoming);
  }

  return next.sort((left, right) => (
    new Date(right.lastActivity).getTime() - new Date(left.lastActivity).getTime()
  ));
}
