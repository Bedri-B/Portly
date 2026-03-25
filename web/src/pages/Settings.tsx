import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchStatus,
  updateConfig,
  checkUpdate,
  applyUpdate,
  setupHttps,
  installStartup,
  uninstallStartup,
  type StatusResponse,
  type AppConfig,
  type UpdateInfo,
} from "../lib/api";
import { Save, Loader2, Info, RotateCcw, Lock, Globe, Download, RefreshCw, Power, Container } from "lucide-react";

export default function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery<StatusResponse>({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });

  const [form, setForm] = useState<AppConfig>({
    proxy_port: 80,
    https_port: 443,
    domain: ".localhost",
    api_port: 19800,
    web_port: 19802,
    https_enabled: true,
    docker_discovery: true,
    scan_common: true,
    auto_start: true,
    auto_update: false,
    docker_strip_prefix: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState("");
  const [startupLoading, setStartupLoading] = useState(false);
  const [httpsSetupLoading, setHttpsSetupLoading] = useState(false);
  const [httpsMsg, setHttpsMsg] = useState("");

  useEffect(() => {
    if (data?.config) setForm(data.config);
  }, [data]);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const res = await updateConfig(form);
      setMsg(res.message || "Saved!");
      qc.invalidateQueries({ queryKey: ["status"] });
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
    setSaving(false);
  };

  const reset = () =>
    setForm({
      proxy_port: 80, https_port: 443, domain: ".localhost",
      api_port: 19800, web_port: 19802, https_enabled: true,
      docker_discovery: true, scan_common: true, auto_start: true, auto_update: false, docker_strip_prefix: "",
    });

  const handleCheckUpdate = async () => {
    setChecking(true);
    setUpdateMsg("");
    try {
      const info = await checkUpdate();
      setUpdateInfo(info);
      if (!info.available) setUpdateMsg(`Up to date (v${info.current}).`);
    } catch {
      setUpdateMsg("Failed to check for updates.");
    }
    setChecking(false);
  };

  const handleApplyUpdate = async () => {
    setUpdating(true);
    setUpdateMsg("");
    try {
      const res = await applyUpdate();
      setUpdateMsg(res.message);
    } catch {
      setUpdateMsg("Update failed.");
    }
    setUpdating(false);
  };

  const handleToggleStartup = async () => {
    setStartupLoading(true);
    try {
      if (form.auto_start) {
        await uninstallStartup();
        setForm({ ...form, auto_start: false });
      } else {
        await installStartup();
        setForm({ ...form, auto_start: true });
      }
      qc.invalidateQueries({ queryKey: ["status"] });
    } catch { /* ignore */ }
    setStartupLoading(false);
  };

  if (!data) {
    return (
      <div className="page">
        <div className="loading"><Loader2 size={18} /> Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
            Configure proxy, discovery, and system options
          </p>
        </div>
        <span className="badge badge-gray">v{data.version}</span>
      </div>

      <div className="info-banner">
        <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Port changes require restarting portly. Domain and toggle changes apply immediately.</span>
      </div>

      <div className="settings-grid">
        {/* HTTP Proxy */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Globe size={14} /> HTTP Proxy</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <span className="field-label">Domain suffix</span>
              <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
              <span className="field-help">Services: http://name{form.domain}</span>
            </div>
            <div className="field">
              <span className="field-label">HTTP port</span>
              <input type="number" value={form.proxy_port} onChange={(e) => setForm({ ...form, proxy_port: +e.target.value || 80 })} style={{ width: 120 }} />
              <span className="field-help">Use 80 for clean portless URLs</span>
            </div>
          </div>
        </div>

        {/* HTTPS */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Lock size={14} /> HTTPS</span>
            {form.https_enabled && <span className="badge badge-green">Enabled</span>}
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={form.https_enabled}
                onChange={(e) => setForm({ ...form, https_enabled: e.target.checked })}
              />
              <div>
                <div className="toggle-label">Enable HTTPS proxy</div>
                <div className="toggle-desc">Requires trusted certificates (mkcert)</div>
              </div>
            </label>
            <div className="field">
              <span className="field-label">HTTPS port</span>
              <input type="number" value={form.https_port} onChange={(e) => setForm({ ...form, https_port: +e.target.value || 443 })} style={{ width: 120 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                className="btn btn-blue btn-sm"
                disabled={httpsSetupLoading}
                onClick={async () => {
                  setHttpsSetupLoading(true);
                  setHttpsMsg("");
                  try {
                    const res = await setupHttps();
                    setHttpsMsg(res.message);
                    if (res.success) {
                      setForm({ ...form, https_enabled: true });
                    }
                  } catch {
                    setHttpsMsg("Setup failed.");
                  }
                  setHttpsSetupLoading(false);
                }}
              >
                <Lock size={12} />
                {httpsSetupLoading ? "Setting up..." : "Install certificates"}
              </button>
              <span className="field-help">
                Installs mkcert (if needed) and generates trusted certificates.
                Browsers will trust *.localhost with no warnings.
              </span>
              {httpsMsg && (
                <span style={{ fontSize: 12, color: httpsMsg.includes("fail") || httpsMsg.includes("Could not") ? "var(--red)" : "var(--green)" }}>
                  {httpsMsg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Discovery */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Container size={14} /> Discovery</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={form.docker_discovery}
                onChange={(e) => setForm({ ...form, docker_discovery: e.target.checked })}
              />
              <div>
                <div className="toggle-label">Docker auto-discovery</div>
                <div className="toggle-desc">Find running containers with published ports</div>
              </div>
            </label>
            <div className="field">
              <span className="field-label">Strip prefix from Docker names</span>
              <input
                value={form.docker_strip_prefix ?? ""}
                onChange={(e) => setForm({ ...form, docker_strip_prefix: e.target.value })}
                placeholder="e.g. global_ or myproject_"
                style={{ fontFamily: "var(--mono)" }}
              />
              <span className="field-help">
                Auto-creates short URLs: global_pgadmin &rarr; pgadmin.localhost
              </span>
            </div>
          </div>
        </div>

        {/* Server Ports */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Server Ports</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <span className="field-label">API port</span>
              <input type="number" value={form.api_port} onChange={(e) => setForm({ ...form, api_port: +e.target.value || 19800 })} style={{ width: 120 }} />
            </div>
            <div className="field">
              <span className="field-label">Dashboard port</span>
              <input type="number" value={form.web_port} onChange={(e) => setForm({ ...form, web_port: +e.target.value || 19802 })} style={{ width: 120 }} />
            </div>
          </div>
        </div>

        {/* Startup */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Power size={14} /> Startup</span>
          </div>
          <div className="card-body">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={form.auto_start}
                onChange={handleToggleStartup}
                disabled={startupLoading}
              />
              <div>
                <div className="toggle-label">
                  Start on boot
                  {startupLoading && <Loader2 size={12} style={{ display: "inline-block", marginLeft: 6, animation: "spin 1s linear infinite" }} />}
                </div>
                <div className="toggle-desc">Automatically start portly when your system boots</div>
              </div>
            </label>
          </div>
        </div>

        {/* Updates */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Download size={14} /> Updates</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={form.auto_update}
                onChange={(e) => setForm({ ...form, auto_update: e.target.checked })}
              />
              <div>
                <div className="toggle-label">Auto-update</div>
                <div className="toggle-desc">Check and install updates hourly</div>
              </div>
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn-ghost btn-sm" onClick={handleCheckUpdate} disabled={checking}>
                <RefreshCw size={12} /> {checking ? "Checking..." : "Check now"}
              </button>
              {updateInfo?.available && (
                <button className="btn btn-primary btn-sm" onClick={handleApplyUpdate} disabled={updating}>
                  <Download size={12} /> {updating ? "Updating..." : `Update to v${updateInfo.latest}`}
                </button>
              )}
              {updateMsg && (
                <span style={{ fontSize: 12, color: updateMsg.includes("fail") || updateMsg.includes("Error") ? "var(--red)" : "var(--green)" }}>
                  {updateMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div style={{ marginTop: 24, display: "flex", gap: 8, alignItems: "center", paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        {msg && (
          <span style={{ fontSize: 13, color: msg.startsWith("Error") ? "var(--red)" : "var(--green)", marginRight: "auto" }}>
            {msg}
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={reset}><RotateCcw size={13} /> Defaults</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
