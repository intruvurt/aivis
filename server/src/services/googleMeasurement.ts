type MeasurementParamValue = string | number | boolean;

type MeasurementParams = Record<string, MeasurementParamValue>;

export type MeasurementEventInput = {
  eventName: string;
  clientId: string;
  userId?: string;
  params?: MeasurementParams;
};

type MeasurementResult = {
  ok: boolean;
  status: number;
  error?: string;
};

const DEFAULT_MEASUREMENT_ID = 'G-B4WM53183L';
const MP_COLLECT_URL = 'https://www.google-analytics.com/mp/collect';

const MEASUREMENT_ID =
  process.env.GA4_MEASUREMENT_ID ||
  process.env.GA_MEASUREMENT_ID ||
  DEFAULT_MEASUREMENT_ID;

const API_SECRET =
  process.env.GA4_API_SECRET ||
  process.env.GA_MEASUREMENT_PROTOCOL_SECRET ||
  '';

const EVENT_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;

function normalizeParamValue(value: unknown): MeasurementParamValue | null {
  if (typeof value === 'string') return value.slice(0, 100);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  return null;
}

function normalizeParams(input?: Record<string, unknown>): MeasurementParams {
  if (!input || typeof input !== 'object') return {};

  const out: MeasurementParams = {};
  let count = 0;

  for (const [rawKey, rawValue] of Object.entries(input)) {
    if (count >= 25) break;
    const key = String(rawKey || '').trim();
    if (!key) continue;
    const value = normalizeParamValue(rawValue);
    if (value === null) continue;
    out[key] = value;
    count += 1;
  }

  return out;
}

export function isGoogleMeasurementConfigured(): boolean {
  return Boolean(MEASUREMENT_ID && API_SECRET);
}

export function isValidMeasurementEventName(eventName: string): boolean {
  const normalized = String(eventName || '').trim();
  return EVENT_NAME_PATTERN.test(normalized);
}

export async function sendMeasurementEvent(input: MeasurementEventInput): Promise<MeasurementResult> {
  if (!isGoogleMeasurementConfigured()) {
    return {
      ok: false,
      status: 503,
      error: 'GA4 Measurement Protocol is not configured on server',
    };
  }

  const eventName = String(input.eventName || '').trim();
  if (!isValidMeasurementEventName(eventName)) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid eventName. Use letters, numbers, and underscores (max 40 chars).',
    };
  }

  const clientId = String(input.clientId || '').trim();
  if (!clientId) {
    return {
      ok: false,
      status: 400,
      error: 'clientId is required',
    };
  }

  const params = normalizeParams(input.params as Record<string, unknown>);

  if (typeof params.engagement_time_msec !== 'number') {
    params.engagement_time_msec = 1;
  }

  const endpoint = `${MP_COLLECT_URL}?measurement_id=${encodeURIComponent(MEASUREMENT_ID)}&api_secret=${encodeURIComponent(API_SECRET)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        user_id: input.userId,
        events: [
          {
            name: eventName,
            params,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return {
        ok: false,
        status: response.status,
        error: text || `Measurement Protocol request failed (${response.status})`,
      };
    }

    return { ok: true, status: response.status };
  } catch (error: any) {
    return {
      ok: false,
      status: 500,
      error: error?.message || 'Failed to send GA4 event',
    };
  }
}
