import type { ApiErrorBody } from '../types';

// Relative by default: Vite proxies /api in dev, and the Dockerfile serves both from one origin.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
export const TOKEN_KEY = 'csc4801.token';

/** Any non-2xx response, carrying the contract's { error: { code, message } } envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let activeToken: string | null | undefined;
let storedToken: string | null | undefined;
let sessionVersion = 0;

export function refreshStoredToken(): boolean {
  let token: string | null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }

  if (token === storedToken) return false;
  storedToken = token;
  if (activeToken === token) return false;
  activeToken = token;
  sessionVersion += 1;
  return true;
}

export function getToken(): string | null {
  if (activeToken === undefined) {
    activeToken = null;
    refreshStoredToken();
  }
  return activeToken;
}

export function getSessionVersion(): number {
  return sessionVersion;
}

export function setToken(token: string | null): void {
  if (getToken() !== token) sessionVersion += 1;
  activeToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      // A storage event for a newer sign-in may still be queued.
      if (storedToken !== undefined && localStorage.getItem(TOKEN_KEY) !== storedToken) return;
      localStorage.removeItem(TOKEN_KEY);
    }
    storedToken = token;
  } catch {
    // The active session still works if storage is unavailable.
  }
}

function assertCurrentSession(version: number): void {
  let latestStoredToken = storedToken;
  try {
    latestStoredToken = localStorage.getItem(TOKEN_KEY);
  } catch {
    // Without storage, only this tab can change the session.
  }
  if (version !== sessionVersion || (storedToken !== undefined && latestStoredToken !== storedToken)) {
    throw new ApiError(0, 'SESSION_CHANGED', 'The active session changed');
  }
}

// Lets the app drop back to the login screen when any call comes back 401.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  const version = getSessionVersion();
  assertCurrentSession(version);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    assertCurrentSession(version);
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server');
  }

  const text = res.status === 204 ? undefined : await res.text();
  assertCurrentSession(version);
  if (res.status === 204) return undefined as T;

  const data: unknown = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const envelope = data as Partial<ApiErrorBody> | undefined;
    const code = envelope?.error?.code ?? `HTTP_${res.status}`;
    const message = envelope?.error?.message ?? res.statusText ?? 'Request failed';
    // Only end the session this request was made with: a stale request finishing after the
    // user logged in again must not discard the new token.
    if (res.status === 401 && token && path !== '/auth/login' && path !== '/auth/register') {
      setToken(null);
      onUnauthorized?.();
    }
    throw new ApiError(res.status, code, message);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
