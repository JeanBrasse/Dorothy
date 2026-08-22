import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X,
  Sparkles,
  Search,
  Check,
  ChevronDown,
  Filter,
  Download,
  CheckCircle,
  Package,
  BookOpen,
  Wrench,
} from 'lucide-react';
import { SKILLS_DATABASE, SKILL_CATEGORIES, fetchSkillsFromMarketplace, type Skill } from '@/lib/skills-database';
import type { ClaudeSkill } from '@/lib/claude-code';
import type { AgentProvider } from '@/types/electron';
import { PROVIDER_REGISTRY } from '@/lib/providers';
import ProviderBadge from '@/components/ProviderBadge';

interface StepToolsProps {
  selectedSkills: string[];
  onToggleSkill: (name: string) => void;
  allInstalledSkills: ClaudeSkill[];
  installedSkillSet: Set<string>;
  onInstallSkill: (skill: Skill) => void;
  provider: AgentProvider;
  installedSkillsByProvider: Record<string, string[]>;
}

/** CLI-based providers that have their own skill directories */
const PROVIDER_IDS = PROVIDER_REGISTRY.filter((p) => p.requiresCli).map((p) => p.id);

// Module-level memo: StepTools unmounts on every step change, so without this
// each visit to the Tools step would re-hit the marketplace.
let cachedLiveSkills: Skill[] | null = null;

const StepTools = React.memo(function StepTools({
  selectedSkills,
  onToggleSkill,
  allInstalledSkills,
  installedSkillSet,
  onInstallSkill,
  provider,
  installedSkillsByProvider,
}: StepToolsProps) {
  const [skillSearch, setSkillSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  // Live marketplace catalog; the bundled SKILLS_DATABASE snapshot is the
  // fallback when the fetch fails or hasn't landed yet.
  const [liveSkills, setLiveSkills] = useState<Skill[] | null>(cachedLiveSkills);

  useEffect(() => {
    if (cachedLiveSkills) return;
    fetchSkillsFromMarketplace()
      .then(s => {
        if (s && s.length > 0) {
          cachedLiveSkills = s;
          setLiveSkills(s);
        }
      })
      .catch(() => {});
  }, []);

  const isSkillInstalled = useCallback(
    (name: string) => installedSkillSet.has(name.toLowerCase()),
    [installedSkillSet]
  );

  const isSkillInstalledOn = useCallback(
    (name: string, providerId: string): boolean => {
      const skills = installedSkillsByProvider[providerId];
      if (!skills) return false;
      return skills.some(s => s.toLowerCase() === name.toLowerCase());
    },
    [installedSkillsByProvider]
  );

  const isSkillInstalledAnywhere = useCallback(
    (name: string): boolean => {
      for (const skills of Object.values(installedSkillsByProvider)) {
        if (skills.some(s => s.toLowerCase() === name.toLowerCase())) return true;
      }
      return false;
    },
    [installedSkillsByProvider]
  );

  const filteredSkills = useMemo(() => {
    let skills = liveSkills ?? SKILLS_DATABASE;

    if (skillSearch) {
      const q = skillSearch.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.repo.toLowerCase().includes(q) ||
          (s.category || '').toLowerCase().includes(q)
      );
    }

    if (selectedCategory) {
      skills = skills.filter((s) => s.category && s.category === selectedCategory);
    }

    return skills;
  }, [liveSkills, skillSearch, selectedCategory]);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h3 className="text-lg font-medium mb-1 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-accent-purple" />
          Tools
        </h3>
        <p className="text-text-secondary text-sm">
          Extend your agent with skills and connect knowledge sources
        </p>
      </div>

      {/* ─── Skills Section ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-purple" />
            <span className="font-medium text-sm">Skills</span>
          </div>
          <span className="text-xs text-accent-purple">{selectedSkills.length} selected</span>
        </div>

        {/* Selected Skills Chips */}
        {selectedSkills.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-accent-purple/10 border border-accent-purple/20">
            {selectedSkills.map((skill) => (
              <button
                key={skill}
                onClick={() => onToggleSkill(skill)}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent-purple/20 text-accent-purple text-xs hover:bg-accent-purple/30 transition-colors"
              >
                {skill}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              placeholder="Search skills..."
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowCategoryDropdown(prev => !prev)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              <Filter className="w-3.5 h-3.5" />
              {selectedCategory || 'All'}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showCategoryDropdown && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg min-w-[160px] overflow-hidden">
                <button
                  onClick={() => { setSelectedCategory(null); setShowCategoryDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors ${!selectedCategory ? 'text-accent-purple font-medium' : ''}`}
                >
                  All
                </button>
                {SKILL_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setShowCategoryDropdown(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors ${selectedCategory === cat ? 'text-accent-purple font-medium' : ''}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Skills Card List */}
        <div className="border border-border rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
          {filteredSkills.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No skills match{selectedCategory ? ` "${selectedCategory}"` : ''}{skillSearch ? ` for "${skillSearch}"` : ''}.
            </div>
          )}
          {filteredSkills.map((skill) => {
            const isSelected = selectedSkills.includes(skill.name);
            const installedOnProvider = isSkillInstalled(skill.name);
            const installedAnywhere = isSkillInstalledAnywhere(skill.name);

            return (
              <div
                key={`${skill.repo}-${skill.name}`}
                className={`flex items-center gap-3 px-3 py-2.5 border-b border-border/50 last:border-b-0 transition-colors ${
                  isSelected ? 'bg-accent-purple/5' : 'hover:bg-secondary/50'
                }`}
              >
                {/* Icon */}
                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${installedAnywhere ? 'bg-primary/10' : 'bg-secondary'}`}>
                  {installedAnywhere ? (
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Package className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </div>

                {/* Name + provider dots */}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{skill.name}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {PROVIDER_IDS.map(id =>
                      isSkillInstalledOn(skill.name, id) ? (
                        <ProviderBadge key={id} provider={id} />
                      ) : null
                    )}
                  </div>
                </div>

                {/* Category badge */}
                {skill.category && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded hidden sm:inline-block shrink-0">
                    {skill.category}
                  </span>
                )}

                {/* Action button */}
                {installedOnProvider ? (
                  <button
                    onClick={() => onToggleSkill(skill.name)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors shrink-0 ${
                      isSelected
                        ? 'bg-accent-purple/15 text-accent-purple'
                        : 'bg-foreground text-background hover:bg-foreground/90'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3 h-3" />
                        Added
                      </>
                    ) : (
                      'Add'
                    )}
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onInstallSkill(skill);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors shrink-0"
                  >
                    <Download className="w-3 h-3" />
                    Install
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
});


export default StepTools;
