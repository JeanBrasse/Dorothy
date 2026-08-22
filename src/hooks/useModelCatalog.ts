'use client';

import { useEffect, useState } from 'react';
import { PROVIDER_REGISTRY } from '@/lib/providers';
import type { CatalogModel } from '@/types/electron';

/**
 * Models for a provider, from the live catalogue.
 *
 * Every model picker in the app should go through this: the static registry is
 * a snapshot taken at release time, so anything shipped since is invisible to
 * whichever picker still reads it. The registry stays as the offline floor.
 */

const cache = new Map<string, CatalogModel[]>();

export interface PickerModel {
  id: string;
  name: string;
  description?: string;
}

function fallbackFor(providerId: string): PickerModel[] {
  const provider = PROVIDER_REGISTRY.find(p => p.id === providerId);
  return (provider?.models ?? [])
    .filter(m => m.id !== 'default')
    .map(m => ({ id: m.id, name: m.name, description: m.description }));
}

function describe(model: CatalogModel): string {
  return [
    model.contextWindow ? `${Math.round(model.contextWindow / 1000)}K context` : '',
    model.cost?.input != null ? `$${model.cost.input}/M in` : '',
    model.releaseDate || '',
  ].filter(Boolean).join(' · ');
}

export function useModelCatalog(providerId: string | undefined): {
  models: PickerModel[];
  loading: boolean;
  live: boolean;
} {
  const provider = providerId || 'claude';
  const [models, setModels] = useState<CatalogModel[] | null>(cache.get(provider) ?? null);
  const [loading, setLoading] = useState(!cache.has(provider));

  useEffect(() => {
    let cancelled = false;
    const cached = cache.get(provider);
    if (cached) {
      setModels(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    window.electronAPI?.models?.list(provider)
      .then(res => {
        if (cancelled) return;
        const list = res?.models ?? [];
        cache.set(provider, list);
        setModels(list);
      })
      .catch(() => { if (!cancelled) setModels([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [provider]);

  if (models && models.length > 0) {
    return {
      models: models.map(m => ({ id: m.id, name: m.name, description: describe(m) })),
      loading,
      live: true,
    };
  }
  return { models: fallbackFor(provider), loading, live: false };
}
