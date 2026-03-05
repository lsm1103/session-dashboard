import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Project } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getProjectListKey(project: Pick<Project, "id" | "toolId">) {
  return `${project.toolId}:${project.id}`
}
