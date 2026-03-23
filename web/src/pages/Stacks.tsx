import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchStatus,
  stackAction,
  getStackEnv,
  saveStackEnv,
  getStackConfig,
  saveStackConfig,
  getStackLogs,
  type StatusResponse,
} from "../lib/api";
import {
  Play,
  Square,
  RotateCcw,
  Download,
  FileText,
  Settings,
  ScrollText,
  X,
  Save,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export default function Stacks() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<StatusResponse>({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{
    type: "env" | "config" | "logs";
    stack: string;
  } | null>(null);

  const stackMut = useMutation({
    mutationFn: ({ stack, action }: { stack: string; action: string }) =>
      stackAction(stack, action),
    onSettled: () =>
      setTimeout(() => qc.invalidateQueries({ queryKey: ["status"] }), 2000),
  });

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  if (isLoading || !data) {
    return (
      <div className="page">
        <div className="loading">
          <Loader2 size={20} /> &nbsp;Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Stacks</h2>
        <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
          Compose file management
        </span>
      </div>

      {Object.entries(data.stacks).map(([name, stack]) => {
        const isOpen = expanded.has(name);
        const states = stack.containers.map((c) => c.state);
        const allRunning =
          states.length > 0 && states.every((s) => s === "running");
        const someRunning = states.some((s) => s === "running");
        const dotClass = allRunning
          ? "dot-green"
          : someRunning
          ? "dot-yellow"
          : "dot-gray";

        return (
          <div key={name} className="stack-card">
            <div className="stack-header" onClick={() => toggle(name)}>
              <div className="stack-info">
                {isOpen ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <span className={`dot ${dotClass}`} />
                <span className="stack-name">{name}</span>
                <span className="stack-path">
                  {stack.compose_file
                    .replace(/\\/g, "/")
                    .split("/docker/")
                    .pop()}
                </span>
              </div>
              <div
                className="stack-actions"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="btn btn-green btn-sm"
                  onClick={() =>
                    stackMut.mutate({ stack: name, action: "up" })
                  }
                  disabled={stackMut.isPending}
                >
                  <Play size={12} />
                </button>
                <button
                  className="btn btn-red btn-sm"
                  onClick={() =>
                    stackMut.mutate({ stack: name, action: "down" })
                  }
                  disabled={stackMut.isPending}
                >
                  <Square size={12} />
                </button>
                <button
                  className="btn btn-orange btn-sm"
                  onClick={() =>
                    stackMut.mutate({ stack: name, action: "restart" })
                  }
                  disabled={stackMut.isPending}
                >
                  <RotateCcw size={12} />
                </button>
                <button
                  className="btn btn-blue btn-sm"
                  onClick={() =>
                    stackMut.mutate({ stack: name, action: "pull" })
                  }
                  disabled={stackMut.isPending}
                >
                  <Download size={12} />
                </button>

                <div style={{ width: 1, height: 20, background: "var(--border)" }} />

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setModal({ type: "config", stack: name })}
                >
                  <Settings size={13} /> Config
                </button>
                {stack.has_env && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setModal({ type: "env", stack: name })}
                  >
                    <FileText size={13} /> .env
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setModal({ type: "logs", stack: name })}
                >
                  <ScrollText size={13} /> Logs
                </button>
              </div>
            </div>

            {isOpen && stack.containers.length > 0 && (
              <div className="stack-body">
                {stack.containers.map((c) => {
                  const portUrl = data.services.find(
                    (s) => s.name === c.name
                  );
                  return (
                    <div key={c.name} className="container-row">
                      <span
                        className={`dot ${c.state === "running" ? "dot-green" : c.state === "exited" ? "dot-red" : "dot-yellow"}`}
                      />
                      <span className="container-name">{c.name}</span>
                      <span className="container-status">{c.status}</span>
                      {portUrl && (
                        <a
                          href={portUrl.url}
                          target="_blank"
                          rel="noopener"
                          className="container-url"
                        >
                          {portUrl.url}
                        </a>
                      )}
                      <span className="container-image">{c.image}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {isOpen && stack.containers.length === 0 && (
              <div className="stack-body">
                <div style={{ padding: "12px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  No containers. Start this stack to create them.
                </div>
              </div>
            )}
          </div>
        );
      })}

      {modal && (
        <EditorModal
          type={modal.type}
          stack={modal.stack}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function EditorModal({
  type,
  stack,
  onClose,
}: {
  type: "env" | "config" | "logs";
  stack: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      if (type === "env") setContent(await getStackEnv(stack));
      else if (type === "config") setContent(await getStackConfig(stack));
      else setContent(await getStackLogs(stack));
    } catch (e: any) {
      setContent(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  useState(() => { load(); });

  const save = async () => {
    setSaving(true);
    try {
      if (type === "env") await saveStackEnv(stack, content);
      else if (type === "config") await saveStackConfig(stack, content);
      setToast("Saved!");
      setTimeout(() => setToast(""), 2000);
    } catch (e: any) {
      setToast(`Error: ${e.message}`);
    }
    setSaving(false);
  };

  const title =
    type === "env" ? `.env — ${stack}` : type === "config" ? `Config — ${stack}` : `Logs — ${stack}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading">
              <Loader2 size={16} /> &nbsp;Loading...
            </div>
          ) : type === "logs" ? (
            <div className="logs-container">{content}</div>
          ) : (
            <textarea
              className="editor-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
            />
          )}
        </div>

        {type !== "logs" && (
          <div className="modal-footer">
            {toast && <span style={{ color: "var(--green)", fontSize: 13, marginRight: "auto" }}>{toast}</span>}
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving || loading}>
              <Save size={14} /> Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
