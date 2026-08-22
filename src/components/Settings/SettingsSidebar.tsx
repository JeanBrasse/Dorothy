import Link from 'next/link';
import { CalendarClock, ChevronRight, ExternalLink } from 'lucide-react';
import { SECTION_GROUPS } from './constants';
import type { SettingsSection } from './types';

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export const SettingsSidebar = ({ activeSection, onSectionChange }: SettingsSidebarProps) => {
  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="w-52 shrink-0 hidden lg:block overflow-y-auto">
        <div className="space-y-1">
          {SECTION_GROUPS.map((group) => {
            const Icon = group.icon;
            const isOpen = group.children.some(c => c.id === activeSection);
            return (
              <div key={group.id}>
                <button
                  onClick={() => onSectionChange(group.children[0].id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${isOpen
                    ? 'bg-secondary text-foreground border-l border-primary/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{group.label}</span>
                  {isOpen && <ChevronRight className="w-4 h-4 ml-auto" />}
                </button>

                {isOpen && (
                  <div className="pl-3 py-1 space-y-0.5">
                    {group.children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => onSectionChange(child.id)}
                        className={`w-full flex items-center gap-2 pl-4 pr-3 py-1.5 text-left text-xs transition-colors ${child.id === activeSection
                          ? 'text-foreground bg-secondary/60'
                          : 'text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        {child.label}
                      </button>
                    ))}

                    {/* Schedules live on their own page: this is the bridge to it. */}
                    {group.id === 'hermes' && (
                      <Link
                        href="/crons"
                        className="w-full flex items-center gap-2 pl-4 pr-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <CalendarClock className="w-3 h-3" />
                        Schedules
                        <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Mobile Section Selector */}
      <div className="lg:hidden mb-4 shrink-0">
        <select
          value={activeSection}
          onChange={(e) => onSectionChange(e.target.value as SettingsSection)}
          className="w-full px-3 py-2 bg-secondary border border-border text-sm"
        >
          {SECTION_GROUPS.map((group) => (
            <optgroup key={group.id} label={group.label}>
              {group.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </>
  );
};
