/**
 * VocabularySEO — Injects vocabulary/guide page micro-graph
 *
 * Usage:
 * <VocabularySEO>
 *   <Guide />
 * </VocabularySEO>
 *
 * Results in <script type="application/ld+json">{vocabulary schema}</script>
 */

import { Helmet } from 'react-helmet-async';
import { vocabularySchema } from '../../seo/schemaRegistry';

export interface VocabularySEOProps {
  children: React.ReactNode;
}

export function VocabularySEO({ children }: VocabularySEOProps) {
  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(vocabularySchema)}</script>
      </Helmet>
      {children}
    </>
  );
}
