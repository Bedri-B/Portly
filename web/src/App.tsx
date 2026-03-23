import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { LayoutDashboard, Globe, FolderCog, Box, Settings } from "lucide-react";
import "./App.css";
import Overview from "./pages/Overview";
import Services from "./pages/Services";
import Stacks from "./pages/Stacks";
import SettingsPage from "./pages/Settings";

function App() {
  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <Box size={22} />
          <div>
            <h1>Docker Global</h1>
            <span>Container Manager</span>
          </div>
        </div>

        <div className="sidebar-nav">
          <NavLink to="/overview">
            <LayoutDashboard size={16} />
            Overview
          </NavLink>
          <NavLink to="/services">
            <Globe size={16} />
            Services
          </NavLink>
          <NavLink to="/stacks">
            <FolderCog size={16} />
            Stacks
          </NavLink>
          <NavLink to="/settings">
            <Settings size={16} />
            Settings
          </NavLink>
        </div>

        <div className="sidebar-footer">docker-global</div>
      </nav>

      <div className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/services" element={<Services />} />
          <Route path="/stacks" element={<Stacks />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
