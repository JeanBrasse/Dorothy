'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Sparkles, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useElectronSkills } from '@/hooks/useElectron';
import { useElectronTemplates } from '@/hooks/useElectronTemplates';
import type { AgentTemplate, AgentTemplateInput } from '@/types/electron';
import { TemplateCard } from './TemplateCard';
import { InstantiateDialog } from './InstantiateDialog';
import { TemplateFormDialog } from './TemplateFormDialog';
import { ImportDialog } from './ImportDialog';
import TerminalDialog from '@/components/TerminalDialog';
import { SKILLS_DATABASE, fetchSkillsFromMarketplace, type Skill } from '@/lib/skills-database';

interface TemplatesManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TemplatesManagerDialog({ open, onClose }: TemplatesManagerDialogProps) {
  const router = useRouter();
  const { builtinTemplates, userTemplates, isLoading, refresh: refreshTemplates, create, update, remove, duplicate, exportTemplates, importTemplates } = useElectronTemplates();
  const { installedSkills, refresh: refreshSkills } = useElectronSkills();

  const [instantiateTarget, setInstantiateTarget] = useState<AgentTemplate | null>(null);
  const [editTarget, setEditTarget] = useState<AgentTemplate | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [liveSkills, setLiveSkills] = useState<Skill[] | null>(null);
  const [installSkillTarget, setInstallSkillTarget] = useState<{ repo: string; title: string } | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  const hasNestedDialog = !!instantiateTarget || !!editTarget || showCreate || showImport || !!installSkillTarget;

  useEffect(() => {
    if (!open) return;
    // The dialog stays mounted on the Agents page, so refetch on every open —
    // templates saved elsewhere (e.g. "Save as template" on a card) must show.
    refreshTemplates();
    fetchSkillsFromMarketplace().then(s => { if (s) setLiveSkills(s); }).catch(() => {});
  }, [open, refreshTemplates]);

  // Escape closes the manager — but only when no nested dialog is open,
  // otherwise both layers would close on one keypress.
  useEffect(() => {
    if (!open || hasNestedDialog) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hasNestedDialog, onClose]);

  if (!open) return null;

  function findSkillRepo(skillName: string): string | null {
    const candidates = liveSkills ?? SKILLS_DATABASE;
    const lower = skillName.toLowerCase();
    const match = candidates.find(s => s.name.toLowerCase() === lower);
    return match ? match.repo : null;
  }

  function handleInstallSkill(skillName: string) {
    const repo = findSkillRepo(skillName);
    if (!repo) {
      setInstallError(`"${skillName}" isn't in the public marketplace. Install it manually from the Skills page.`);
      return;
    }
    setInstallSkillTarget({ repo: `${repo}/${skillName}`, title: skillName });
  }

  async function handleCreate(input: AgentTemplateInput) {
    const result = await create(input);
    return { success: result.success, error: result.error };
  }

  async function handleUpdate(input: AgentTemplateInput) {
    if (!editTarget) return { success: false, error: 'No template selected' };
    const result = await update({ id: editTarget.id, ...input });
    return { success: result.success, error: result.error };
  }

  async function handleDelete(template: AgentTemplate) {
    if (!confirm(`Delete template "${template.displayName}"? This cannot be undone.`)) return;
    await remove(template.id);
  }

  async function handleReset(template: AgentTemplate) {
    if (!confirm(`Reset "${template.displayName}" to its default settings?`)) return;
    await remove(template.id);
  }

  async function handleDuplicate(template: AgentTemplate) {
    await duplicate(template.id);
  }

  async function handleExport(template: AgentTemplate) {
    const result = await exportTemplates([template.id]);
    if (!result.success || !result.payload) return;
    const filename = `${template.displayName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'template'}.dorothy-template.json`;
    const blob = new Blob([JSON.stringify(result.payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Agent Templates
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick a role, point it at a project, get an agent. No setup required.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-border bg-card text-xs font-medium text-foreground hover:bg-accent/50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New blank template
            </button>
            <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading templates…
            </div>
          ) : (
            <>
              <section className="mb-8">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
                  Built-in roles
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {builtinTemplates.map(t => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      installedSkills={installedSkills}
                      onUse={() => setInstantiateTarget(t)}
                      onEdit={() => setEditTarget(t)}
                      onDuplicate={() => handleDuplicate(t)}
                      onReset={t.overridden ? () => handleReset(t) : undefined}
                      onExport={() => handleExport(t)}
                      onInstallSkill={handleInstallSkill}
                    />
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
                  Your templates
                </h3>
                {userTemplates.length === 0 ? (
                  <div className="border border-dashed border-border bg-secondary/20 p-8 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      You haven&apos;t saved any templates yet.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Duplicate a built-in role to customize it, or create a blank template.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {userTemplates.map(t => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        installedSkills={installedSkills}
                        onUse={() => setInstantiateTarget(t)}
                        onEdit={() => setEditTarget(t)}
                        onDuplicate={() => handleDuplicate(t)}
                        onDelete={() => handleDelete(t)}
                        onExport={() => handleExport(t)}
                        onInstallSkill={handleInstallSkill}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {instantiateTarget && (
        <InstantiateDialog
          template={instantiateTarget}
          onClose={() => setInstantiateTarget(null)}
          onCreated={() => { setInstantiateTarget(null); onClose(); }}
        />
      )}

      {showCreate && (
        <TemplateFormDialog
          installedSkills={installedSkills}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      {editTarget && (
        <TemplateFormDialog
          initialTemplate={editTarget}
          installedSkills={installedSkills}
          onClose={() => setEditTarget(null)}
          onSubmit={handleUpdate}
        />
      )}

      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onImport={importTemplates}
        />
      )}

      <TerminalDialog
        open={!!installSkillTarget}
        repo={installSkillTarget?.repo ?? ''}
        title={installSkillTarget?.title ?? ''}
        availableProviders={['claude', 'codex', 'gemini']}
        onClose={() => {
          setInstallSkillTarget(null);
          refreshSkills();
        }}
      />

      {installError && (
        <div className="fixed bottom-4 right-4 z-[80] max-w-sm bg-card border border-warning/40 px-4 py-3 flex flex-col gap-2">
          <p className="text-xs text-foreground">{installError}</p>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setInstallError(null)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
            >
              Dismiss
            </button>
            <button
              onClick={() => { setInstallError(null); router.push('/skills'); }}
              className="text-xs bg-foreground text-background font-medium px-2 py-1 hover:bg-foreground/90"
            >
              Open Skills page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
