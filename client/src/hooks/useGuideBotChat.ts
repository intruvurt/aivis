// client/src/hooks/useGuideBotChat.ts
// Encapsulates assistant API communication + state for GuideBot
import { useState, useCallback } from 'react';
import { API_URL } from '../config';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import apiFetch from '../utils/api';
import { meetsMinimumTier } from '@shared/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface UsageInfo {
  used: number;
  limit: number;
}

export interface AssistantApiResponse {
  success?: boolean;
  reply?: string;
  usage?: UsageInfo;
  fallback_mode?: boolean;
  code?: string;
  error?: string;
  used?: number;
  limit?: number;
  action?: {
    type: string;
    task_id?: string;
    task_type?: string;
    description?: string;
    required_tier?: string;
    feature?: string;
  };
}

function normalizeAssistantReply(input: string): string {
  let text = (input || '').trim();

  if (!text) return '';

  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (typeof parsed.reply === 'string') text = parsed.reply;
      else if (typeof parsed.message === 'string') text = parsed.message;
      else return ''; // Unknown JSON object (e.g. {"criteria":...}) - not a valid reply
    } catch {
      // Malformed JSON-looking text - leave as-is, it's probably natural language
    }
  }

  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      text = JSON.parse(text) as string;
    } catch {
      // leave as-is
    }
  }

  text = text
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  return text;
}

export function useGuideBotChat(currentPath: string) {
  const { user, token } = useAuthStore();
  const bixWebDataEnabled = useSettingsStore((s) => s.bixWebDataEnabled);
  const bixVerbosity = useSettingsStore((s) => s.bixVerbosity);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      if (!text.trim() || isLoading) return false;
      if (!token) {
        setError('Please log in to use AiVIS.biz Guide.');
        return false;
      }

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      try {
        const endpoints = [`${API_URL}/api/assistant`, `${API_URL}/assistant`];
        const ASSISTANT_CLIENT_TIMEOUT_MS = 45_000;
        let res: Response | null = null;
        let data: AssistantApiResponse | null = null;

        for (const endpoint of endpoints) {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), ASSISTANT_CLIENT_TIMEOUT_MS);

          const attempt = await apiFetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: text.trim(),
              history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
              pageContext: currentPath,
              bixPrefs: { webData: bixWebDataEnabled, verbosity: bixVerbosity },
            }),
            signal: controller.signal,
          }).finally(() => {
            window.clearTimeout(timeoutId);
          });

          const raw = await attempt.text();
          try {
            data = raw ? (JSON.parse(raw) as AssistantApiResponse) : null;
          } catch {
            data = { error: raw || 'Assistant service unavailable' };
          }

          res = attempt;
          if (attempt.status !== 404) break;
        }

        if (!res) {
          setError('Assistant service unavailable. Please try again shortly.');
          return false;
        }

        if (!res.ok) {
          const parsed = data || {};
          if (parsed.code === 'ASSISTANT_LIMIT_REACHED') {
            const hasSignalPlus = meetsMinimumTier((user?.tier as any) || 'observer', 'signal');
            setError(
              `Daily limit reached (${parsed.used}/${parsed.limit}). ${hasSignalPlus ? '' : 'Upgrade for more messages!'
              }`
            );
          } else if (parsed.code === 'EMAIL_NOT_VERIFIED') {
            setError('Please verify your email to use AiVIS.biz Guide. Check your inbox for the verification link.');
          } else if (parsed.code === 'USER_NOT_FOUND' || parsed.code === 'NO_USER') {
            setError('Your session is out of sync. Please sign out and log back in.');
          } else if (parsed.code === 'NO_TOKEN' || parsed.code === 'INVALID_TOKEN') {
            setError('Session expired. Please log in again.');
          } else if (res.status === 404) {
            setError('Guide service endpoint is not available right now.');
          } else {
            setError(parsed.error || 'Something went wrong. Try again.');
          }
          return false;
        }

        const normalizedReply = normalizeAssistantReply(typeof data?.reply === 'string' ? data.reply : '');

        if (!normalizedReply) {
          setError('Guide returned an empty response. Please try again.');
          return false;
        }

        setIsFallbackMode(!!data.fallback_mode);

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: normalizedReply,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setUsageInfo(data.usage);
        return true;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          setError('Guide request timed out. Please try again in a few seconds.');
        } else {
          setError('Network error. Check your connection and try again.');
        }
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, token, messages, currentPath, user?.tier, bixWebDataEnabled, bixVerbosity]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setUsageInfo(null);
    setIsFallbackMode(false);
  }, []);

  return { messages, isLoading, error, usageInfo, isFallbackMode, sendMessage, clearChat, token };
}
