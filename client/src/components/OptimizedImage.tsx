import { ImgHTMLAttributes } from 'react';

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Force eager loading for above-the-fold images */
  priority?: boolean;
}

/**
 * Drop-in <img> replacement with native lazy loading, async decoding,
 * and fetchpriority hints.
 */
export default function OptimizedImage({
  priority = false,
  loading,
  decoding,
  fetchPriority,
  ...rest
}: OptimizedImageProps) {
  return (
    <img
      loading={loading ?? (priority ? 'eager' : 'lazy')}
      decoding={decoding ?? (priority ? 'sync' : 'async')}
      fetchPriority={fetchPriority ?? (priority ? 'high' : undefined)}
      {...rest}
    />
  );
}
