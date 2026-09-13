export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const getWsUrl = (sessionId: number | string, token?: string) => {
  const isHttps = API_BASE_URL.startsWith("https");
  const wsProtocol = isHttps ? "wss" : "ws";
  const host = API_BASE_URL.replace(/^https?:\/\//, "");
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${wsProtocol}://${host}/ws/attendance/${sessionId}${tokenParam}`;
};
