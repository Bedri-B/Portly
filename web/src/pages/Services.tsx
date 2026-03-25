import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStatus, refreshServices, type StatusResponse } from "../lib/api";
import {
  Globe,
  ExternalLink,
  Loader2,
  ArrowRight,
  RefreshCw,
  Container,
  Link,
  Radar,
  Lock,
  Zap,
} from "lucide-react";

const SOURCE_META: Record<string, { label: string; color: string; Icon: typeof Globe }> = {
  docker: { label: "Docker", color: "badge-blue", Icon: Container },
  alias: { label: "Alias", color: "badge-purple", Icon: Link },
  scan: { label: "Scanned", color: "badge-yellow", Icon: Radar },
  unknown: { label: "Unknown", color: "badge-gray", Icon: Globe },
};

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
  const portSuffix = cfg.proxy_port === 80 ? "" : `:${cfg.proxy_port}`;

  const running = services.filter(s => s.state === "running").length;
  const stopped = services.length - running;

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
          <span className="badge badge-gray">
            <Globe size={11} /> *{cfg.domain}{portSuffix}
          </span>
          {cfg.https_enabled && (
            <span className="badge badge-green">
              <Lock size={11} /> HTTPS
            </span>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending}
          >
            <RefreshCw size={13} className={refreshMut.isPending ? "spinning" : ""} />
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
        <div className="services-grid">
          {services.map((s, i) => {
            const meta = SOURCE_META[s.source] || SOURCE_META.unknown;
            const { Icon } = meta;
            return (
              <div
                key={s.name}
                className="service-row"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <span className={`dot ${s.state === "running" ? "dot-green" : "dot-red"}`} />
                <span className="service-name">{s.name}</span>
                <a href={s.url} target="_blank" rel="noopener" className="service-url">
                  {s.url} <ExternalLink size={10} />
                </a>
                <ArrowRight size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <span className="service-direct">:{s.port}</span>
                <span className={`badge ${meta.color}`}>
                  <Icon size={10} /> {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
