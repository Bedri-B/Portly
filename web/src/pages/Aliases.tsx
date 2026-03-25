import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchStatus,
  addAlias,
  removeAlias,
  addShortAlias,
  removeShortAlias,
  updateScan,
  type StatusResponse,
} from "../lib/api";
import { Plus, Trash2, Loader2, Link, Radar, Info, ExternalLink, Zap, ArrowRight } from "lucide-react";

export default function Aliases() {
  const qc = useQueryClient();
  const { data } = useQuery<StatusResponse>({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });

  const [name, setName] = useState("");
  const [port, setPort] = useState("");
  const [shortName, setShortName] = useState("");
  const [shortTarget, setShortTarget] = useState("");
  const [extraPort, setExtraPort] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["status"] });

  const addMut = useMutation({
    mutationFn: () => addAlias(name.trim(), parseInt(port)),
    onSuccess: () => { setName(""); setPort(""); invalidate(); },
  });

  const removeMut = useMutation({
    mutationFn: (n: string) => removeAlias(n),
    onSettled: invalidate,
  });

  const addShortMut = useMutation({
    mutationFn: () => addShortAlias(shortName.trim(), shortTarget),
    onSuccess: () => { setShortName(""); setShortTarget(""); invalidate(); },
  });

  const removeShortMut = useMutation({
    mutationFn: (n: string) => removeShortAlias(n),
    onSettled: invalidate,
  });

  const scanMut = useMutation({
    mutationFn: (p: Parameters<typeof updateScan>[0]) => updateScan(p),
    onSettled: invalidate,
  });

  if (!data) {
    return (
      <div className="page">
        <div className="loading"><Loader2 size={18} /> Loading...</div>
      </div>
    );
  }

  const {
    aliases,
    short_aliases: shortAliases,
    scan_ports: scanPorts,
    scan_ranges: scanRanges,
    config: cfg,
  } = data;
  const ps = cfg.proxy_port === 80 ? "" : `:${cfg.proxy_port}`;
  const scanCommon = cfg.scan_common;
  const scannedCount = data.services.filter((s) => s.source === "scan").length;

  // Docker services for the short alias target dropdown
  const dockerServices = data.services.filter(s => s.source === "docker");

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Aliases & Scanning</h2>
          <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
            {Object.keys(aliases).length} alias{Object.keys(aliases).length !== 1 ? "es" : ""}
            &middot; {Object.keys(shortAliases || {}).length} shortcut{Object.keys(shortAliases || {}).length !== 1 ? "s" : ""}
            &middot; {scannedCount} scanned
          </p>
        </div>
      </div>

      {/* Add alias */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title"><Link size={14} /> Add Alias</span>
        </div>
        <div className="card-body">
          <div className="info-banner" style={{ marginBottom: 16 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Map a name to any local port. Access at{" "}
              <code>http://name{cfg.domain}{ps}</code>
            </span>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); addMut.mutate(); }}
            className="inline-form"
          >
            <div className="field" style={{ flex: 1 }}>
              <span className="field-label">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="myapp" required />
            </div>
            <div className="field" style={{ width: 120 }}>
              <span className="field-label">Port</span>
              <input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="3000" required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={addMut.isPending || !name || !port} style={{ marginBottom: 1 }}>
              <Plus size={14} /> Add
            </button>
          </form>
        </div>
      </div>

      {/* Alias list */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title"><Link size={14} /> Aliases</span>
          <span className="badge badge-purple">{Object.keys(aliases).length}</span>
        </div>
        <div className="card-body" style={{ padding: Object.keys(aliases).length ? "0 20px" : undefined }}>
          {Object.keys(aliases).length === 0 ? (
            <div style={{ padding: "24px 0", color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>
              No aliases yet. Add one above to get started.
            </div>
          ) : (
            Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b)).map(([n, p]) => {
              const svc = data.services.find((s) => s.name === n);
              const alive = svc?.state === "running";
              return (
                <div key={n} className="container-row">
                  <span className={`dot ${alive ? "dot-green" : "dot-red"}`} />
                  <span className="container-name">{n}</span>
                  <span style={{ color: "var(--text-muted)", fontFamily: "var(--mono)", fontSize: 12 }}>:{p}</span>
                  <a
                    href={`http://${n}${cfg.domain}${ps}`}
                    target="_blank"
                    rel="noopener"
                    className="container-url"
                    style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {n}{cfg.domain}{ps} <ExternalLink size={10} />
                  </a>
                  <button className="btn btn-red btn-sm btn-icon" onClick={() => removeMut.mutate(n)} disabled={removeMut.isPending}>
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Short aliases / shortcuts */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title"><Zap size={14} /> Shortcuts</span>
          <span className="badge badge-yellow">{Object.keys(shortAliases || {}).length}</span>
        </div>
        <div className="card-body">
          <div className="info-banner" style={{ marginBottom: 16 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Create short names for long service names.{" "}
              <code>pgadmin</code> instead of <code>global_pgadmin</code>.
              {cfg.docker_strip_prefix && (
                <><br />Auto-stripping prefix: <code>{cfg.docker_strip_prefix}</code></>
              )}
            </span>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); addShortMut.mutate(); }}
            className="inline-form"
            style={{ marginBottom: 16 }}
          >
            <div className="field" style={{ width: 140 }}>
              <span className="field-label">Short name</span>
              <input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="pgadmin" required />
            </div>
            <ArrowRight size={14} style={{ color: "var(--text-muted)", alignSelf: "center", marginTop: 18, flexShrink: 0 }} />
            <div className="field" style={{ flex: 1 }}>
              <span className="field-label">Target service</span>
              {dockerServices.length > 0 ? (
                <select
                  value={shortTarget}
                  onChange={(e) => setShortTarget(e.target.value)}
                  required
                  style={{ fontFamily: "var(--mono)", fontSize: 13 }}
                >
                  <option value="">Select a service...</option>
                  {data.services
                    .filter(s => s.source === "docker" || s.source === "alias")
                    .map(s => (
                      <option key={s.name} value={s.name}>{s.name} (:{s.port})</option>
                    ))
                  }
                </select>
              ) : (
                <input value={shortTarget} onChange={(e) => setShortTarget(e.target.value)} placeholder="global_pgadmin" required />
              )}
            </div>
            <button className="btn btn-primary" type="submit" disabled={addShortMut.isPending || !shortName || !shortTarget} style={{ marginBottom: 1 }}>
              <Plus size={14} /> Add
            </button>
          </form>

          {Object.keys(shortAliases || {}).length === 0 ? (
            <div style={{ color: "var(--text-dim)", fontSize: 12, textAlign: "center", padding: "8px 0" }}>
              No shortcuts yet.
            </div>
          ) : (
            <div style={{ padding: "0" }}>
              {Object.entries(shortAliases || {}).sort(([a], [b]) => a.localeCompare(b)).map(([short, target]) => (
                <div key={short} className="container-row">
                  <Zap size={13} style={{ color: "var(--yellow)", flexShrink: 0 }} />
                  <span className="container-name" style={{ minWidth: 100 }}>{short}</span>
                  <ArrowRight size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{target}</span>
                  <a
                    href={`http://${short}${cfg.domain}${ps}`}
                    target="_blank"
                    rel="noopener"
                    className="container-url"
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {short}{cfg.domain} <ExternalLink size={10} />
                  </a>
                  <button className="btn btn-red btn-sm btn-icon" onClick={() => removeShortMut.mutate(short)} disabled={removeShortMut.isPending}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Port scanning */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Radar size={14} /> Port Scanning</span>
          <span className="badge badge-green">{scannedCount} found</span>
        </div>
        <div className="card-body">
          <label className="toggle-row" style={{ marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={scanCommon}
              onChange={(e) => scanMut.mutate({ common: e.target.checked })}
            />
            <div>
              <div className="toggle-label">Scan common dev ports</div>
              <div className="toggle-desc">
                React, Vite, Next.js, Flask, Django, PostgreSQL, Redis, and ~50 more
              </div>
            </div>
          </label>

          {/* Port ranges */}
          <div style={{ marginBottom: 20 }}>
            <span className="field-label" style={{ display: "block", marginBottom: 8 }}>Port Ranges</span>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const lo = parseInt(rangeFrom), hi = parseInt(rangeTo);
                if (lo > 0 && hi > 0 && hi >= lo) {
                  scanMut.mutate({ ranges: [...(scanRanges || []), [lo, hi]] });
                  setRangeFrom(""); setRangeTo("");
                }
              }}
              className="inline-form"
              style={{ marginBottom: 10 }}
            >
              <input type="number" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} placeholder="From" style={{ width: 100 }} />
              <span style={{ color: "var(--text-muted)", alignSelf: "center", padding: "0 2px" }}>&ndash;</span>
              <input type="number" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} placeholder="To" style={{ width: 100 }} />
              <button className="btn btn-primary btn-sm" type="submit" disabled={!rangeFrom || !rangeTo}>
                <Plus size={13} /> Add
              </button>
            </form>
            {(scanRanges || []).length === 0 ? (
              <div style={{ color: "var(--text-dim)", fontSize: 12 }}>No custom ranges.</div>
            ) : (
              <div className="chip-list">
                {(scanRanges || []).map((r, i) => (
                  <span key={i} className="chip chip-blue" onClick={() => scanMut.mutate({ ranges: (scanRanges || []).filter((_, idx) => idx !== i) })}>
                    {r[0]}&ndash;{r[1]} <Trash2 size={10} />
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Extra individual ports */}
          <div>
            <span className="field-label" style={{ display: "block", marginBottom: 8 }}>Extra Ports</span>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const p = parseInt(extraPort);
                if (p > 0 && !scanPorts.includes(p)) {
                  scanMut.mutate({ ports: [...scanPorts, p] });
                  setExtraPort("");
                }
              }}
              className="inline-form"
              style={{ marginBottom: 10 }}
            >
              <input type="number" value={extraPort} onChange={(e) => setExtraPort(e.target.value)} placeholder="Port" style={{ width: 120 }} />
              <button className="btn btn-primary btn-sm" type="submit" disabled={!extraPort}>
                <Plus size={13} /> Add
              </button>
            </form>
            {scanPorts.length === 0 ? (
              <div style={{ color: "var(--text-dim)", fontSize: 12 }}>No extra ports.</div>
            ) : (
              <div className="chip-list">
                {scanPorts.map((p) => (
                  <span key={p} className="chip chip-gray" onClick={() => scanMut.mutate({ ports: scanPorts.filter((x) => x !== p) })}>
                    :{p} <Trash2 size={10} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
