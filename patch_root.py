import re

with open('frontend/src/routes/__root.tsx', 'r') as f:
    c = f.read()

imp = '''import { ALPRProvider } from "@/context/ALPRContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Lock, UserCheck, Shield } from "lucide-react";'''

c = c.replace('import { ALPRProvider } from "@/context/ALPRContext";', imp)

login_ui = '''function RootContent() {
  const { role, login } = useAuth();
  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <Shield className="mx-auto h-12 w-12 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SmartGate ALPR</h1>
            <p className="text-sm text-muted-foreground mt-2">Enterprise Security Login</p>
          </div>
          <div className="grid gap-4 mt-8">
            <Button size="lg" onClick={() => login("admin")} className="w-full gap-2">
              <Lock className="h-4 w-4" /> Login as Admin
            </Button>
            <Button size="lg" variant="outline" onClick={() => login("guard")} className="w-full gap-2">
              <UserCheck className="h-4 w-4" /> Login as Security Guard
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}'''

c = c.replace('function RootComponent() {', login_ui + '\n\nfunction RootComponent() {')

app_shell_render = '''        <ALPRProvider>
          <AppShell>
            <Outlet />
          </AppShell>
          <Toaster'''

new_app_shell = '''        <ALPRProvider>
          <AuthProvider>
            <RootContent />
          </AuthProvider>
          <Toaster'''
          
c = c.replace(app_shell_render, new_app_shell)

with open('frontend/src/routes/__root.tsx', 'w') as f:
    f.write(c)
