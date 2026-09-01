export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const getWsUrl = (sessionId: number | string) => {
  const isHttps = API_BASE_URL.startsWith("https");
  const wsProtocol = isHttps ? "wss" : "ws";
  const host = API_BASE_URL.replace(/^https?:\/\//, "");
  return `${wsProtocol}://${host}/ws/attendance/${sessionId}`;
};
