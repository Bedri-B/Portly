import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStatus, updateConfig, type StatusResponse, type AppConfig } from "../lib/api";
import { Save, Loader2, Info, RotateCcw, Lock, Globe } from "lucide-react";

export default function Settings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<StatusResponse>({
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
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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
      api_port: 19800, web_port: 19802, https_enabled: true, docker_discovery: true,
    });

  if (isLoading) {
    return (
      <div className="page">
        <div className="loading"><Loader2 size={20} /> &nbsp;Loading...</div>
      </div>
    );
  }

  const Field = ({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {children}
      {help && <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{help}</span>}
    </label>
  );

  return (
    <div className="page">
      <div className="page-header"><h2>Settings</h2></div>

      <div className="info-banner">
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Port changes require restarting <code>portly</code>. Domain and toggle changes apply immediately.</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>
        {/* Proxy */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Globe size={15} /> HTTP Proxy</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Domain suffix" help={`Services: http://name${form.domain}`}>
              <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
            </Field>
            <Field label="HTTP port" help="Use 80 for clean portless URLs.">
              <input type="number" value={form.proxy_port} onChange={(e) => setForm({ ...form, proxy_port: +e.target.value || 80 })} style={{ width: 120 }} />
            </Field>
          </div>
        </div>

        {/* HTTPS */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Lock size={15} /> HTTPS</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.https_enabled}
                onChange={(e) => setForm({ ...form, https_enabled: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
              />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Enable HTTPS proxy</span>
            </label>
            <Field label="HTTPS port" help="Use 443 for default HTTPS. Auto-generates certs via mkcert or openssl.">
              <input type="number" value={form.https_port} onChange={(e) => setForm({ ...form, https_port: +e.target.value || 443 })} style={{ width: 120 }} />
            </Field>
          </div>
        </div>

        {/* Discovery */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Discovery</span>
          </div>
          <div className="card-body">
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.docker_discovery}
                onChange={(e) => setForm({ ...form, docker_discovery: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Docker auto-discovery</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  Automatically find running Docker containers with published ports.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Ports */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Server Ports</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="API port">
              <input type="number" value={form.api_port} onChange={(e) => setForm({ ...form, api_port: +e.target.value || 19800 })} style={{ width: 120 }} />
            </Field>
            <Field label="Dashboard port">
              <input type="number" value={form.web_port} onChange={(e) => setForm({ ...form, web_port: +e.target.value || 19802 })} style={{ width: 120 }} />
            </Field>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
        {msg && (
          <span style={{ fontSize: 13, color: msg.startsWith("Error") ? "var(--red)" : "var(--green)", marginRight: "auto" }}>
            {msg}
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={reset}><RotateCcw size={14} /> Defaults</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}><Save size={14} /> Save</button>
        </div>
      </div>
    </div>
  );
}
