import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Globe, Link, Settings, Zap, Activity } from "lucide-react";
import { fetchStatus, type StatusResponse } from "./lib/api";
import "./App.css";
import Services from "./pages/Services";
import Aliases from "./pages/Aliases";
import SettingsPage from "./pages/Settings";

function App() {
  const { data } = useQuery<StatusResponse>({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });

  const serviceCount = data?.services.length ?? 0;

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <Zap size={22} />
          <div>
            <h1>Portly</h1>
            <span>Portless Proxy</span>
          </div>
        </div>
        <div className="sidebar-nav">
          <NavLink to="/services">
            <Globe size={16} /> Services
            {serviceCount > 0 && (
              <span style={{
                marginLeft: "auto",
                fontSize: 11,
                fontWeight: 600,
                background: "var(--accent-dim)",
                color: "var(--accent)",
                padding: "1px 8px",
                borderRadius: 99,
              }}>
                {serviceCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/aliases">
            <Link size={16} /> Aliases
          </NavLink>
          <NavLink to="/settings">
            <Settings size={16} /> Settings
          </NavLink>
        </div>
        <div className="sidebar-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Activity size={12} style={{ color: "var(--green)" }} />
            <span>v{data?.version ?? "..."}</span>
          </div>
        </div>
      </nav>
      <div className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/services" replace />} />
          <Route path="/services" element={<Services />} />
          <Route path="/aliases" element={<Aliases />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
