/**
 * MethodologySEO — Injects methodology page micro-graph
 *
 * Usage:
 * <MethodologySEO>
 *   <Methodology />
 * </MethodologySEO>
 *
 * Results in <script type="application/ld+json">{methodology schema}</script>
 */

import { Helmet } from 'react-helmet-async';
import { methodologySchema } from '../../seo/schemaRegistry';

export interface MethodologySEOProps {
  children: React.ReactNode;
}

export function MethodologySEO({ children }: MethodologySEOProps) {
  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(methodologySchema)}</script>
      </Helmet>
      {children}
    </>
  );
}
