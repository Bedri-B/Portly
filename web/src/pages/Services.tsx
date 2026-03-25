import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStatus, refreshServices, type StatusResponse } from "../lib/api";
import {
  Globe,
  Loader2,
  ArrowRight,
  RefreshCw,
  Container,
  Link,
  Radar,
  Lock,
  Zap,
  Copy,
} from "lucide-react";
import { useState } from "react";

const SOURCE_META: Record<string, { label: string; color: string; Icon: typeof Globe }> = {
  docker: { label: "Docker", color: "badge-blue", Icon: Container },
  alias: { label: "Alias", color: "badge-purple", Icon: Link },
  scan: { label: "Scanned", color: "badge-yellow", Icon: Radar },
  unknown: { label: "Unknown", color: "badge-gray", Icon: Globe },
};

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export default function Services() {
  const qc = useQueryClient();
  const { data } = useQuery<StatusResponse>({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });
  const refreshMut = useMutation({
    mutationFn: refreshServices,
    onSettled: () => qc.invalidateQueries({ queryKey: ["status"] }),
  });
  const [copied, setCopied] = useState("");

  if (!data) {
    return (
      <div className="page">
        <div className="loading">
          <Loader2 size={18} /> Loading services...
        </div>
      </div>
    );
  }

  const { services, config: cfg } = data;
  const httpsOn = cfg.https_enabled;
  const running = services.filter(s => s.state === "running").length;
  const stopped = services.length - running;

  const handleCopy = (url: string) => {
    copyText(url);
    setCopied(url);
    setTimeout(() => setCopied(""), 1500);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Services</h2>
          <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
            {services.length} service{services.length !== 1 ? "s" : ""} discovered
            {running > 0 && <> &middot; <span style={{ color: "var(--green)" }}>{running} running</span></>}
            {stopped > 0 && <> &middot; <span style={{ color: "var(--red)" }}>{stopped} stopped</span></>}
          </p>
        </div>
        <div className="page-header-actions">
          {httpsOn && (
            <span className="badge badge-green">
              <Lock size={11} /> HTTPS
            </span>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="empty-state">
          <Zap size={48} />
          <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>No services found</p>
          <p style={{ fontSize: 13 }}>
            Start a Docker container, add an alias, or configure port scanning.
          </p>
        </div>
      ) : (
        <div className="services-list">
          {services.map((s, i) => {
            const meta = SOURCE_META[s.source] || SOURCE_META.unknown;
            const { Icon } = meta;
            return (
              <div
                key={s.name}
                className="svc-card"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <div className="svc-card-header">
                  <span className={`dot ${s.state === "running" ? "dot-green" : "dot-red"}`} />
                  <span className="svc-name">{s.name}</span>
                  <span className={`badge ${meta.color}`} style={{ marginLeft: "auto" }}>
                    <Icon size={10} /> {meta.label}
                  </span>
                </div>

                <div className="svc-card-urls">
                  {/* HTTP link */}
                  <div className="svc-url-row">
                    <Globe size={12} className="svc-url-icon" />
                    <a href={s.http_url} target="_blank" rel="noopener" className="svc-url-link">
                      {s.http_url}
                    </a>
                    <button
                      className="svc-url-copy"
                      onClick={() => handleCopy(s.http_url)}
                      title="Copy URL"
                    >
                      {copied === s.http_url ? "Copied!" : <Copy size={12} />}
                    </button>
                  </div>

                  {/* HTTPS link (when enabled) */}
                  {httpsOn && s.https_url && (
                    <div className="svc-url-row">
                      <Lock size={12} className="svc-url-icon" style={{ color: "var(--green)" }} />
                      <a href={s.https_url} target="_blank" rel="noopener" className="svc-url-link">
                        {s.https_url}
                      </a>
                      <button
                        className="svc-url-copy"
                        onClick={() => handleCopy(s.https_url!)}
                        title="Copy URL"
                      >
                        {copied === s.https_url ? "Copied!" : <Copy size={12} />}
                      </button>
                    </div>
                  )}
                </div>

                <div className="svc-card-footer">
                  <ArrowRight size={12} style={{ color: "var(--text-muted)" }} />
                  <span className="svc-direct">localhost:{s.port}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
