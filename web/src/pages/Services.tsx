import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStatus, refreshServices, type StatusResponse, type ServiceInfo } from "@/lib/api";
import { Globe, Loader2, RefreshCw, Container, Link, Radar, Lock, Zap, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { ChevronsUpDown } from "lucide-react";

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
        <div className="space-y-4">
          {order.filter(k => groups[k]?.length).map(source => {
            const meta = SOURCE_META[source];
            const items = groups[source]!;
            const { Icon } = meta;
            const runningInGroup = items.filter(s => s.state === "running").length;
            return (
              <Collapsible key={source} defaultOpen>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <Icon size={15} className="text-muted-foreground" />
                        <span className="text-sm font-semibold">{meta.label}</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">{meta.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-green-500 border-green-500/30 text-[10px]">{runningInGroup} up</Badge>
                        <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                        <ChevronsUpDown size={14} className="text-muted-foreground" />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Separator />
                    <CardContent className="p-0">
                      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3 p-4">
                        {items.map(s => (
                          <ServiceCard key={s.name} service={s} httpsOn={httpsOn} copied={copied} onCopy={handleCopy} />
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ServiceCard({ service: s, httpsOn, copied, onCopy }: {
  service: ServiceInfo; httpsOn: boolean; copied: string; onCopy: (u: string) => void;
}) {
  const isUp = s.state === "running";
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 hover:border-muted-foreground/20 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isUp ? "bg-green-500 shadow-[0_0_8px] shadow-green-500/50" : "bg-red-500 shadow-[0_0_8px] shadow-red-500/50"}`} />
          <span className="font-semibold text-sm truncate">{s.name}</span>
        </div>
        <Badge variant={isUp ? "default" : "destructive"} className="text-[10px] flex-shrink-0">
          {isUp ? "Running" : "Stopped"}
        </Badge>
      </div>

      {/* Details */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">localhost:{s.port}</span>
        {s.image && (
          <>
            <Separator orientation="vertical" className="h-3" />
            <span className="truncate font-mono" title={s.image}>{s.image}</span>
          </>
        )}
      </div>

      {/* URLs */}
      <div className="space-y-1.5">
        <UrlRow label="HTTP" url={s.http_url} copied={copied} onCopy={onCopy} icon={<Globe size={11} className="text-blue-400" />} />
        {httpsOn && s.https_url && (
          <UrlRow label="HTTPS" url={s.https_url} copied={copied} onCopy={onCopy} icon={<Lock size={11} className="text-green-400" />} variant="https" />
        )}
      </div>
    </div>
  );
}

function UrlRow({ label, url, copied, onCopy, icon, variant }: {
  label: string; url: string; copied: string; onCopy: (u: string) => void;
  icon: React.ReactNode; variant?: "https";
}) {
  const isCopied = copied === url;
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 group">
      {icon}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-9 flex-shrink-0">{label}</span>
      <a href={url} target="_blank" rel="noopener"
        className={`text-xs font-mono truncate flex-1 transition-colors ${variant === "https" ? "text-green-400 hover:text-green-300" : "text-blue-400 hover:text-blue-300"}`}
      >{url}</a>
      <button onClick={() => onCopy(url)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all p-1 rounded-sm hover:bg-accent flex-shrink-0" title="Copy">
        {isCopied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
      </button>
    </div>
  );
}
