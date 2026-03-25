import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStatus, refreshServices, type StatusResponse, type ServiceInfo } from "@/lib/api";
import { Globe, Loader2, RefreshCw, Container, Link, Radar, Lock, Zap, Copy, Check, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SOURCE_META: Record<string, { label: string; description: string; Icon: typeof Globe }> = {
  docker: { label: "Docker Containers", description: "Auto-discovered from running containers", Icon: Container },
  alias: { label: "Aliases", description: "Manually mapped name → port", Icon: Link },
  scan: { label: "Scanned Ports", description: "Auto-detected listening services", Icon: Radar },
  unknown: { label: "Other", description: "Unknown source", Icon: Globe },
};

export default function Services() {
  const qc = useQueryClient();
  const { data } = useQuery<StatusResponse>({ queryKey: ["status"], queryFn: fetchStatus });
  const refreshMut = useMutation({
    mutationFn: refreshServices,
    onSettled: () => qc.invalidateQueries({ queryKey: ["status"] }),
  });
  const [copied, setCopied] = useState("");

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(url);
    setTimeout(() => setCopied(""), 1500);
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 size={18} className="animate-spin" /> Loading services...
      </div>
    );
  }

  const { services, config: cfg } = data;
  const httpsOn = cfg.https_enabled;
  const running = services.filter(s => s.state === "running").length;
  const stopped = services.length - running;

  // Group by source
  const groups: Record<string, ServiceInfo[]> = {};
  const order = ["docker", "alias", "scan", "unknown"];
  for (const s of services) {
    const key = order.includes(s.source) ? s.source : "unknown";
    (groups[key] ??= []).push(s);
  }

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Services</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {services.length} service{services.length !== 1 ? "s" : ""}
            {running > 0 && <> &middot; <span className="text-green-500">{running} running</span></>}
            {stopped > 0 && <> &middot; <span className="text-red-500">{stopped} stopped</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {httpsOn && (
            <Badge variant="outline" className="text-green-500 border-green-500/30">
              <Lock size={10} className="mr-1" /> HTTPS
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending}>
            <RefreshCw size={13} className={refreshMut.isPending ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Zap size={48} className="mb-4 opacity-30" />
          <p className="font-semibold text-base">No services found</p>
          <p className="text-sm mt-1">Start a Docker container, add an alias, or configure port scanning.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {order.filter(k => groups[k]?.length).map(source => {
            const meta = SOURCE_META[source];
            const items = groups[source]!;
            const { Icon } = meta;
            return (
              <Card key={source}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Icon size={14} /> {meta.label}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{meta.description}</span>
                      <Badge variant="secondary">{items.length}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {items.map(s => (
                      <ServiceRow key={s.name} service={s} httpsOn={httpsOn} copied={copied} onCopy={handleCopy} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ServiceRow({ service: s, httpsOn, copied, onCopy }: {
  service: ServiceInfo; httpsOn: boolean; copied: string; onCopy: (u: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40 transition-colors">
      {/* Status + Name */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.state === "running" ? "bg-green-500 shadow-[0_0_6px] shadow-green-500" : "bg-red-500 shadow-[0_0_6px] shadow-red-500"}`} />
      <span className="font-semibold text-sm w-44 truncate">{s.name}</span>

      {/* URLs */}
      <div className="flex-1 flex items-center gap-4 min-w-0">
        <UrlPill url={s.http_url} copied={copied} onCopy={onCopy} icon={<Globe size={11} className="text-muted-foreground" />} />
        {httpsOn && s.https_url && (
          <UrlPill url={s.https_url} copied={copied} onCopy={onCopy} icon={<Lock size={11} className="text-green-500" />} https />
        )}
      </div>

      {/* Target */}
      <span className="text-xs text-muted-foreground font-mono flex items-center gap-1 flex-shrink-0">
        <ArrowRight size={10} /> :{s.port}
      </span>
    </div>
  );
}

function UrlPill({ url, copied, onCopy, icon, https }: {
  url: string; copied: string; onCopy: (u: string) => void; icon: React.ReactNode; https?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 group min-w-0">
      {icon}
      <a
        href={url}
        target="_blank"
        rel="noopener"
        className={`text-xs font-mono truncate ${https ? "text-green-500 hover:text-green-400" : "text-primary hover:text-primary/80"} transition-colors`}
      >
        {url}
      </a>
      <button
        onClick={() => onCopy(url)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all p-0.5 rounded flex-shrink-0"
      >
        {copied === url ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
      </button>
    </div>
  );
}
