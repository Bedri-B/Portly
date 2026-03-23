import { useQuery } from "@tanstack/react-query";
import { fetchStatus, type StatusResponse } from "../lib/api";
import { Globe, ExternalLink, Info, Loader2, ArrowRight } from "lucide-react";

export default function Services() {
  const { data, isLoading } = useQuery<StatusResponse>({
    queryKey: ["status"],
    queryFn: fetchStatus,
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

  const services = data.services || [];
  const { domain, proxy_port } = data.config;
  const portSuffix = proxy_port === 80 ? "" : `:${proxy_port}`;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Services</h2>
        <span className="badge badge-blue">
          <Globe size={12} /> *{domain}
          {portSuffix}
        </span>
      </div>

      <div className="info-banner">
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          Access any container by name instead of port number.
          <br />
          <code>
            http://&lt;name&gt;{domain}
            {portSuffix}
          </code>{" "}
          proxies to the container's published port.
          <br />
          Fuzzy matching: <code>postgres{domain}</code> matches{" "}
          <code>global_postgres</code>. Configure domain and port in{" "}
          <strong>Settings</strong>.
        </div>
      </div>

      {services.length === 0 ? (
        <div className="empty-state">
          <Globe size={40} />
          <p>No services with published ports are running.</p>
          <p style={{ marginTop: 8, fontSize: 12 }}>
            Start some containers to see them here.
          </p>
        </div>
      ) : (
        <div className="services-grid">
          {services.map((s) => (
            <div key={s.name} className="service-row">
              <span
                className={`dot ${s.state === "running" ? "dot-green" : "dot-red"}`}
              />
              <span className="service-name">{s.name}</span>
              <a
                href={s.url}
                target="_blank"
                rel="noopener"
                className="service-url"
              >
                {s.url}{" "}
                <ExternalLink
                  size={11}
                  style={{ verticalAlign: "middle" }}
                />
              </a>
              <ArrowRight
                size={14}
                style={{ color: "var(--text-muted)" }}
              />
              <span className="service-direct">{s.direct}</span>
              <span className="badge badge-gray">{s.stack}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
