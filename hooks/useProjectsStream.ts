'use client';

import { useEffect, useMemo, useState } from 'react';
import { mergeStreamedProject } from '@/lib/project-stream';
import type { Project } from '@/lib/types';

type StreamState = {
  projects: Project[];
  isInitialLoading: boolean;
  isStreaming: boolean;
  completedAdapters: number;
  totalAdapters: number;
};

type StreamPayload =
  | { type: 'start'; totalAdapters: number }
  | { type: 'project'; project: Project }
  | { type: 'progress'; completedAdapters: number; totalAdapters: number }
  | { type: 'done' };

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useProjectsStream() {
  const [state, setState] = useState<StreamState>({
    projects: [],
    isInitialLoading: true,
    isStreaming: true,
    completedAdapters: 0,
    totalAdapters: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const eventSource = new EventSource('/api/projects/stream');

    async function syncProjects() {
      try {
        const projects = await fetcher('/api/projects') as Project[];
        if (!cancelled) {
          setState(current => ({
            ...current,
            projects,
            isInitialLoading: false,
            isStreaming: false,
          }));
        }
      } catch {
        if (!cancelled) {
          setState(current => ({
            ...current,
            isInitialLoading: current.projects.length === 0,
            isStreaming: false,
          }));
        }
      }
    }

    eventSource.onmessage = event => {
      if (cancelled) return;

      let payload: StreamPayload;
      try {
        payload = JSON.parse(event.data) as StreamPayload;
      } catch {
        return;
      }

      if (payload.type === 'start') {
        setState(current => ({
          ...current,
          totalAdapters: payload.totalAdapters,
          isStreaming: true,
        }));
        return;
      }

      if (payload.type === 'project') {
        setState(current => ({
          ...current,
          projects: mergeStreamedProject(current.projects, payload.project),
          isInitialLoading: false,
        }));
        return;
      }

      if (payload.type === 'progress') {
        setState(current => ({
          ...current,
          completedAdapters: payload.completedAdapters,
          totalAdapters: payload.totalAdapters,
        }));
        return;
      }

      if (payload.type === 'done') {
        setState(current => ({
          ...current,
          isStreaming: false,
        }));
        eventSource.close();
        void syncProjects();
      }
    };

    eventSource.onerror = () => {
      if (!cancelled) {
        setState(current => ({
          ...current,
          isStreaming: false,
        }));
      }
      eventSource.close();
      void syncProjects();
    };

    return () => {
      cancelled = true;
      eventSource.close();
    };
  }, []);

  const status = useMemo(() => {
    if (state.isStreaming) {
      if (state.totalAdapters > 0) {
        return `正在扫描项目 (${state.completedAdapters}/${state.totalAdapters})`;
      }
      return '正在扫描项目';
    }

    if (state.projects.length === 0) {
      return '未发现项目';
    }

    return null;
  }, [state.completedAdapters, state.isStreaming, state.projects.length, state.totalAdapters]);

  return {
    projects: state.projects,
    isLoading: state.isInitialLoading,
    isStreaming: state.isStreaming,
    status,
  };
}
