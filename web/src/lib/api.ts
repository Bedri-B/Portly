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
  scan_common: boolean;
  auto_start: boolean;
  auto_update: boolean;
  docker_strip_prefix: string;
}

export interface StatusResponse {
  services: ServiceInfo[];
  config: AppConfig;
  aliases: Record<string, number>;
  short_aliases: Record<string, string>;
  scan_ports: number[];
  scan_ranges: [number, number][];
  version: string;
}

export interface UpdateInfo {
  available: boolean;
  current: string;
  latest: string;
  download_url: string;
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

export const addShortAlias = async (short: string, target: string) => {
  const res = await fetch(`${API}/api/short-aliases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ short, target }),
  });
  return res.json();
};

export const removeShortAlias = async (name: string) => {
  const res = await fetch(`${API}/api/short-aliases/${name}`, { method: "DELETE" });
  return res.json();
};

export const refreshServices = async () => {
  const res = await fetch(`${API}/api/refresh`, { method: "POST" });
  return res.json();
};

export const updateConfig = async (cfg: Partial<AppConfig>) => {
  const res = await fetch(`${API}/api/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg),
  });
  return res.json();
};

export const updateScan = async (scan: {
  ports?: number[];
  ranges?: [number, number][];
  common?: boolean;
}) => {
  const res = await fetch(`${API}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scan),
  });
  return res.json();
};

export const checkUpdate = async (): Promise<UpdateInfo> => {
  const res = await fetch(`${API}/api/update/check`);
  if (!res.ok) throw new Error("Failed to check for updates");
  return res.json();
};

export const applyUpdate = async () => {
  const res = await fetch(`${API}/api/update/apply`, { method: "POST" });
  return res.json();
};

export const setupHttps = async () => {
  const res = await fetch(`${API}/api/https/setup`, { method: "POST" });
  return res.json();
};

export const installStartup = async () => {
  const res = await fetch(`${API}/api/startup/install`, { method: "POST" });
  return res.json();
};

export const uninstallStartup = async () => {
  const res = await fetch(`${API}/api/startup/uninstall`, { method: "POST" });
  return res.json();
};
