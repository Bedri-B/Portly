import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchStatus, updateConfig, checkUpdate, applyUpdate, setupHttps, regenerateCerts,
  removeCerts, fetchCertInfo, restartServer, installStartup, uninstallStartup,
  exportConfig, importConfig, type StatusResponse, type AppConfig, type UpdateInfo, type CertInfo,
} from "@/lib/api";
import { Save, Loader2, RotateCcw, Lock, Globe, Download, RefreshCw, Power, Container, Trash2, RotateCw, Upload, FileDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery<StatusResponse>({ queryKey: ["status"], queryFn: fetchStatus });
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<AppConfig>({
    proxy_port: 80, https_port: 443, domain: ".localhost", api_port: 19800, web_port: 19802,
    https_enabled: false, docker_discovery: true, scan_common: true, auto_start: true, auto_update: false, docker_strip_prefix: "", extra_domains: [],
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState("");
  const [startupLoading, setStartupLoading] = useState(false);
  const [httpsLoading, setHttpsLoading] = useState(false);
  const [httpsMsg, setHttpsMsg] = useState("");
  const [certInfo, setCertInfo] = useState<CertInfo | null>(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => { if (data?.config) setForm(data.config); }, [data]);
  useEffect(() => { fetchCertInfo().then(setCertInfo).catch(() => {}); }, []);

  const save = async () => {
    setSaving(true); setMsg("");
    try { const res = await updateConfig(form); setMsg(res.message || "Saved!"); qc.invalidateQueries({ queryKey: ["status"] }); }
    catch (e: any) { setMsg(`Error: ${e.message}`); }
    setSaving(false);
  };

  const handleExport = async () => {
    const cfg = await exportConfig();
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "portly-config.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const cfg = JSON.parse(reader.result as string);
        const res = await importConfig(cfg);
        setMsg(res.message || "Imported!");
        qc.invalidateQueries({ queryKey: ["status"] });
      } catch { setMsg("Error: Invalid config file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!data) return <div className="flex items-center justify-center h-full text-muted-foreground gap-2"><Loader2 size={18} className="animate-spin" /> Loading...</div>;

  const Field = ({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) => (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide">{label}</Label>
      {children}
      {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">Configure proxy, discovery, and system options</p>
        </div>
        <Badge variant="outline">v{data.version}</Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Column 1: Proxy + Ports */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Globe size={14} /> HTTP Proxy</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Primary domain" help={`Services: http://name${form.domain}`}>
                <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
              </Field>
              <Field label="Extra domains" help="Additional suffixes (up to 3). Separate with commas. e.g. .test, .local">
                <Input
                  value={(form.extra_domains || []).join(", ")}
                  onChange={(e) => {
                    const vals = e.target.value.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3);
                    setForm({ ...form, extra_domains: vals });
                  }}
                  placeholder=".test, .local"
                />
              </Field>
              <Field label="HTTP port" help="80 for clean portless URLs">
                <Input type="number" value={form.proxy_port} onChange={(e) => setForm({ ...form, proxy_port: +e.target.value || 80 })} className="w-28" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Server Ports</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="API port">
                <Input type="number" value={form.api_port} onChange={(e) => setForm({ ...form, api_port: +e.target.value || 19800 })} className="w-28" />
              </Field>
              <Field label="Dashboard port">
                <Input type="number" value={form.web_port} onChange={(e) => setForm({ ...form, web_port: +e.target.value || 19802 })} className="w-28" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Container size={14} /> Discovery</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div><Label>Docker auto-discovery</Label><p className="text-xs text-muted-foreground">Find running containers</p></div>
                <Switch checked={form.docker_discovery} onCheckedChange={(v) => setForm({ ...form, docker_discovery: v })} />
              </div>
              <Separator />
              <Field label="Strip prefix from Docker names" help="Comma-separated. Include the separator (e.g. the underscore). global_pgadmin → pgadmin.localhost">
                <Input value={form.docker_strip_prefix ?? ""} onChange={(e) => setForm({ ...form, docker_strip_prefix: e.target.value })} placeholder="e.g. global_, myproject-" className="font-mono" />
              </Field>
            </CardContent>
          </Card>
        </div>

        {/* Column 2: HTTPS */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Lock size={14} /> HTTPS</CardTitle>
                <div className="flex gap-1.5">
                  {certInfo?.exists && <Badge variant={certInfo.method === "mkcert" ? "default" : "outline"} className="text-[10px]">{certInfo.method === "mkcert" ? "Trusted" : "Self-signed"}</Badge>}
                  <Badge variant={form.https_enabled ? "default" : "secondary"} className="text-[10px]">{form.https_enabled ? "On" : "Off"}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div><Label>Enable HTTPS proxy</Label><p className="text-xs text-muted-foreground">Requires certificates</p></div>
                <Switch checked={form.https_enabled} onCheckedChange={(v) => setForm({ ...form, https_enabled: v })} />
              </div>

              <Field label="HTTPS port" help="443 default, falls back to 19444">
                <Input type="number" value={form.https_port} onChange={(e) => setForm({ ...form, https_port: +e.target.value || 443 })} className="w-28" />
              </Field>

              <Separator />

              {/* Cert info */}
              {certInfo && (
                <div className="rounded-md border p-3 text-xs space-y-1">
                  {certInfo.exists ? (
                    <>
                      <div><span className="text-muted-foreground">Method:</span> <span className={`font-semibold ${certInfo.method === "mkcert" ? "text-green-500" : "text-yellow-500"}`}>{certInfo.method}</span></div>
                      {certInfo.expires && <div><span className="text-muted-foreground">Expires:</span> <span className="font-mono">{certInfo.expires}</span></div>}
                      {certInfo.domains.length > 0 && <div><span className="text-muted-foreground">Covers:</span> <span className="font-mono">{certInfo.domains.join(", ")}</span></div>}
                    </>
                  ) : (
                    <p className="text-muted-foreground">No certificates installed.</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={httpsLoading} onClick={async () => {
                  setHttpsLoading(true); setHttpsMsg("");
                  try {
                    const r = await setupHttps();
                    setHttpsMsg(r.message);
                    if (r.success) {
                      setHttpsMsg("Certificates installed! Server restarting... Restart your browser to trust the new CA.");
                      setTimeout(() => window.location.reload(), 4000);
                    }
                  } catch { setHttpsMsg("Failed."); }
                  setHttpsLoading(false);
                }}>
                  <Lock size={12} /> {httpsLoading ? "Setting up..." : "Install Certs"}
                </Button>
                {certInfo?.exists && (
                  <>
                    <Button variant="outline" size="sm" disabled={httpsLoading} onClick={async () => {
                      setHttpsLoading(true); setHttpsMsg("");
                      try {
                        const r = await regenerateCerts();
                        setHttpsMsg(r.message);
                        if (r.success) {
                          setHttpsMsg("Certificates regenerated! Server restarting...");
                          setTimeout(() => window.location.reload(), 4000);
                        }
                      } catch { setHttpsMsg("Failed."); }
                      setHttpsLoading(false);
                    }}>
                      <RefreshCw size={12} /> Regenerate
                    </Button>
                    <Button variant="destructive" size="sm" disabled={httpsLoading} onClick={async () => {
                      setHttpsLoading(true); setHttpsMsg("");
                      try { const r = await removeCerts(); setHttpsMsg(r.message); setCertInfo({ ...certInfo, exists: false, method: "none", expires: null, domains: [] }); }
                      catch { setHttpsMsg("Failed."); }
                      setHttpsLoading(false);
                    }}>
                      <Trash2 size={12} /> Remove
                    </Button>
                  </>
                )}
              </div>
              {httpsMsg && <p className={`text-xs ${httpsMsg.includes("fail") || httpsMsg.includes("Could") ? "text-destructive" : "text-green-500"}`}>{httpsMsg}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Startup + Updates + Config */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Power size={14} /> Startup</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div><Label>Start on boot</Label><p className="text-xs text-muted-foreground">Auto-start when system boots</p></div>
                <Switch checked={form.auto_start} disabled={startupLoading} onCheckedChange={async (v) => {
                  setStartupLoading(true);
                  try { if (v) await installStartup(); else await uninstallStartup(); setForm({ ...form, auto_start: v }); qc.invalidateQueries({ queryKey: ["status"] }); }
                  catch {}
                  setStartupLoading(false);
                }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Download size={14} /> Updates</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div><Label>Auto-update</Label><p className="text-xs text-muted-foreground">Check hourly</p></div>
                <Switch checked={form.auto_update} onCheckedChange={(v) => setForm({ ...form, auto_update: v })} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" disabled={checking} onClick={async () => {
                  setChecking(true); setUpdateMsg("");
                  try { const i = await checkUpdate(); setUpdateInfo(i); if (!i.available) setUpdateMsg(`Up to date (v${i.current}).`); }
                  catch { setUpdateMsg("Check failed."); }
                  setChecking(false);
                }}>
                  <RefreshCw size={12} /> {checking ? "Checking..." : "Check now"}
                </Button>
                {updateInfo?.available && (
                  <Button size="sm" disabled={updating} onClick={async () => {
                    setUpdating(true); setUpdateMsg("");
                    try { const r = await applyUpdate(); setUpdateMsg(r.message); } catch { setUpdateMsg("Failed."); }
                    setUpdating(false);
                  }}>
                    <Download size={12} /> Update to v{updateInfo.latest}
                  </Button>
                )}
              </div>
              {updateMsg && <p className={`text-xs ${updateMsg.includes("fail") ? "text-destructive" : "text-green-500"}`}>{updateMsg}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Info size={14} /> Config</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Export your config as JSON or import a saved one.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}><FileDown size={12} /> Export</Button>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload size={12} /> Import</Button>
                <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save bar */}
      <div className="mt-8 pt-4 border-t flex items-center gap-3">
        {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-green-500"}`}>{msg}</p>}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" disabled={restarting} onClick={async () => {
            setRestarting(true);
            try { await restartServer(); } catch {}
            setTimeout(() => window.location.reload(), 3000);
          }}>
            <RotateCw size={13} className={restarting ? "animate-spin" : ""} />
            {restarting ? "Restarting..." : "Restart Server"}
          </Button>
          <Button variant="outline" onClick={() => setForm({
            proxy_port: 80, https_port: 443, domain: ".localhost", api_port: 19800, web_port: 19802,
            https_enabled: false, docker_discovery: true, scan_common: true, auto_start: true, auto_update: false, docker_strip_prefix: "", extra_domains: [],
          })}>
            <RotateCcw size={13} /> Defaults
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
          </Button>
        </div>
      </div>

      {restarting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3">
          <RotateCw size={24} className="animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Restarting portly...</span>
        </div>
      )}
    </div>
  );
}
