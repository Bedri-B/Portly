const API = import.meta.env.DEV ? "http://localhost:19800" : "";

export interface Container {
  name: string;
  state: string;
  status: string;
  image: string;
  ports: { PublishedPort?: number; published_port?: number }[];
}

export interface StackInfo {
  compose_file: string;
  has_env: boolean;
  containers: Container[];
}

export interface ServiceInfo {
  name: string;
  url: string;
  direct: string;
  port: number;
  stack: string;
  image: string;
  state: string;
}

export interface AppConfig {
  proxy_port: number;
  domain: string;
  api_port: number;
  web_port: number;
}

export interface StatusResponse {
  docker_desktop: boolean;
  stacks: Record<string, StackInfo>;
  services: ServiceInfo[];
  config: AppConfig;
}

export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch(`${API}/api/status`);
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

export async function stackAction(stack: string, action: string): Promise<any> {
  const res = await fetch(`${API}/api/stacks/${stack}/${action}`, { method: "POST" });
  return res.json();
}

export async function dockerAction(action: "start" | "stop" | "restart"): Promise<any> {
  const res = await fetch(`${API}/api/docker/${action}`, { method: "POST" });
  return res.json();
}

export async function refreshAll(): Promise<any> {
  const res = await fetch(`${API}/api/refresh`, { method: "POST" });
  return res.json();
}

export async function getStackEnv(stack: string): Promise<string> {
  const res = await fetch(`${API}/api/stacks/${stack}/env`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.env;
}

export async function saveStackEnv(stack: string, env: string): Promise<void> {
  await fetch(`${API}/api/stacks/${stack}/env`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ env }),
  });
}

export async function getStackConfig(stack: string): Promise<string> {
  const res = await fetch(`${API}/api/stacks/${stack}/config`);
  const data = await res.json();
  return data.config;
}

export async function saveStackConfig(stack: string, config: string): Promise<void> {
  await fetch(`${API}/api/stacks/${stack}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
}

export async function getStackLogs(stack: string, tail = 200): Promise<string> {
  const res = await fetch(`${API}/api/stacks/${stack}/logs?tail=${tail}`);
  const data = await res.json();
  return data.logs || "";
}

export async function getConfig(): Promise<AppConfig> {
  const res = await fetch(`${API}/api/config`);
  const data = await res.json();
  return data.config;
}

export async function saveAppConfig(cfg: Partial<AppConfig>): Promise<any> {
  const res = await fetch(`${API}/api/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg),
  });
  return res.json();
}
