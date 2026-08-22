'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
  BarChart2,
  Columns,
  CalendarClock,
  FileDiff,
  ScrollText,
  Moon,
  Sun,
  Archive,
  Brain,
  Gift,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { LATEST_RELEASE, WHATS_NEW_STORAGE_KEY } from '@/data/changelog';

import { useStore } from '@/store';
import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard', shortcut: '1' },
  { href: '/agents', icon: Bot, label: 'Agents', shortcut: '2' },
  { href: '/kanban', icon: Columns, label: 'Kanban', shortcut: '3' },
  { href: '/crons', icon: CalendarClock, label: 'Schedules', shortcut: '4' },
  { href: '/review', icon: FileDiff, label: 'Review', shortcut: '5' },
  { href: '/logs', icon: ScrollText, label: 'Logs', shortcut: '6' },
  { href: '/vault', icon: Archive, label: 'Vault', shortcut: '7' },
  { href: '/projects', icon: FolderKanban, label: 'Projects', shortcut: '8' },
  { href: '/skills', icon: Sparkles, label: 'Extensions', shortcut: '9' },
  { href: '/usage', icon: BarChart2, label: 'Usage', shortcut: '0' },
  { href: '/memory', icon: Brain, label: 'Brain' },
];

interface SidebarProps {
  isMobile?: boolean;
}

function useWhatsNewBadge() {
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    const check = () => {
      const lastSeen = Number(localStorage.getItem(WHATS_NEW_STORAGE_KEY) || '0');
      setHasNew(LATEST_RELEASE.id > lastSeen);
    };
    check();
    window.addEventListener('whats-new-seen', check);
    return () => window.removeEventListener('whats-new-seen', check);
  }, []);

  return hasNew;
}

/**
 * Cmd/Ctrl + digit jumps to a page. The shortcuts were declared next to each
 * nav item and bound to nothing, so they were decoration until now.
 */
function useNavShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;

      const item = navItems.find(nav => nav.shortcut && nav.shortcut === e.key);
      if (!item) return;
      e.preventDefault();
      router.push(item.href);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);
}

