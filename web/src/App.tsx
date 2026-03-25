import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Globe, Link, Settings, Zap, Activity, RotateCcw } from "lucide-react";
import { fetchStatus, restartServer, type StatusResponse } from "./lib/api";
import { useState } from "react";
import "./App.css";
import Services from "./pages/Services";
import Aliases from "./pages/Aliases";
import SettingsPage from "./pages/Settings";

function App() {
  const { data } = useQuery<StatusResponse>({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });
  const [restarting, setRestarting] = useState(false);

  const serviceCount = data?.services.length ?? 0;

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await restartServer();
    } catch { /* server will disconnect */ }
    // Wait for server to come back
    setTimeout(() => {
      setRestarting(false);
      window.location.reload();
    }, 3000);
  };

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
              <span className="nav-badge">{serviceCount}</span>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={11} style={{ color: "var(--green)" }} />
              <span>v{data?.version ?? "..."}</span>
            </div>
            <button
              className="sidebar-restart"
              onClick={handleRestart}
              disabled={restarting}
              title="Restart server"
            >
              <RotateCcw size={12} className={restarting ? "spinning" : ""} />
            </button>
          </div>
        </div>
      </nav>
      <div className="main">
        {restarting && (
          <div className="restart-overlay">
            <RotateCcw size={24} className="spinning" />
            <span>Restarting portly...</span>
          </div>
        )}
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
