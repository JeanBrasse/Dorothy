'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, Loader2, Rocket, Save, Search, Trash2, X } from 'lucide-react';
import type { TeamTemplate, TeamTemplateMember } from '@/types/electron';
import { useElectronAgents, useElectronFS } from '@/hooks/useElectron';
import { useElectronTeamTemplates } from '@/hooks/useElectronTeamTemplates';

interface DeployTeamDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful deployment with the ids of the created agents. */
  onDeployed?: (agentIds: string[]) => void;
}

export function DeployTeamDialog({ open, onClose, onDeployed }: DeployTeamDialogProps) {
  const { agents, createAgent } = useElectronAgents();
  const { projects, openFolderDialog } = useElectronFS();
  const { teams, create: createTeam, remove: removeTeam } = useElectronTeamTemplates();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !deploying) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, deploying, onClose]);

  // Reset transient state each time the dialog opens
  useEffect(() => {
    if (open) {
      setDeploying(false);
      setProgress(null);
      setErrors([]);
      setSaveMessage(null);
    }
  }, [open]);

  const selectedTeam = useMemo(
    () => teams.find(t => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  );

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q));
  }, [projects, search]);

  const projectAgents = useMemo(
    () => (projectPath ? agents.filter(a => a.projectPath === projectPath) : []),
    [agents, projectPath]
  );

  if (!open) return null;

  async function handlePickFolder() {
    try {
      const picked = await openFolderDialog();
      if (typeof picked === 'string' && picked) setProjectPath(picked);
    } catch (err) {
      console.error('openFolderDialog failed:', err);
    }
  }

  async function handleDeploy() {
    if (!selectedTeam || !projectPath) return;
    setDeploying(true);
    setErrors([]);
    const projectName = projectPath.split('/').pop() || 'project';
    const createdIds: string[] = [];
    const failed: string[] = [];

    for (const member of selectedTeam.members) {
      setProgress(`Creating ${member.name}…`);
      try {
        const resolvedModel = member.provider !== 'local' && member.model && member.model !== 'default'
          ? member.model
          : undefined;
        const agent = await createAgent({
          projectPath,
          skills: member.skills,
          character: member.character,
          name: `${member.name} — ${projectName}`,
          permissionMode: member.permissionMode,
          effort: member.effort,
          provider: member.provider,
          model: resolvedModel,
          localModel: member.localModel,
          worktree: member.worktreeBranch
            ? { enabled: true, branchName: member.worktreeBranch }
            : undefined,
          orchestratorMode: member.orchestratorMode,
        });
        createdIds.push(agent.id);
      } catch (err) {
        console.error(`Failed to create team member "${member.name}":`, err);
        failed.push(`${member.name}: ${err instanceof Error ? err.message : 'creation failed'}`);
      }
    }

    setProgress(null);
    setDeploying(false);
    if (failed.length > 0) {
      setErrors(failed);
      if (createdIds.length > 0) onDeployed?.(createdIds);
      return;
    }
    onDeployed?.(createdIds);
    onClose();
  }

  async function handleSaveProjectAsTeam() {
    if (!projectPath || projectAgents.length === 0) return;
    const projectName = projectPath.split('/').pop() || 'project';
    const name = window.prompt('Save this project\'s agents as a team — name?', `${projectName} team`);
    if (!name?.trim()) return;

    const members: Partial<TeamTemplateMember>[] = projectAgents.map(a => ({
      name: a.name || `Agent ${a.id.slice(0, 4)}`,
      character: a.character,
      provider: a.provider,
      model: a.model,
      localModel: a.localModel,
      permissionMode: a.permissionMode ?? (a.skipPermissions ? 'auto' : 'normal'),
      effort: a.effort,
      skills: a.skills,
      savedPrompt: a.savedPrompt,
      worktreeBranch: a.branchName,
      orchestratorMode: a.orchestratorMode,
    }));

    const result = await createTeam({ name: name.trim(), members });
    if (result.success && result.team) {
      setSelectedTeamId(result.team.id);
      setSaveMessage(`Saved "${result.team.name}" (${members.length} member${members.length === 1 ? '' : 's'}).`);
    } else {
      setErrors([result.error ?? 'Failed to save team']);
    }
  }

  async function handleDeleteTeam(team: TeamTemplate) {
    if (!confirm(`Delete team "${team.name}"?`)) return;
    await removeTeam(team.id);
    if (selectedTeamId === team.id) setSelectedTeamId(null);
  }

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget && !deploying) onClose(); }}
    >
      <div ref={dialogRef} className="bg-card border border-border w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Rocket className="w-4 h-4 text-primary" />
              Deploy a team
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick a team and a project — every member is created in one go, each on its own worktree branch.
            </p>
          </div>
          <button onClick={onClose} disabled={deploying} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-40" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Team picker */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Team</label>
            <div className="space-y-1.5">
              {teams.map(team => (
                <div
                  key={team.id}
                  className={`border transition-colors ${
                    selectedTeamId === team.id ? 'border-primary/60 bg-primary/5' : 'border-border bg-secondary/30 hover:bg-accent/30'
                  }`}
                >
                  <button
                    onClick={() => setSelectedTeamId(team.id)}
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-left"
                  >
                    <span className="text-lg leading-none mt-0.5">{team.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{team.name}</span>
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1 py-px">{team.members.length} agents</span>
                        {!team.builtin && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={e => { e.stopPropagation(); handleDeleteTeam(team); }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); handleDeleteTeam(team); } }}
                            className="ml-auto p-0.5 text-muted-foreground hover:text-destructive cursor-pointer"
                            title="Delete team"
                          >
                            <Trash2 className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{team.description}</p>
                      {selectedTeamId === team.id && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {team.members.map((m, i) => (
                            <span key={`${m.name}-${i}`} className="text-[10px] px-1.5 py-0.5 bg-secondary border border-border text-foreground">
                              {m.name}{m.worktreeBranch ? ` · ${m.worktreeBranch}` : ''}{m.orchestratorMode ? ' · orchestrator' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Project picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-foreground">Project</label>
              <button
                onClick={handlePickFolder}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <FolderOpen className="w-3 h-3" />
                Pick another folder…
              </button>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search your projects…"
                className="w-full pl-7 pr-2 py-1.5 bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
              />
            </div>
            <div className="max-h-40 overflow-y-auto border border-border bg-secondary/30">
              {filteredProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No projects match. Use &ldquo;Pick another folder…&rdquo; above.</p>
              ) : (
                filteredProjects.map(p => (
                  <button
                    key={p.path}
                    onClick={() => setProjectPath(p.path)}
                    className={`w-full flex flex-col items-start px-3 py-2 text-left text-xs hover:bg-primary/5 transition-colors ${
                      projectPath === p.path ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                    }`}
                  >
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate w-full">{p.path}</span>
                  </button>
                ))
              )}
            </div>
            {projectPath && !filteredProjects.some(p => p.path === projectPath) && (
              <p className="text-[11px] text-muted-foreground mt-1.5">Selected: <span className="text-foreground">{projectPath}</span></p>
            )}
          </div>

          {saveMessage && (
            <p className="text-xs text-foreground bg-primary/10 border border-primary/30 px-2 py-1.5">{saveMessage}</p>
          )}

          {errors.length > 0 && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 px-2 py-1.5 space-y-0.5">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2">
          <button
            onClick={handleSaveProjectAsTeam}
            disabled={!projectPath || projectAgents.length === 0 || deploying}
            title={projectPath ? `Save the ${projectAgents.length} agent(s) of this project as a reusable team` : 'Pick a project first'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border bg-card text-foreground hover:bg-accent/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-3 h-3" />
            Save project as team{projectAgents.length > 0 ? ` (${projectAgents.length})` : ''}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              disabled={deploying}
            >
              Cancel
            </button>
            <button
              onClick={handleDeploy}
              disabled={!selectedTeam || !projectPath || deploying}
              className="px-3 py-1.5 text-xs bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {deploying && <Loader2 className="w-3 h-3 animate-spin" />}
              {deploying ? (progress ?? 'Deploying…') : `Deploy${selectedTeam ? ` ${selectedTeam.members.length} agents` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
