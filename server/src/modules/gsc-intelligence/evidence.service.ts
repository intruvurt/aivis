import { createEvidence } from './gsc.service.js';
import type { GscSourceMode } from './gsc.types.js';

export async function mintGscEvidenceId(args: {
  userId: string;
  propertyId: string;
  toolName: string;
  sourceMode: GscSourceMode;
  sourceRef: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  return createEvidence({
    userId: args.userId,
    propertyId: args.propertyId,
    sourceType: 'gsc',
    sourceRef: `${args.toolName}:${args.sourceRef}:${args.sourceMode}`,
    payload: {
      ...args.payload,
      sourceMode: args.sourceMode,
      toolName: args.toolName,
    },
  });
}

export async function mintAuditEvidenceId(args: {
  userId: string;
  propertyId: string;
  auditId: string;
  findingType: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  return createEvidence({
    userId: args.userId,
    propertyId: args.propertyId,
    sourceType: 'aivis_audit',
    sourceRef: `${args.auditId}:${args.findingType}`,
    payload: args.payload,
  });
}
