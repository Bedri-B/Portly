import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStatus, refreshServices, type StatusResponse } from "../lib/api";
import {
  Globe,
  ExternalLink,
  Info,
  Loader2,
  ArrowRight,
  RefreshCw,
  Container,
  Link,
  Radar,
  Lock,
} from "lucide-react";

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  docker: { label: "Docker", color: "badge-blue" },
  alias: { label: "Alias", color: "badge-green" },
  scan: { label: "Scanned", color: "badge-yellow" },
  unknown: { label: "Unknown", color: "badge-gray" },
};

export default function Services() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<StatusResponse>({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });
  const refreshMut = useMutation({
    mutationFn: refreshServices,
    onSettled: () => qc.invalidateQueries({ queryKey: ["status"] }),
  });

  if (isLoading || !data) {
    return (
      <div className="page">
        <div className="loading">
          <Loader2 size={20} /> &nbsp;Loading...
        </div>
      </div>
    );
  }

  const { services, config: cfg } = data;
  const portSuffix = cfg.proxy_port === 80 ? "" : `:${cfg.proxy_port}`;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Services</h2>
        <div className="page-header-actions">
          <span className="badge badge-blue">
            <Globe size={12} /> *{cfg.domain}
            {portSuffix}
          </span>
          {cfg.https_enabled && (
            <span className="badge badge-green">
              <Lock size={12} /> HTTPS :{cfg.https_port}
            </span>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="info-banner">
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          Access any service by name: <code>http://&lt;name&gt;{cfg.domain}{portSuffix}</code>
          {cfg.https_enabled && (
            <>
              {" "}or <code>https://&lt;name&gt;{cfg.domain}{cfg.https_port === 443 ? "" : `:${cfg.https_port}`}</code>
            </>
          )}
          <br />
          Sources: Docker containers (auto-discovered), aliases (manual), scanned ports (auto-detected).
        </div>
      </div>

      {services.length === 0 ? (
        <div className="empty-state">
          <Globe size={40} />
          <p>No services found.</p>
          <p style={{ marginTop: 8, fontSize: 12 }}>
            Start a Docker container, add an alias, or configure scan ports.
          </p>
        </div>
      ) : (
        <div className="services-grid">
          {services.map((s) => {
            const src = SOURCE_LABELS[s.source] || SOURCE_LABELS.unknown;
            const Icon = s.source === "docker" ? Container : s.source === "alias" ? Link : Radar;
            return (
              <div key={s.name} className="service-row">
                <span className={`dot ${s.state === "running" ? "dot-green" : "dot-red"}`} />
                <span className="service-name">{s.name}</span>
                <a href={s.url} target="_blank" rel="noopener" className="service-url">
                  {s.url} <ExternalLink size={11} style={{ verticalAlign: "middle" }} />
                </a>
                <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
                <span className="service-direct">{s.direct}</span>
                <span className={`badge ${src.color}`}>
                  <Icon size={10} /> {src.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