export default function Sidebar({ isMobile = false }: SidebarProps) {
  const pathname = usePathname();
  useNavShortcuts();
  const { mobileMenuOpen, setMobileMenuOpen, darkMode, toggleDarkMode, vaultUnreadCount } = useStore();
  const whatsNewHasNew = useWhatsNewBadge();

  // For mobile, sidebar is always expanded (240px) when open
  const sidebarWidth = 240;
  const showLabels = true;

  // Close mobile menu when navigating
  const handleNavClick = () => {
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  // Desktop sidebar
  if (!isMobile) {
    return (
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-screen bg-card border-r border-border flex-col z-50 hidden lg:flex"
      >
        {/* Logo - top area also serves as drag region for macOS traffic lights */}
        {/* px-6 + a 20px mark slot + gap-3 puts the mark on the nav icons'
            left edge and the wordmark on the nav labels'. */}
        <div className="window-drag flex items-center px-6 pt-5 pb-4 border-b border-border shrink-0">
          <Brand
            showWordmark={showLabels}
            markClassName="w-2.5 h-2.5"
            wordmarkClassName="font-serif text-xl text-foreground"
            markSlotClassName="w-5"
            gapClassName="gap-3"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  group flex items-center gap-3 px-3 py-2.5 transition-all duration-150 cursor-pointer
                  ${isActive
                    ? 'bg-primary/20 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }
                `}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {item.href === '/vault' && vaultUnreadCount > 0 && !showLabels && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center text-[8px] font-bold bg-primary text-primary-foreground rounded-full px-0.5">
                      {vaultUnreadCount}
                    </span>
                  )}
                </div>
                {showLabels && (
                  <span className="text-sm flex-1">
                    {item.label}
                  </span>
                )}
                {item.href === '/vault' && vaultUnreadCount > 0 && showLabels && (
                  <span className="min-w-[20px] h-[20px] flex items-center justify-center text-[10px] font-medium bg-primary text-primary-foreground rounded-full px-1">
                    {vaultUnreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* What's New + Status indicator */}
        <div className="border-t border-border">
          {showLabels && (
            <>
              <Link
                href="/whats-new"
                className={`flex items-center gap-3 px-5 py-3 transition-colors cursor-pointer ${
                  pathname === '/whats-new'
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <div className="relative">
                  <Gift className="w-5 h-5" />
                  {whatsNewHasNew && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full" />
                  )}
                </div>
                <span className="text-sm flex-1">What&apos;s New</span>
                {whatsNewHasNew && (
                  <span className="min-w-[20px] h-[20px] flex items-center justify-center text-[10px] font-bold bg-danger text-white rounded-full px-1">
                    1
                  </span>
                )}
              </Link>
              <div className="flex items-center gap-3 px-5 py-3 border-t border-border text-muted-foreground text-sm">
                <span className="relative flex w-5 h-5 items-center justify-center">
                  <span className=" absolute inline-flex h-2 w-2 rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                <span>Connected</span>
              </div>
            </>
          )}
          {!showLabels && (
            <Link
              href="/whats-new"
              className={`flex items-center px-3 py-2.5 transition-colors ${
                pathname === '/whats-new'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <div className="relative">
                <Gift className="w-5 h-5" />
                {whatsNewHasNew && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full" />
                )}
              </div>
            </Link>
          )}
        </div>

        {/* Settings */}
        <div className="border-t border-border">
          <Link
            href="/settings"
            className={`
              flex items-center gap-3 px-5 py-3 transition-colors cursor-pointer
              ${pathname === '/settings' || pathname.startsWith('/settings/')
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }
            `}
          >
            <Settings className="w-5 h-5" />
            {showLabels && <span className="text-sm">Settings</span>}
          </Link>
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center gap-3 px-5 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {showLabels && <span className="text-sm">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
        </div>
      </motion.aside>
    );
  }

  // Mobile sidebar (drawer)
  return (
    <AnimatePresence>
      {mobileMenuOpen && (
        <motion.aside
          initial={{ x: -sidebarWidth }}
          animate={{ x: 0 }}
          exit={{ x: -sidebarWidth }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-50 lg:hidden"
          style={{ width: sidebarWidth }}
        >
          {/* Logo */}
          <div className="h-14 flex items-center px-4 border-b border-border">
            <Brand markClassName="w-2.5 h-2.5" wordmarkClassName="font-serif text-xl text-foreground" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleNavClick}
                  className={`
                    group flex items-center gap-3 px-3 py-2.5 transition-all duration-150
                    ${isActive
                      ? 'bg-primary/20 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }
                  `}
                >
                  <div className="relative">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm flex-1">
                    {item.label}
                  </span>
                  {item.href === '/vault' && vaultUnreadCount > 0 && (
                    <span className="min-w-[20px] h-[20px] flex items-center justify-center text-[10px] font-medium bg-primary text-primary-foreground rounded-full px-1">
                      {vaultUnreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* What's New + Status indicator */}
          <div className="border-t border-border">
            <Link
              href="/whats-new"
              onClick={handleNavClick}
              className={`flex items-center gap-3 px-5 py-3 transition-colors cursor-pointer ${
                pathname === '/whats-new'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <div className="relative">
                <Gift className="w-5 h-5" />
                {whatsNewHasNew && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full" />
                )}
              </div>
              <span className="text-sm flex-1">What&apos;s New</span>
              {whatsNewHasNew && (
                <span className="min-w-[20px] h-[20px] flex items-center justify-center text-[10px] font-bold bg-danger text-white rounded-full px-1">
                  1
                </span>
              )}
            </Link>
            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className=" absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                <span>Connected</span>
              </div>
            </div>
          </div>

          {/* Settings & Theme Toggle */}
          <div className="border-t border-border">
            <Link
              href="/settings"
              onClick={handleNavClick}
              className={`
                flex items-center gap-3 px-5 py-3 transition-colors cursor-pointer
                ${pathname === '/settings' || pathname.startsWith('/settings/')
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }
              `}
            >
              <Settings className="w-5 h-5" />
              <span className="text-sm">Settings</span>
            </Link>
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center gap-3 px-5 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span className="text-sm">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
