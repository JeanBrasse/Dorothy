'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, Loader2, Rocket, Save, Search, Trash2, X } from 'lucide-react';
import type { TeamTemplate, TeamTemplateMember } from '@/types/electron';
import { useElectronAgents, useElectronFS } from '@/hooks/useElectron';
import { useElectronTeamTemplates } from '@/hooks/useElectronTeamTemplates';
import { PROVIDER_REGISTRY, computeProviderAvailability } from '@/lib/providers';
import { Dropdown } from '@/components/ui';

interface DeployTeamDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful deployment with the ids of the created agents. */
  onDeployed?: (agentIds: string[]) => void;
}

export function DeployTeamDialog({ open, onClose, onDeployed }: DeployTeamDialogProps) {
  const { agents, createAgent, updateAgent } = useElectronAgents();
  const { projects, openFolderDialog } = useElectronFS();
  const { teams, create: createTeam, remove: removeTeam } = useElectronTeamTemplates();

  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!open) return;
    Promise.all([
      window.electronAPI?.cliPaths?.detect(),
      window.electronAPI?.appSettings?.get(),
    ]).then(([paths, settings]) => {
      setAvailability(computeProviderAvailability(paths as Record<string, string | undefined> | undefined, settings));
    });
  }, [open]);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  // Non-null while the inline "save project as team" name input is showing.
  // (window.prompt is not available in Electron renderers.)
  const [pendingTeamName, setPendingTeamName] = useState<string | null>(null);

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
      setPendingTeamName(null);
    }
  }, [open]);

  const selectedTeam = useMemo(
    () => teams.find(t => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  );

  // Editable working copy of the selected team's members: every deploy
  // parameter (model, effort, prompt, branch, name) can be tuned per member
  // before deploying, and optionally saved back as a custom team.
  const [editedMembers, setEditedMembers] = useState<TeamTemplateMember[]>([]);
  const [expandedMember, setExpandedMember] = useState<number | null>(null);
  // Which members actually get deployed; extras can be appended too.
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  useEffect(() => {
    const members = selectedTeam ? selectedTeam.members.map(m => ({ ...m })) : [];
    setEditedMembers(members);
    setSelectedIdx(new Set(members.map((_, i) => i)));
    setExpandedMember(null);
  }, [selectedTeam]);

  function toggleMember(i: number) {
    setSelectedIdx(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function addExtraMember() {
    setEditedMembers(prev => {
      const next = [...prev, {
        name: `Engineer ${prev.length + 1}`,
        character: 'robot' as const,
        provider: 'claude' as const,
        permissionMode: 'auto' as const,
        skills: [],
      }];
      setSelectedIdx(sel => new Set([...sel, next.length - 1]));
      setExpandedMember(next.length - 1);
      return next;
    });
  }

  function removeMember(i: number) {
    setEditedMembers(prev => prev.filter((_, idx) => idx !== i));
    setSelectedIdx(prev => new Set(Array.from(prev).filter(x => x !== i).map(x => (x > i ? x - 1 : x))));
    setExpandedMember(null);
  }

  const membersDirty = useMemo(
    () => !!selectedTeam && JSON.stringify(editedMembers) !== JSON.stringify(selectedTeam.members),
    [selectedTeam, editedMembers]
  );

  function patchMember(i: number, patch: Partial<TeamTemplateMember>) {
    setEditedMembers(prev => prev.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  }

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
    const existingNames = new Set(projectAgents.map(a => a.name));
    const createdIds: string[] = [];
    const issues: string[] = [];

    const membersToDeploy = (editedMembers.length > 0 ? editedMembers : selectedTeam.members)
      .filter((_, i) => selectedIdx.size === 0 || selectedIdx.has(i));
    for (const member of membersToDeploy) {
      const agentName = `${member.name} - ${projectName}`;
      // Re-deploying the same team must not double up agents: two agents with
      // the same name would share one worktree/branch and fight over files.
      if (existingNames.has(agentName)) {
        issues.push(`${member.name}: already deployed on this project - skipped.`);
        continue;
      }
      setProgress(`Creating ${member.name}…`);
      try {
        const resolvedModel = member.provider !== 'local' && member.model && member.model !== 'default'
          ? member.model
          : undefined;
        const agent = await createAgent({
          projectPath,
          skills: member.skills,
          character: member.character,
          name: agentName,
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
        // agent:create swallows git-worktree failures and falls back to the
        // project root - surface that instead of reporting a clean deploy.
        if (member.worktreeBranch && !agent.branchName) {
          issues.push(`${member.name}: worktree "${member.worktreeBranch}" could not be created (not a git repo, or branch busy) - agent works in the project root.`);
        }
        if (member.savedPrompt?.trim()) {
          await updateAgent({ id: agent.id, savedPrompt: member.savedPrompt });
        }
      } catch (err) {
        console.error(`Failed to create team member "${member.name}":`, err);
        issues.push(`${member.name}: ${err instanceof Error ? err.message : 'creation failed'}`);
      }
    }

    setProgress(null);
    setDeploying(false);
    if (issues.length > 0) {
      setErrors(issues);
      if (createdIds.length > 0) {
        setSaveMessage(`${createdIds.length} agent${createdIds.length === 1 ? '' : 's'} created.`);
        onDeployed?.(createdIds);
      }
      return;
    }
    onDeployed?.(createdIds);
    onClose();
  }

  async function handleConfirmSaveTeam() {
    const name = pendingTeamName?.trim();
    if (!name) return;

    if (membersDirty && editedMembers.length > 0) {
      try {
        const result = await createTeam({ name, members: editedMembers });
        if (result.success && result.team) {
          setSelectedTeamId(result.team.id);
          setSaveMessage(`Saved "${result.team.name}" (${editedMembers.length} members).`);
          setPendingTeamName(null);
        } else {
          setErrors([result.error ?? 'Failed to save team']);
        }
      } catch (err) {
        setErrors([err instanceof Error ? err.message : 'Failed to save team']);
      }
      return;
    }

    if (!projectPath || projectAgents.length === 0) return;
    const projectName = projectPath.split('/').pop() || 'project';
    // Deployed agents are named "<role> - <project>"; strip the suffix so
    // save>redeploy cycles don't accrete " - projA - projB" onto member names.
    const suffix = ` - ${projectName}`;

    const members: Partial<TeamTemplateMember>[] = projectAgents.map(a => {
      const rawName = a.name || `Agent ${a.id.slice(0, 4)}`;
      return {
        name: rawName.endsWith(suffix) ? rawName.slice(0, -suffix.length) : rawName,
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
      };
    });

    try {
      const result = await createTeam({ name, members });
      if (result.success && result.team) {
        setSelectedTeamId(result.team.id);
        setSaveMessage(`Saved "${result.team.name}" (${members.length} member${members.length === 1 ? '' : 's'}).`);
        setPendingTeamName(null);
      } else {
        setErrors([result.error ?? 'Failed to save team']);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to save team']);
    }
  }

  async function handleDeleteTeam(team: TeamTemplate) {
    if (!confirm(`Delete team "${team.name}"?`)) return;
    await removeTeam(team.id);
    if (selectedTeamId === team.id) setSelectedTeamId(null);
  }

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget && !deploying) onClose(); }}
    >
      <div ref={dialogRef} className="bg-card border border-border w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Rocket className="w-4 h-4 text-primary" />
              Deploy a team
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick a team and a project - every member is created in one go, each on its own worktree branch.
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
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Member editor - every deploy parameter is tunable per member */}
          {selectedTeam && editedMembers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-foreground">
                  Members <span className="text-muted-foreground font-normal">- click a member to edit its model, effort, branch and instructions</span>
                </label>
                <div className="flex items-center gap-2">
                  {membersDirty && <span className="text-[10px] text-primary">edited</span>}
                  <button onClick={addExtraMember} className="text-[10px] text-primary hover:underline">
                    + Add member
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {editedMembers.map((m, i) => (
                  <div key={i} className="border border-border bg-secondary/30">
                    <div className="w-full flex items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIdx.has(i)}
                        onChange={() => toggleMember(i)}
                        className="accent-[var(--primary)] shrink-0"
                        title="Deploy this member"
                      />
                      <button
                        onClick={() => setExpandedMember(expandedMember === i ? null : i)}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                      <span className="text-xs font-medium text-foreground">{m.name}</span>
                      {m.orchestratorMode && <span className="text-[10px] px-1 py-px bg-primary/10 text-primary">orchestrator</span>}
                      {m.worktreeBranch && <span className="text-[10px] font-mono text-muted-foreground">⎇ {m.worktreeBranch}</span>}
                      <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                        {m.provider || 'claude'} / {m.model || 'default'} / {m.effort || 'default'}
                      </span>
                      </button>
                      <button
                        onClick={() => removeMember(i)}
                        className="shrink-0 p-1 text-muted-foreground hover:text-danger"
                        title="Remove from this deployment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    {expandedMember === i && (
                      <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-[10px] text-muted-foreground mb-0.5">Name</label>
                            <input
                              value={m.name}
                              onChange={e => patchMember(i, { name: e.target.value })}
                              className="w-full px-2 py-1 bg-card border border-border text-xs text-foreground outline-none focus:border-primary/40"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] text-muted-foreground mb-0.5">Worktree branch</label>
                            <input
                              value={m.worktreeBranch || ''}
                              onChange={e => patchMember(i, { worktreeBranch: e.target.value || undefined })}
                              placeholder="(project root)"
                              className="w-full px-2 py-1 bg-card border border-border text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-[10px] text-muted-foreground mb-0.5">Provider</label>
                            <Dropdown
                              value={m.provider || 'claude'}
                              options={PROVIDER_REGISTRY.filter(p => availability[p.id] !== false).map(p => ({ value: p.id, label: p.label }))}
                              onChange={v => patchMember(i, { provider: v as TeamTemplateMember['provider'], model: undefined })}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] text-muted-foreground mb-0.5">Model</label>
                            <Dropdown
                              value={m.model || ''}
                              placeholder="Default"
                              options={[{ value: '', label: 'Default' }, ...((PROVIDER_REGISTRY.find(p => p.id === (m.provider || 'claude'))?.models ?? [])
                                .filter(mo => mo.id !== 'default')
                                .map(mo => ({ value: mo.id, label: mo.name, hint: mo.description })))]}
                              onChange={v => patchMember(i, { model: v || undefined })}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] text-muted-foreground mb-0.5">Effort</label>
                            <Dropdown
                              value={m.effort || ''}
                              placeholder="Default"
                              options={[{ value: '', label: 'Default' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'xhigh', label: 'X-High' }, { value: 'max', label: 'Max' }]}
                              onChange={v => patchMember(i, { effort: (v || undefined) as TeamTemplateMember['effort'] })}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] text-muted-foreground mb-0.5">Permissions</label>
                            <Dropdown
                              value={m.permissionMode}
                              options={[{ value: 'normal', label: 'Normal' }, { value: 'auto', label: 'Auto-accept' }, { value: 'bypass', label: 'Bypass' }]}
                              onChange={v => patchMember(i, { permissionMode: v as TeamTemplateMember['permissionMode'] })}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-0.5">Instructions (saved prompt - the agent&apos;s role)</label>
                          <textarea
                            value={m.savedPrompt || ''}
                            onChange={e => patchMember(i, { savedPrompt: e.target.value || undefined })}
                            rows={3}
                            className="w-full px-2 py-1.5 bg-card border border-border text-xs text-foreground outline-none focus:border-primary/40 resize-y"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
                      projectPath === p.path ? 'bg-primary/10 border-l border-l-primary/60' : ''
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
          {pendingTeamName !== null ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                autoFocus
                value={pendingTeamName}
                onChange={e => setPendingTeamName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirmSaveTeam(); }}
                placeholder="Team name"
                maxLength={40}
                className="px-2 py-1.5 bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 w-44"
              />
              <button
                onClick={handleConfirmSaveTeam}
                disabled={!pendingTeamName.trim()}
                className="px-2.5 py-1.5 text-xs bg-foreground text-background font-medium hover:bg-foreground/90 disabled:opacity-40"
              >
                Save
              </button>
              <button
                onClick={() => setPendingTeamName(null)}
                className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                const base = membersDirty && selectedTeam
                  ? `${selectedTeam.name} (custom)`
                  : `${projectPath?.split('/').pop() || 'project'} team`;
                setPendingTeamName(base);
              }}
              disabled={deploying || (membersDirty ? false : (!projectPath || projectAgents.length === 0))}
              title={membersDirty
                ? 'Save your edited members as a reusable custom team'
                : (projectPath ? `Save the ${projectAgents.length} agent(s) of this project as a reusable team` : 'Pick a project first - or edit a team\'s members to save a custom team')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border bg-card text-foreground hover:bg-accent/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-3 h-3" />
              {membersDirty ? 'Save edited team' : `Save project as team${projectAgents.length > 0 ? ` (${projectAgents.length})` : ''}`}
            </button>
          )}
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
