type AgencyEventName = 'audit.completed' | 'visibility.drop' | 'fix.applied';

type AgencyEventPayloadMap = {
  'audit.completed': { userId: string; projectId?: string; domain: string; score: number };
  'visibility.drop': { userId: string; domain: string; scoreDrop: number; beforeScore: number; afterScore: number };
  'fix.applied': { userId: string; domain: string; confidence: number; mode: string };
};

type Handler<K extends AgencyEventName> = (payload: AgencyEventPayloadMap[K]) => Promise<void> | void;

const listeners: { [K in AgencyEventName]: Array<Handler<K>> } = {
  'audit.completed': [],
  'visibility.drop': [],
  'fix.applied': [],
};

export function onAgencyEvent<K extends AgencyEventName>(name: K, handler: Handler<K>): void {
  listeners[name].push(handler as any);
}

export async function emitAgencyEvent<K extends AgencyEventName>(name: K, payload: AgencyEventPayloadMap[K]): Promise<void> {
  const handlers = listeners[name] || [];
  await Promise.allSettled(handlers.map((handler) => Promise.resolve(handler(payload as any))));
}
