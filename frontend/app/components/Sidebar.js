"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Network,
  ShieldAlert,
  Search,
  Menu,
  X,
  LogOut,
  Settings,
  Users,
  FileText,
  BarChart3,
  Database,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/authContext";
import LoadingSpinner from "./LoadingSpinner";

const userNavItems = [
  { href: "/user", label: "Dashboard", icon: LayoutDashboard },
  { href: "/graph", label: "Graph Explorer", icon: Network },
  { href: "/suspicious", label: "Suspicious", icon: ShieldAlert },
];

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Manage Users", icon: Users },
  { href: "/suspicious", label: "Suspicious", icon: ShieldAlert },
  { href: "/admin/logs", label: "Activity Logs", icon: FileText },
  { href: "/admin/uploads", label: "Data Management", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated, loading, isAdmin, selectedDatasetId, setSelectedDatasetId, userDatasets } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [datasetPickerOpen, setDatasetPickerOpen] = useState(false);

  const showDatasetPicker = pathname?.startsWith('/graph') || pathname?.startsWith('/suspicious');

  // Don't show sidebar on login page or during loading
  if (pathname === "/login" || loading) {
    return null;
  }

  // Don't show sidebar if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const navItems = isAdmin ? adminNavItems : userNavItems;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
      setLoggingOut(false);
    }
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-sidebar-bg p-2 text-foreground lg:hidden"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar-bg transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <ShieldAlert size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground">
              DBMS
            </h1>
            <p className="text-[10px] text-muted">Distributed Blockchain Monitoring</p>
          </div>
        </div>

        {/* User Info */}
        {user && (
          <div className="border-b border-sidebar-border px-4 py-4 space-y-2">
            <p className="text-xs text-muted uppercase tracking-wide">Logged in as</p>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-xs font-bold text-accent">
                  {user.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.username}
                </p>
                <p className="text-xs text-muted capitalize">{user.role}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/user"
                ? pathname === "/user"
                : href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Dataset picker — only on /graph and /suspicious */}
        {showDatasetPicker && (
          <div className="border-t border-sidebar-border px-3 py-3 relative">
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted flex items-center gap-1">
              <Database size={10} /> Dataset
            </p>
            <button
              onClick={() => setDatasetPickerOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-1 rounded border border-sidebar-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-accent transition-colors"
            >
              <span className="truncate">
                {selectedDatasetId === 'shared'
                  ? 'Main Database'
                  : (userDatasets.find((d) => d.id === selectedDatasetId)?.name || 'My Dataset')}
              </span>
              <ChevronDown size={12} className={`flex-shrink-0 text-muted transition-transform ${datasetPickerOpen ? 'rotate-180' : ''}`} />
            </button>
            {datasetPickerOpen && (
              <div className="absolute bottom-full left-3 right-3 z-50 mb-1 rounded-lg border border-card-border bg-card p-1 shadow-xl">
                <button
                  onClick={() => { setSelectedDatasetId('shared'); setDatasetPickerOpen(false); }}
                  className={`w-full rounded px-3 py-2 text-left text-xs font-medium transition-colors ${
                    selectedDatasetId === 'shared' ? 'bg-accent/20 text-accent' : 'text-foreground hover:bg-background'
                  }`}
                >
                  Main Database
                  <span className="ml-1 text-[10px] text-muted">(shared)</span>
                </button>
                {userDatasets.length > 0 && (
                  <>
                    <div className="my-1 border-t border-card-border" />
                    {userDatasets.map((ds) => (
                      <button
                        key={ds.id}
                        onClick={() => { setSelectedDatasetId(ds.id); setDatasetPickerOpen(false); }}
                        className={`w-full rounded px-3 py-2 text-left text-xs font-medium transition-colors ${
                          selectedDatasetId === ds.id ? 'bg-accent/20 text-accent' : 'text-foreground hover:bg-background'
                        }`}
                      >
                        <span className="block truncate">{ds.name}</span>
                        {ds.rowCount != null && (
                          <span className="text-[10px] text-muted">{ds.rowCount.toLocaleString()} rows</span>
                        )}
                      </button>
                    ))}
                  </>
                )}
                {userDatasets.length === 0 && (
                  <p className="px-3 py-2 text-[10px] text-muted">No personal datasets — upload one on the Data Management page.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Search or Logout */}
        <div className="border-t border-sidebar-border p-4 space-y-2">
          {!isAdmin && (
            <Link
              href="/graph"
              className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-muted hover:text-foreground transition"
            >
              <Search size={14} />
              Search wallets...
            </Link>
          )}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/20 transition disabled:opacity-50"
          >
            {loggingOut ? (
              <>
                <span className="animate-spin">⟳</span>
                Logging out...
              </>
            ) : (
              <>
                <LogOut size={14} />
                Logout
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
