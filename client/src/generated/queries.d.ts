export interface Query {
  slug: string;
  intent: string;
  type: 'audit' | 'checker' | 'report' | 'analysis' | 'tool';
  seed: string;
  canonical: string;
}

export declare const queries: Query[];
