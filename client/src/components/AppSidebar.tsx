import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Search,
  BarChart3,
  FileText,
  Target,
  Users,
  FlaskConical,
  Brain,
  Wrench,
  Globe,
  Shield,
  Settings,
  CreditCard,
  Zap,
  Cpu,
  ArrowLeftRight,
  Eye,
  Layers,
  HelpCircle,
  X,
  Building2,
  Network,
  Code2,
  TrendingUp,
  Award,
  FileSearch,
  BookOpen,
  Languages,
  Database,
  Activity,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { getDisplayAvatarUrl, getDisplayName, getIdentityInitials } from '../utils/userIdentity';
import { meetsMinimumTier, type CanonicalTier } from '@shared/types';
import { APP_NAV_GROUPS, formatTierGateLabel, type NavItem } from '../config/routeIntelligence';
import { CloudflareBadge } from './CloudflareBadge';

const LOGO_URL = '/aivis-logo.png';

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const ICON_BY_NAME = {
  LayoutDashboard,
  Search,
  BarChart3,
  FileText,
  Target,
  Users,
  FlaskConical,
  Brain,
  Wrench,
  Globe,
  Shield,
  Settings,
  CreditCard,
  Zap,
  Cpu,
  ArrowLeftRight,
  Eye,
  Layers,
  HelpCircle,
  Network,
  Code2,
  TrendingUp,
  Award,
  FileSearch,
  BookOpen,
  Languages,
  Database,
  Activity,
} as const;

const CODETRENDY_BADGE_URL = 'https://codetrendy.com/api/badge?style=dark';

function NavSection({
  title,
  items,
  onClose,
  iconClass,
  iconBg,
}: {
  title: string;
  items: NavItem[];
  onClose?: () => void;
  iconClass: string;
  iconBg: string;
}) {
  const user = useAuthStore((s) => s.user);
  const tier = (user?.tier ?? 'observer') as CanonicalTier;
  const { t } = useTranslation();

  return (
    <div className="aurora-sidebar-section">
      <p className="aurora-sidebar-heading">{title}</p>
      {items.map((item) => {
        const locked = item.minTier ? !meetsMinimumTier(tier, item.minTier) : false;
        const Icon = ICON_BY_NAME[item.iconName];
        return (
          <NavLink
            key={item.to}
            to={locked ? '#' : item.to}
            end={item.to === '/app'}
            onClick={(e) => {
              if (locked) {
                e.preventDefault();
                return;
              }
              onClose?.();
            }}
            aria-disabled={locked || undefined}
            tabIndex={locked ? -1 : undefined}
            className={({ isActive }) =>
              `aurora-sidebar-link ${isActive ? 'is-active' : ''} ${locked ? 'pointer-events-none opacity-40' : ''}`
            }
          >
            <span className="aurora-nav-icon">
              <Icon className={`w-[15px] h-[15px] ${iconClass}`} />
            </span>
            <span className="truncate">{t(item.labelKey)}</span>
            {locked && (
              <span className="aurora-sidebar-lock">
                {item.minTier ? formatTierGateLabel(item.minTier) : null}
              </span>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}

export default function AppSidebar({ isOpen = false, onClose }: AppSidebarProps) {
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const avatarUrl = getDisplayAvatarUrl(user);
  const displayName = getDisplayName(user);
  const initials = getIdentityInitials(user);

  return (
    <aside
      className={`aurora-sidebar ${isOpen ? 'is-open' : ''}`}
      aria-label="Main navigation"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && isOpen) onClose?.();
      }}
    >
      {/* Brand */}
      <div className="aurora-sidebar-brand">
        <NavLink to="/app" className="flex items-center gap-2 min-w-0 flex-1" onClick={onClose}>
          <img
            src={LOGO_URL}
            alt="AiVIS.biz"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 rounded-lg object-contain"
          />
          <div className="min-w-0">
            <p className="aurora-sidebar-title">AiVIS.biz</p>
            <span className="aurora-sidebar-subtitle">CITE LEDGER</span>
          </div>
        </NavLink>
        {/* Mobile close button */}
        <button
          className="lg:hidden ml-auto p-1 rounded-md text-white/50 hover:text-white hover:bg-white/08 transition-colors"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="aurora-sidebar-nav">
        {APP_NAV_GROUPS.map((group) => (
          <NavSection
            key={group.key}
            title={t(group.titleKey)}
            items={group.items}
            onClose={onClose}
            iconClass={group.iconClass}
            iconBg={group.iconBg}
          />
        ))}
      </nav>

      {/* CodeTrendy badge */}
      <div className="px-4 py-2 shrink-0">
        <a href="https://codetrendy.com" target="_blank" rel="noopener noreferrer">
          <img
            src={CODETRENDY_BADGE_URL}
            alt="Listed on codetrendy.com"
            height={40}
            loading="lazy"
            className="opacity-60 hover:opacity-100 transition-opacity"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </a>
      </div>

      {/* Cloudflare badge */}
      <div className="px-3 pb-1 shrink-0">
        <CloudflareBadge variant="sidebar" />
      </div>

      {/* User pill */}
      {user && (
        <div className="aurora-user-pill">
          <div className="aurora-user-pill-inner">
            <div className="aurora-user-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="User avatar" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="aurora-user-name">{user.company || displayName}</p>
              <p className="aurora-user-tier truncate">
                {user.website
                  ? user.website.replace(/^https?:\/\//, '').replace(/\/$/, '')
                  : user.tier || 'observer'}
                {user.website && (
                  <span className="ml-1.5 opacity-60">· {user.tier || 'observer'}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
