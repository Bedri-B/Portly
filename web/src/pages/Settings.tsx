import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getConfig, saveAppConfig, type AppConfig } from "../lib/api";
import { Save, Loader2, Info, RotateCcw } from "lucide-react";

export default function Settings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<AppConfig>({
    queryKey: ["config"],
    queryFn: getConfig,
  });

  const [form, setForm] = useState<AppConfig>({
    proxy_port: 80,
    domain: ".localhost",
    api_port: 19800,
    web_port: 19802,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await saveAppConfig(form);
      setMessage(res.message || "Saved!");
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["status"] });
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
    setSaving(false);
  };

  const handleReset = () => {
    setForm({
      proxy_port: 80,
      domain: ".localhost",
      api_port: 19800,
      web_port: 19802,
    });
  };

  if (isLoading) {
    return (
      <div className="page">
        <div className="loading">
          <Loader2 size={20} /> &nbsp;Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      <div className="info-banner">
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          Configure the reverse proxy domain and ports. Port changes require a
          restart of <code>docker-global</code> to take effect. Set proxy port
          to <code>80</code> for clean URLs like{" "}
          <code>http://name.localhost</code> (may require admin privileges).
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-header">
          <span className="card-title">Proxy Configuration</span>
        </div>
        <div className="card-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Domain suffix</span>
              <input
                type="text"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                placeholder=".localhost"
                style={{ width: "100%" }}
              />
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                Services will be accessible at <code>http://name{form.domain}</code>.
                Common options: <code>.localhost</code>, <code>.local</code>, <code>.docker</code>
              </span>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Proxy port</span>
              <input
                type="number"
                value={form.proxy_port}
                onChange={(e) =>
                  setForm({ ...form, proxy_port: parseInt(e.target.value) || 80 })
                }
                style={{ width: 120 }}
              />
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                Use <code>80</code> for portless URLs. Use <code>19801</code> if port 80 is
                taken or you don't have admin rights.
              </span>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>API port</span>
              <input
                type="number"
                value={form.api_port}
                onChange={(e) =>
                  setForm({ ...form, api_port: parseInt(e.target.value) || 19800 })
                }
                style={{ width: 120 }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Dashboard port</span>
              <input
                type="number"
                value={form.web_port}
                onChange={(e) =>
                  setForm({ ...form, web_port: parseInt(e.target.value) || 19802 })
                }
                style={{ width: 120 }}
              />
            </label>
          </div>
        </div>

        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {message && (
            <span
              style={{
                fontSize: 13,
                color: message.startsWith("Error") ? "var(--red)" : "var(--green)",
                marginRight: "auto",
              }}
            >
              {message}
            </span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={handleReset}>
              <RotateCcw size={14} /> Defaults
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={14} /> Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
