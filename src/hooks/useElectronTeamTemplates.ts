'use client';

import { useCallback, useEffect, useState } from 'react';
import { isElectron } from './useElectron';
import type { TeamTemplate, TeamTemplateInput } from '@/types/electron';

export function useElectronTeamTemplates() {
  const [teams, setTeams] = useState<TeamTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isElectron() || !window.electronAPI?.teamTemplate) {
      setIsLoading(false);
      return;
    }
    try {
      const result = await window.electronAPI.teamTemplate.list();
      setTeams(result.teams);
      setError(result.error ?? null);
    } catch (err) {
      console.error('Failed to list team templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to list team templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (input: TeamTemplateInput) => {
    if (!window.electronAPI?.teamTemplate) throw new Error('Electron API not available');
    const result = await window.electronAPI.teamTemplate.create(input);
    await refresh();
    return result;
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    if (!window.electronAPI?.teamTemplate) throw new Error('Electron API not available');
    const result = await window.electronAPI.teamTemplate.delete(id);
    await refresh();
    return result;
  }, [refresh]);

  return { teams, isLoading, error, refresh, create, remove };
}
