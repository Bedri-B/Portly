import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchStatus,
  addAlias,
  removeAlias,
  updateScan,
  type StatusResponse,
} from "../lib/api";
import { Plus, Trash2, Loader2, Link, Radar, Info } from "lucide-react";

export default function Aliases() {
  const qc = useQueryClient();
  const { data } = useQuery<StatusResponse>({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });

  const [name, setName] = useState("");
  const [port, setPort] = useState("");
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

  const scanMut = useMutation({
    mutationFn: (p: Parameters<typeof updateScan>[0]) => updateScan(p),
    onSettled: invalidate,
  });

  if (!data) {
    return (
      <div className="page">
        <div className="loading"><Loader2 size={20} /> &nbsp;Loading...</div>
      </div>
    );
  }

  const {
    aliases,
    scan_ports: scanPorts,
    scan_ranges: scanRanges,
    config: cfg,
  } = data;
  const ps = cfg.proxy_port === 80 ? "" : `:${cfg.proxy_port}`;
  const scanCommon = cfg.scan_common;

  const handleAddExtraPort = () => {
    const p = parseInt(extraPort);
    if (p > 0 && !scanPorts.includes(p)) {
      scanMut.mutate({ ports: [...scanPorts, p] });
      setExtraPort("");
    }
  };

  const handleRemoveExtraPort = (p: number) => {
    scanMut.mutate({ ports: scanPorts.filter((x) => x !== p) });
  };

  const handleAddRange = () => {
    const lo = parseInt(rangeFrom), hi = parseInt(rangeTo);
    if (lo > 0 && hi > 0 && hi >= lo) {
      scanMut.mutate({ ranges: [...(scanRanges || []), [lo, hi]] });
      setRangeFrom(""); setRangeTo("");
    }
  };

  const handleRemoveRange = (i: number) => {
    scanMut.mutate({ ranges: (scanRanges || []).filter((_, idx) => idx !== i) });
  };

  const scannedCount = data.services.filter((s) => s.source === "scan").length;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Aliases & Scanning</h2>
      </div>

      {/* Add alias */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title"><Link size={15} /> Add Alias</span>
        </div>
        <div className="card-body">
          <div className="info-banner" style={{ marginBottom: 16 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Map a name to any local port. Run your services normally, access them at{" "}
              <code>http://name{cfg.domain}{ps}</code>.
            </span>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); addMut.mutate(); }}
            style={{ display: "flex", gap: 8, alignItems: "flex-end" }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="myapp" required />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, width: 120 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>Port</span>
              <input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="3000" required />
            </label>
            <button className="btn btn-primary" type="submit" disabled={addMut.isPending || !name || !port}>
              <Plus size={14} /> Add
            </button>
          </form>
        </div>
      </div>

      {/* Alias list */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title"><Link size={15} /> Aliases ({Object.keys(aliases).length})</span>
        </div>
        <div className="card-body" style={{ padding: Object.keys(aliases).length ? "0 20px" : undefined }}>
          {Object.keys(aliases).length === 0 ? (
            <div style={{ padding: "20px 0", color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>
              No aliases yet.
            </div>
          ) : (
            Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b)).map(([n, p]) => {
              const svc = data.services.find((s) => s.name === n);
              const alive = svc?.state === "running";
              return (
                <div key={n} className="container-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className={`dot ${alive ? "dot-green" : "dot-red"}`} />
                  <span className="container-name" style={{ minWidth: 140 }}>{n}</span>
                  <span style={{ color: "var(--text-dim)", fontFamily: "var(--mono)", fontSize: 12 }}>:{p}</span>
                  <a href={`http://${n}${cfg.domain}${ps}`} target="_blank" rel="noopener" className="container-url" style={{ flex: 1 }}>
                    http://{n}{cfg.domain}{ps}
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

      {/* Port scanning */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Radar size={15} /> Port Scanning</span>
          <span className="badge badge-green">{scannedCount} found</span>
        </div>
        <div className="card-body">
          <div className="info-banner" style={{ marginBottom: 16 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Portly scans ports every 10s and auto-registers anything listening.
              Toggle common dev ports, add ranges, or individual ports.
            </span>
          </div>

          {/* Common ports toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 16, padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: "var(--radius)" }}>
            <input
              type="checkbox"
              checked={scanCommon}
              onChange={(e) => scanMut.mutate({ common: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Scan common dev ports</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                React, Vite, Next.js, Flask, Django, PostgreSQL, Redis, etc.
                (~50 well-known ports)
              </div>
            </div>
          </label>

          {/* Port ranges */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Port Ranges</div>
            <form
              onSubmit={(e) => { e.preventDefault(); handleAddRange(); }}
              style={{ display: "flex", gap: 8, marginBottom: 8 }}
            >
              <input
                type="number" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)}
                placeholder="From" style={{ width: 100 }}
              />
              <span style={{ color: "var(--text-muted)", alignSelf: "center" }}>-</span>
              <input
                type="number" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)}
                placeholder="To" style={{ width: 100 }}
              />
              <button className="btn btn-primary btn-sm" type="submit" disabled={!rangeFrom || !rangeTo}>
                <Plus size={14} /> Add Range
              </button>
            </form>
            {(scanRanges || []).length === 0 ? (
              <div style={{ color: "var(--text-dim)", fontSize: 12 }}>No custom ranges.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(scanRanges || []).map((r, i) => (
                  <span key={i} className="badge badge-blue" style={{ cursor: "pointer", gap: 6 }} onClick={() => handleRemoveRange(i)}>
                    {r[0]}-{r[1]} <Trash2 size={10} />
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Extra individual ports */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Extra Ports</div>
            <form
              onSubmit={(e) => { e.preventDefault(); handleAddExtraPort(); }}
              style={{ display: "flex", gap: 8, marginBottom: 8 }}
            >
              <input type="number" value={extraPort} onChange={(e) => setExtraPort(e.target.value)} placeholder="Port" style={{ width: 120 }} />
              <button className="btn btn-primary btn-sm" type="submit" disabled={!extraPort}>
                <Plus size={14} /> Add
              </button>
            </form>
            {scanPorts.length === 0 ? (
              <div style={{ color: "var(--text-dim)", fontSize: 12 }}>No extra ports.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {scanPorts.map((p) => (
                  <span key={p} className="badge badge-gray" style={{ cursor: "pointer", gap: 6 }} onClick={() => handleRemoveExtraPort(p)}>
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
