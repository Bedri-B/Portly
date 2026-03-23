import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStatus, addAlias, removeAlias, updateScanPorts, type StatusResponse } from "../lib/api";
import { Plus, Trash2, Loader2, Link, Radar, Info } from "lucide-react";

export default function Aliases() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<StatusResponse>({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });

  const [name, setName] = useState("");
  const [port, setPort] = useState("");
  const [scanInput, setScanInput] = useState("");

  const addMut = useMutation({
    mutationFn: () => addAlias(name.trim(), parseInt(port)),
    onSuccess: () => {
      setName("");
      setPort("");
      qc.invalidateQueries({ queryKey: ["status"] });
    },
  });

  const removeMut = useMutation({
    mutationFn: (n: string) => removeAlias(n),
    onSettled: () => qc.invalidateQueries({ queryKey: ["status"] }),
  });

  const scanMut = useMutation({
    mutationFn: (ports: number[]) => updateScanPorts(ports),
    onSettled: () => qc.invalidateQueries({ queryKey: ["status"] }),
  });

  if (isLoading || !data) {
    return (
      <div className="page">
        <div className="loading"><Loader2 size={20} /> &nbsp;Loading...</div>
      </div>
    );
  }

  const { aliases, scan_ports: scanPorts, config: cfg } = data;
  const ps = cfg.proxy_port === 80 ? "" : `:${cfg.proxy_port}`;

  const handleAddScanPort = () => {
    const p = parseInt(scanInput);
    if (p > 0 && !scanPorts.includes(p)) {
      scanMut.mutate([...scanPorts, p]);
      setScanInput("");
    }
  };

  const handleRemoveScanPort = (p: number) => {
    scanMut.mutate(scanPorts.filter((x) => x !== p));
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Aliases & Port Scanning</h2>
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
              Map a name to any local port. Run <code>npm run dev</code> on port 3000 as usual,
              then access it at <code>http://myapp{cfg.domain}{ps}</code>.
            </span>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); addMut.mutate(); }}
            style={{ display: "flex", gap: 8, alignItems: "flex-end" }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="myapp"
                required
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, width: 120 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>Port</span>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="3000"
                required
              />
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
              No aliases yet. Add one above.
            </div>
          ) : (
            Object.entries(aliases)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([n, p]) => {
                const svc = data.services.find((s) => s.name === n);
                const alive = svc?.state === "running";
                return (
                  <div key={n} className="container-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className={`dot ${alive ? "dot-green" : "dot-red"}`} />
                    <span className="container-name" style={{ minWidth: 140 }}>{n}</span>
                    <span style={{ color: "var(--text-dim)", fontFamily: "var(--mono)", fontSize: 12 }}>
                      :{p}
                    </span>
                    <a
                      href={`http://${n}${cfg.domain}${ps}`}
                      target="_blank"
                      rel="noopener"
                      className="container-url"
                      style={{ flex: 1 }}
                    >
                      http://{n}{cfg.domain}{ps}
                    </a>
                    <button
                      className="btn btn-red btn-sm btn-icon"
                      onClick={() => removeMut.mutate(n)}
                      disabled={removeMut.isPending}
                    >
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
        </div>
        <div className="card-body">
          <div className="info-banner" style={{ marginBottom: 16 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Add ports to auto-detect. If something is listening, it shows up in Services
              as <code>port-XXXX</code>. Add an alias for a better name.
            </span>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); handleAddScanPort(); }}
            style={{ display: "flex", gap: 8, marginBottom: 12 }}
          >
            <input
              type="number"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Port number"
              style={{ width: 140 }}
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={!scanInput}>
              <Plus size={14} /> Add
            </button>
          </form>

          {scanPorts.length === 0 ? (
            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>No ports being scanned.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {scanPorts.map((p) => (
                <span
                  key={p}
                  className="badge badge-gray"
                  style={{ cursor: "pointer", gap: 6 }}
                  onClick={() => handleRemoveScanPort(p)}
                >
                  :{p} <Trash2 size={10} />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
