import re

with open('frontend/src/components/alpr/AppShell.tsx', 'r') as f:
    c = f.read()

imp = '''import { VehicleScene } from "./VehicleScene";
import { useAuth } from "@/context/AuthContext";
import { LogOut } from "lucide-react";'''
c = c.replace('import { VehicleScene } from "./VehicleScene";', imp)

# Replace NAV logic
nav_render = '''        <nav className="flex-1 space-y-1 px-2">
          {NAV.map('''

new_nav_render = '''        <nav className="flex-1 space-y-1 px-2">
          {NAV.filter(n => role === "admin" || n.to === "/").map('''
c = c.replace(nav_render, new_nav_render)

nav_render2 = '''        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {NAV.map('''

new_nav_render2 = '''        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {NAV.filter(n => role === "admin" || n.to === "/").map('''
c = c.replace(nav_render2, new_nav_render2)

# Get role and logout from hook inside AppShell
appshell_start = 'export function AppShell({ children }: { children: ReactNode }) {'
new_appshell_start = '''export function AppShell({ children }: { children: ReactNode }) {
  const { role, logout } = useAuth();'''
c = c.replace(appshell_start, new_appshell_start)

# Add logout button next to collapse
collapse_btn = '''          <button onClick={() => setCollapsed(!collapsed)} className="m-2 flex items-center justify-center gap-2 rounded-md border border-sidebar-border py-2 text-xs text-muted-foreground hover:bg-sidebar-accent">
            <ChevronLeft className={cn("h-4 w-4 transition", collapsed && "rotate-180")} />{!collapsed && "Collapse"}
          </button>'''

new_collapse_btn = '''          <div className="mt-auto flex flex-col gap-1 p-2">
            <button onClick={logout} className="flex items-center justify-center gap-2 rounded-md py-2 text-xs text-red-500 hover:bg-red-500/10 transition">
              <LogOut className="h-4 w-4" />{!collapsed && "Log out"}
            </button>
            <button onClick={() => setCollapsed(!collapsed)} className="flex items-center justify-center gap-2 rounded-md border border-sidebar-border py-2 text-xs text-muted-foreground hover:bg-sidebar-accent transition">
              <ChevronLeft className={cn("h-4 w-4 transition", collapsed && "rotate-180")} />{!collapsed && "Collapse"}
            </button>
          </div>'''

c = c.replace(collapse_btn, new_collapse_btn)

with open('frontend/src/components/alpr/AppShell.tsx', 'w') as f:
    f.write(c)
