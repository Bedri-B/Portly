import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchStatus,
  dockerAction,
  refreshAll,
  stackAction,
  type StatusResponse,
} from "../lib/api";
import {
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";

export default function Overview() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<StatusResponse>({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });

  const dockerMut = useMutation({
    mutationFn: (action: "start" | "stop" | "restart") => dockerAction(action),
    onSettled: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["status"] }), 3000),
  });

  const refreshMut = useMutation({
    mutationFn: refreshAll,
    onSettled: () => qc.invalidateQueries({ queryKey: ["status"] }),
  });

  const stackMut = useMutation({
    mutationFn: ({ stack, action }: { stack: string; action: string }) =>
      stackAction(stack, action),
    onSettled: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["status"] }), 2000),
  });

  if (isLoading || !data) {
    return (
      <div className="page">
        <div className="loading">
          <Loader2 size={20} className="spin" /> &nbsp;Loading...
        </div>
      </div>
    );
  }

  const allContainers = Object.values(data.stacks).flatMap((s) => s.containers);
  const running = allContainers.filter((c) => c.state === "running").length;
  const stopped = allContainers.filter((c) => c.state !== "running").length;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Overview</h2>
        <div className="page-header-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Docker Desktop */}
      <div className="docker-bar">
        <div className="docker-bar-left">
          {data.docker_desktop ? (
            <Wifi size={18} />
          ) : (
            <WifiOff size={18} style={{ color: "var(--red)" }} />
          )}
          <span className="label">Docker Desktop</span>
          <span
            className={`badge ${data.docker_desktop ? "badge-green" : "badge-red"}`}
          >
            <span className={`dot ${data.docker_desktop ? "dot-green" : "dot-red"}`} />
            {data.docker_desktop ? "Running" : "Stopped"}
          </span>
        </div>
        <div className="btn-group">
          <button
            className="btn btn-green btn-sm"
            onClick={() => dockerMut.mutate("start")}
            disabled={dockerMut.isPending}
          >
            <Play size={12} /> Start
          </button>
          <button
            className="btn btn-red btn-sm"
            onClick={() => dockerMut.mutate("stop")}
            disabled={dockerMut.isPending}
          >
            <Square size={12} /> Stop
          </button>
          <button
            className="btn btn-orange btn-sm"
            onClick={() => dockerMut.mutate("restart")}
            disabled={dockerMut.isPending}
          >
            <RotateCcw size={12} /> Restart
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="label">Stacks</div>
          <div className="value">{Object.keys(data.stacks).length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Containers</div>
          <div className="value">
            <span style={{ color: "var(--green)" }}>{running}</span>
            {stopped > 0 && (
              <span style={{ color: "var(--text-muted)", fontSize: 14, fontWeight: 400 }}>
                {" "}/ {stopped} stopped
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick stack list */}
      {Object.entries(data.stacks).map(([name, stack]) => {
        const states = stack.containers.map((c) => c.state);
        const allRunning = states.length > 0 && states.every((s) => s === "running");
        const someRunning = states.some((s) => s === "running");
        const dotClass = allRunning
          ? "dot-green"
          : someRunning
          ? "dot-yellow"
          : "dot-gray";

        return (
          <div key={name} className="stack-card">
            <div className="stack-header">
              <div className="stack-info">
                <span className={`dot ${dotClass}`} />
                <span className="stack-name">{name}</span>
                <span className="badge badge-gray">{stack.containers.length} containers</span>
              </div>
              <div className="stack-actions">
                <button
                  className="btn btn-green btn-sm"
                  onClick={() => stackMut.mutate({ stack: name, action: "up" })}
                  disabled={stackMut.isPending}
                >
                  <Play size={12} /> Start
                </button>
                <button
                  className="btn btn-red btn-sm"
                  onClick={() => stackMut.mutate({ stack: name, action: "down" })}
                  disabled={stackMut.isPending}
                >
                  <Square size={12} /> Stop
                </button>
                <button
                  className="btn btn-orange btn-sm"
                  onClick={() => stackMut.mutate({ stack: name, action: "restart" })}
                  disabled={stackMut.isPending}
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>

            {stack.containers.length > 0 && (
              <div className="stack-body">
                {stack.containers.map((c) => (
                  <div key={c.name} className="container-row">
                    <span
                      className={`dot ${c.state === "running" ? "dot-green" : c.state === "exited" ? "dot-red" : "dot-yellow"}`}
                    />
                    <span className="container-name">{c.name}</span>
                    <span className="container-status">{c.status}</span>
                    <span className="container-image">{c.image}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
