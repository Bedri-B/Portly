import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStatus, addAlias, removeAlias, addShortAlias, removeShortAlias, updateScan, type StatusResponse } from "@/lib/api";
import { Plus, Trash2, Loader2, Link, Radar, Zap, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Aliases() {
  const qc = useQueryClient();
  const { data } = useQuery<StatusResponse>({ queryKey: ["status"], queryFn: fetchStatus });

  const [name, setName] = useState("");
  const [port, setPort] = useState("");
  const [shortName, setShortName] = useState("");
  const [shortTarget, setShortTarget] = useState("");
  const [extraPort, setExtraPort] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["status"] });
  const addMut = useMutation({ mutationFn: () => addAlias(name.trim(), parseInt(port)), onSuccess: () => { setName(""); setPort(""); invalidate(); } });
  const removeMut = useMutation({ mutationFn: (n: string) => removeAlias(n), onSettled: invalidate });
  const addShortMut = useMutation({ mutationFn: () => addShortAlias(shortName.trim(), shortTarget), onSuccess: () => { setShortName(""); setShortTarget(""); invalidate(); } });
  const removeShortMut = useMutation({ mutationFn: (n: string) => removeShortAlias(n), onSettled: invalidate });
  const scanMut = useMutation({ mutationFn: (p: Parameters<typeof updateScan>[0]) => updateScan(p), onSettled: invalidate });

  if (!data) return <div className="flex items-center justify-center h-full text-muted-foreground gap-2"><Loader2 size={18} className="animate-spin" /> Loading...</div>;

  const { aliases, short_aliases: shortAliases, scan_ports: scanPorts, scan_ranges: scanRanges, config: cfg } = data;
  const ps = cfg.proxy_port === 80 ? "" : `:${cfg.proxy_port}`;
  const scannedCount = data.services.filter((s) => s.source === "scan").length;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Aliases & Scanning</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {Object.keys(aliases).length} aliases &middot; {Object.keys(shortAliases || {}).length} shortcuts &middot; {scannedCount} scanned
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Add alias */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Link size={14} /> Add Alias</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Map a name to any local port &rarr; <code className="bg-muted px-1 rounded text-xs">http://name{cfg.domain}{ps}</code>
              </p>
              <form onSubmit={(e) => { e.preventDefault(); addMut.mutate(); }} className="flex gap-2">
                <div className="flex-1">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="myapp" required />
                </div>
                <div className="w-24">
                  <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="3000" required />
                </div>
                <Button type="submit" size="sm" disabled={addMut.isPending || !name || !port}>
                  <Plus size={14} /> Add
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Alias list */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Link size={14} /> Aliases</CardTitle>
                <Badge variant="secondary">{Object.keys(aliases).length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {Object.keys(aliases).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">No aliases yet.</p>
              ) : (
                <Table>
                  <TableBody>
                    {Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b)).map(([n, p]) => {
                      const svc = data.services.find((s) => s.name === n);
                      const alive = svc?.state === "running";
                      return (
                        <TableRow key={n}>
                          <TableCell className="w-6">
                            <span className={`inline-block w-2 h-2 rounded-full ${alive ? "bg-green-500" : "bg-red-500"}`} />
                          </TableCell>
                          <TableCell className="font-semibold">{n}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">:{p}</TableCell>
                          <TableCell>
                            <a href={`http://${n}${cfg.domain}${ps}`} target="_blank" rel="noopener" className="text-xs font-mono text-primary hover:underline flex items-center gap-1">
                              {n}{cfg.domain} <ExternalLink size={10} />
                            </a>
                          </TableCell>
                          <TableCell className="w-10">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeMut.mutate(n)}>
                              <Trash2 size={13} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Shortcuts */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Zap size={14} /> Shortcuts</CardTitle>
                <Badge variant="secondary">{Object.keys(shortAliases || {}).length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Create short names for long services: <code className="bg-muted px-1 rounded text-xs">pgadmin</code> instead of <code className="bg-muted px-1 rounded text-xs">global_pgadmin</code>
              </p>
              <form onSubmit={(e) => { e.preventDefault(); addShortMut.mutate(); }} className="flex gap-2 mb-3">
                <div className="w-32">
                  <Input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="pgadmin" required />
                </div>
                <ArrowRight size={14} className="self-center text-muted-foreground flex-shrink-0" />
                <div className="flex-1">
                  <Select value={shortTarget} onValueChange={(v) => setShortTarget(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Select service..." /></SelectTrigger>
                    <SelectContent>
                      {data.services.filter(s => s.source === "docker" || s.source === "alias").map(s => (
                        <SelectItem key={s.name} value={s.name}>{s.name} (:{s.port})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" size="sm" disabled={addShortMut.isPending || !shortName || !shortTarget}>
                  <Plus size={14} />
                </Button>
              </form>
              {Object.keys(shortAliases || {}).length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-2">No shortcuts yet.</p>
              ) : (
                <div className="space-y-1">
                  {Object.entries(shortAliases || {}).sort(([a], [b]) => a.localeCompare(b)).map(([short, target]) => (
                    <div key={short} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted/50">
                      <Zap size={12} className="text-yellow-500 flex-shrink-0" />
                      <span className="font-semibold">{short}</span>
                      <ArrowRight size={12} className="text-muted-foreground" />
                      <span className="text-xs font-mono text-muted-foreground flex-1">{target}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeShortMut.mutate(short)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - scanning */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Radar size={14} /> Port Scanning</CardTitle>
                <Badge variant="outline" className="text-green-500 border-green-500/30">{scannedCount} found</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Common ports toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="font-semibold">Scan common dev ports</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">React, Vite, Flask, PostgreSQL, Redis, etc. (~50 ports)</p>
                </div>
                <Switch checked={cfg.scan_common} onCheckedChange={(v) => scanMut.mutate({ common: v })} />
              </div>

              {/* Ranges */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Port Ranges</Label>
                <form onSubmit={(e) => { e.preventDefault(); const lo = parseInt(rangeFrom), hi = parseInt(rangeTo); if (lo > 0 && hi >= lo) { scanMut.mutate({ ranges: [...(scanRanges || []), [lo, hi]] }); setRangeFrom(""); setRangeTo(""); } }} className="flex gap-2 mt-2 mb-2">
                  <Input type="number" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} placeholder="From" className="w-24" />
                  <span className="self-center text-muted-foreground">–</span>
                  <Input type="number" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} placeholder="To" className="w-24" />
                  <Button size="sm" type="submit" disabled={!rangeFrom || !rangeTo}><Plus size={13} /></Button>
                </form>
                <div className="flex flex-wrap gap-1.5">
                  {(scanRanges || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No custom ranges.</p>
                  ) : (scanRanges || []).map((r, i) => (
                    <Badge key={i} variant="outline" className="cursor-pointer hover:bg-destructive hover:text-white transition-colors" onClick={() => scanMut.mutate({ ranges: (scanRanges || []).filter((_, idx) => idx !== i) })}>
                      {r[0]}–{r[1]} <Trash2 size={10} className="ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Extra ports */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Extra Ports</Label>
                <form onSubmit={(e) => { e.preventDefault(); const p = parseInt(extraPort); if (p > 0 && !scanPorts.includes(p)) { scanMut.mutate({ ports: [...scanPorts, p] }); setExtraPort(""); } }} className="flex gap-2 mt-2 mb-2">
                  <Input type="number" value={extraPort} onChange={(e) => setExtraPort(e.target.value)} placeholder="Port" className="w-24" />
                  <Button size="sm" type="submit" disabled={!extraPort}><Plus size={13} /></Button>
                </form>
                <div className="flex flex-wrap gap-1.5">
                  {scanPorts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No extra ports.</p>
                  ) : scanPorts.map((p) => (
                    <Badge key={p} variant="secondary" className="cursor-pointer hover:bg-destructive hover:text-white transition-colors font-mono" onClick={() => scanMut.mutate({ ports: scanPorts.filter((x) => x !== p) })}>
                      :{p} <Trash2 size={10} className="ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
