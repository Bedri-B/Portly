const API = import.meta.env.DEV ? "http://localhost:19800" : "";

export interface ServiceInfo {
  name: string;
  url: string;
  http_url: string;
  https_url: string | null;
  direct: string;
  port: number;
  image: string;
  state: string;
  source: "docker" | "alias" | "scan" | "unknown";
}

export interface AppConfig {
  proxy_port: number;
  https_port: number;
  domain: string;
  api_port: number;
  web_port: number;
  https_enabled: boolean;
  docker_discovery: boolean;
}

export interface StatusResponse {
  services: ServiceInfo[];
  config: AppConfig;
  aliases: Record<string, number>;
  scan_ports: number[];
}

export const fetchStatus = async (): Promise<StatusResponse> => {
  const res = await fetch(`${API}/api/status`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export const addAlias = async (name: string, port: number) => {
  const res = await fetch(`${API}/api/aliases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, port }),
  });
  return res.json();
};

export const removeAlias = async (name: string) => {
  const res = await fetch(`${API}/api/aliases/${name}`, { method: "DELETE" });
  return res.json();
};

export const refreshServices = async () => {
  const res = await fetch(`${API}/api/refresh`, { method: "POST" });
  return res.json();
};

export const updateConfig = async (cfg: Partial<AppConfig & { scan_ports: number[] }>) => {
  const res = await fetch(`${API}/api/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg),
  });
  return res.json();
};

export const updateScanPorts = async (ports: number[]) => {
  const res = await fetch(`${API}/api/scan-ports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ports }),
  });
  return res.json();
};
