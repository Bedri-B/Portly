import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { Globe, Link, Settings, Box } from "lucide-react";
import "./App.css";
import Services from "./pages/Services";
import Aliases from "./pages/Aliases";
import SettingsPage from "./pages/Settings";

function App() {
  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <Box size={22} />
          <div>
            <h1>Portly</h1>
            <span>Portless Proxy</span>
          </div>
        </div>
        <div className="sidebar-nav">
          <NavLink to="/services">
            <Globe size={16} /> Services
          </NavLink>
          <NavLink to="/aliases">
            <Link size={16} /> Aliases
          </NavLink>
          <NavLink to="/settings">
            <Settings size={16} /> Settings
          </NavLink>
        </div>
        <div className="sidebar-footer">portly</div>
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
