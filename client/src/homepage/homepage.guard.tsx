/**
 * HOMEPAGE GUARD — development-time drift detection
 *
 * Wraps homepage children and runs contract validation.
 * In development: logs warnings to console and renders error overlay if drift detected.
 * In production: passes through without validation overhead.
 */

import { type ReactNode, useMemo } from 'react';
import { validateHomepageContract } from './homepage.validate';
import { HomepageFail } from './homepage.fail';

interface HomepageGuardProps {
    children: ReactNode;
}

export function HomepageGuard({ children }: HomepageGuardProps) {
    const errors = useMemo(() => {
        if (import.meta.env.PROD) return [];
        return validateHomepageContract();
    }, []);

    if (errors.length > 0 && !import.meta.env.PROD) {
        console.error(
            `[HomepageGuard] Contract validation failed (${errors.length} error${errors.length > 1 ? 's' : ''}):\n` +
            errors.map((e) => `  ${e.code}: ${e.message}`).join('\n'),
        );
        return <HomepageFail errors={ errors } />;
    }

    return <>{ children } </>;
}
