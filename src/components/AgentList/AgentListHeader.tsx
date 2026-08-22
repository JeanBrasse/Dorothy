'use client';

import { Plus, Users } from 'lucide-react';

interface AgentListHeaderProps {
  totalCount: number;
  runningCount: number;
  onNewAgentClick: () => void;
  onDeployTeamClick: () => void;
}

/**
 * Two actions only: one agent, or a whole team. Templates and the
 * orchestrator (Super Agent) are choices inside the agent creation flow -
 * not competing top-level buttons.
 */
export function AgentListHeader({
  totalCount,
  runningCount,
  onNewAgentClick,
  onDeployTeamClick,
}: AgentListHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 lg:mb-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">Agents</h1>
        <span className="font-mono text-xs text-muted-foreground">
          {totalCount} total · {runningCount} running
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onDeployTeamClick}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-border bg-card text-muted-foreground font-medium hover:bg-accent/50 hover:text-foreground transition-colors text-sm cursor-pointer"
          title="Deploy a whole team of agents onto a project"
        >
          <Users className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">+ Team</span>
        </button>

        <button
          onClick={onNewAgentClick}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors text-sm cursor-pointer"
          title="Create an agent - from scratch, from a template, or as an orchestrator"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Agent</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>
    </div>
  );
}
