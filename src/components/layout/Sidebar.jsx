import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Calendar,
  Tag,
  Package,
  FileText,
  Receipt,
  Building2,
  Users,
  ClipboardList,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui';
import InstallButton from '../InstallButton';

const navLinks = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Calendar, label: 'Events', path: '/events' },
  { icon: Tag, label: 'Event Types', path: '/event-types' },
  { icon: Package, label: 'Inventory', path: '/inventory' },
  { icon: FileText, label: 'Quotations', path: '/quotations' },
  { icon: Receipt, label: 'Invoices', path: '/invoices' },
  { icon: Building2, label: 'Organization', path: '/organization' },
  { icon: Users, label: 'Team', path: '/users', adminOnly: true },
  { icon: ClipboardList, label: 'Audit Log', path: '/audit-log', adminOnly: true },
];

// Persist the collapsed/expanded choice so the rail stays as the user left it.
const COLLAPSE_KEY = 'ef_sidebar_collapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
};

const Sidebar = () => {
  const { user, currentOrg, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  if (!user) return null;

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        // Storage can be unavailable (private mode); collapsing still works this session.
      }
      return next;
    });
  };

  const links = navLinks.filter(
    (l) => !l.adminOnly || isAdmin
  );

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName = user.displayName || user.email || 'User';
  const userInitials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const orgInitials = (currentOrg?.name || 'EF')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className={`hidden md:flex md:flex-col h-screen bg-app-bg-secondary border-r border-app-border flex-shrink-0 transition-[width] duration-200 ease-out ${
        collapsed ? 'md:w-[76px]' : 'md:w-60 lg:w-64'
      }`}
    >
      <div
        className={`border-b border-app-border ${
          collapsed ? 'px-2 py-4 flex justify-center' : 'p-5'
        }`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          {currentOrg?.logo ? (
            <img
              src={currentOrg.logo}
              alt={currentOrg?.name ? `${currentOrg.name} logo` : 'Organization logo'}
              className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-app-accent-light text-app-accent-dark flex items-center justify-center font-display font-semibold flex-shrink-0">
              {orgInitials}
            </div>
          )}
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-app-text-primary truncate">
                {currentOrg?.name || 'EventFlow'}
              </p>
              <p className="text-xs text-app-text-muted truncate">EventFlow</p>
            </div>
          )}
        </div>
      </div>

      <nav className={`flex-1 overflow-y-auto p-3 space-y-1 ${collapsed ? 'overflow-x-hidden' : ''}`}>
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.path}
              to={link.path}
              title={collapsed ? link.label : undefined}
              aria-label={link.label}
              className={({ isActive }) =>
                `relative flex items-center rounded-xl text-sm font-medium transition ${
                  collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-app-accent-light text-app-accent-dark'
                    : 'text-app-text-secondary hover:bg-app-bg-tertiary hover:text-app-text-primary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute left-0 top-1 bottom-1 w-1 bg-app-accent rounded-r"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span className="truncate">{link.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-app-border space-y-2">
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className={`w-full flex items-center rounded-xl text-sm font-medium text-app-text-muted hover:bg-app-bg-tertiary hover:text-app-text-primary transition ${
            collapsed ? 'justify-center py-2.5' : 'gap-2 px-3 py-2'
          }`}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>

        <div
          className={`flex items-center rounded-xl bg-app-bg-tertiary ${
            collapsed ? 'flex-col gap-1.5 px-1 py-2' : 'gap-3 px-3 py-2.5'
          }`}
        >
          <div
            className="w-9 h-9 rounded-full bg-app-accent-light text-app-accent-dark flex items-center justify-center font-semibold text-sm flex-shrink-0"
            title={collapsed ? `${displayName} (${user.role || 'STAFF'})` : undefined}
          >
            {userInitials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-app-text-primary truncate">
                  {displayName}
                </p>
                <Badge status={user.role || 'STAFF'} className="text-[10px] mt-0.5" />
              </div>
              <InstallButton />
            </>
          )}
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg hover:bg-app-bg-secondary text-app-text-muted hover:text-app-danger transition flex-shrink-0"
            title="Logout"
            aria-label="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
