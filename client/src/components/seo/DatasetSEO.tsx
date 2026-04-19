/**
 * DatasetSEO — Injects dataset page micro-graph
 *
 * Usage:
 * <DatasetSEO>
 *   <Dataset />
 * </DatasetSEO>
 *
 * Results in <script type="application/ld+json">{dataset schema}</script>
 */

import { Helmet } from 'react-helmet-async';
import { datasetSchema } from '../../seo/schemaRegistry';

export interface DatasetSEOProps {
  children: React.ReactNode;
}

export function DatasetSEO({ children }: DatasetSEOProps) {
  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(datasetSchema)}</script>
      </Helmet>
      {children}
    </>
  );
}
