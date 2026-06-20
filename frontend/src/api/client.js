/**
 * Axios API client for communicating with the FastAPI backend.
 */

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 300000, // 5 min — transcription + agent can take a while
});

// ── JWT Auth interceptor: attach token to all requests ───────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("nova_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Save or clear the JWT token.
 */
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem("nova_token", token);
  } else {
    localStorage.removeItem("nova_token");
  }
}

/**
 * Process a meeting — accepts either a file or raw text.
 * Returns structured meeting analysis.
 */
export async function processMeeting({ file, text, summary_level, email_tone, roster }) {
  const formData = new FormData();

  if (file) {
    formData.append("file", file);
  } else if (text) {
    formData.append("text", text);
  }

  if (summary_level) {
    formData.append("summary_level", summary_level);
  }
  if (email_tone) {
    formData.append("email_tone", email_tone);
  }
  if (roster && roster.length > 0) {
    formData.append("roster", JSON.stringify(roster));
  }

  const response = await client.post("/process-meeting", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
}

/**
 * Health check — ping the backend.
 */
export async function ping() {
  const response = await client.get("/ping");
  return response.data;
}

/**
 * Slack Integration — test a webhook URL without saving it.
 */
export async function testSlackWebhook(webhookUrl) {
  const response = await client.post("/slack/test", { webhook_url: webhookUrl });
  return response.data;
}

/**
 * Slack Integration — save and verify a webhook URL for auto-posting.
 */
export async function configureSlack(webhookUrl) {
  const response = await client.post("/slack/configure", { webhook_url: webhookUrl });
  return response.data;
}

/**
 * Slack Integration — disconnect/remove the saved webhook.
 */
export async function disconnectSlack() {
  const response = await client.delete("/slack/configure");
  return response.data;
}

/**
 * Slack Integration — check if Slack is currently connected.
 */
export async function getSlackStatus() {
  const response = await client.get("/slack/status");
  return response.data;
}

// ── Authentication ──────────────────────────────────────────────

export async function registerUser({ name, email, password }) {
  const response = await client.post("/auth/register", { name, email, password });
  return response.data;
}

export async function loginUser({ email, password }) {
  const response = await client.post("/auth/login", { email, password });
  return response.data;
}

export async function getMe() {
  const response = await client.get("/auth/me");
  return response.data;
}

// ── Stripe Payments ─────────────────────────────────────────────

export async function createCheckoutSession(priceId) {
  const response = await client.post("/stripe/create-checkout", {
    price_id: priceId || undefined,
  });
  return response.data;
}

export async function createPortalSession() {
  const response = await client.post("/stripe/create-portal");
  return response.data;
}

export default client;
