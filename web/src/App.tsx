import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Globe, Link, Settings, Activity } from "lucide-react";
import { fetchStatus, type StatusResponse } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { PortlyLogo } from "@/components/PortlyLogo";
import Services from "@/pages/Services";
import Aliases from "@/pages/Aliases";
import SettingsPage from "@/pages/Settings";

function App() {
  const { data } = useQuery<StatusResponse>({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });

  const serviceCount = data?.services.length ?? 0;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <nav className="w-60 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="p-5 flex items-center gap-3">
          <PortlyLogo size={28} />
          <div>
            <h1 className="text-base font-bold tracking-tight">Portly</h1>
            <p className="text-xs text-muted-foreground">Portless Proxy</p>
          </div>
        </div>

        <div className="flex-1 px-3 py-1 flex flex-col gap-0.5">
          {[
            { to: "/services", icon: Globe, label: "Services", count: serviceCount },
            { to: "/aliases", icon: Link, label: "Aliases" },
            { to: "/settings", icon: Settings, label: "Settings" },
          ].map(({ to, icon: Icon, label, count }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`
              }
            >
              <Icon size={16} />
              {label}
              {count !== undefined && count > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                  {count}
                </Badge>
              )}
            </NavLink>
          ))}
        </div>

        <div className="p-4 border-t border-border text-xs text-muted-foreground font-mono flex items-center gap-1.5">
          <Activity size={10} className="text-green-500" />
          {data?.version ? `v${data.version}` : "..."}
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-background">
        <Routes>
          <Route path="/" element={<Navigate to="/services" replace />} />
          <Route path="/services" element={<Services />} />
          <Route path="/aliases" element={<Aliases />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
