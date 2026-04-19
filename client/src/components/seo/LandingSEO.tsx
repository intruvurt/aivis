/**
 * LandingSEO — Injects landing page micro-graph
 *
 * Usage:
 * <LandingSEO>
 *   <Landing/>
 * </LandingSEO>
 *
 * Results in <script type="application/ld+json">{landing schema}</script>
 * injected into page head by React Helmet or parent
 */

import { Helmet } from 'react-helmet-async';
import { landingSchema } from '../../seo/schemaRegistry';

export interface LandingSEOProps {
  children: React.ReactNode;
}

export function LandingSEO({ children }: LandingSEOProps) {
  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(landingSchema)}</script>
      </Helmet>
      {children}
    </>
  );
}
