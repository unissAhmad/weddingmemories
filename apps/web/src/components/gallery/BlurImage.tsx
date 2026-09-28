import { useState } from 'react';
import { Blurhash } from 'react-blurhash';
import { cn } from '@/lib/utils';

interface BlurImageProps {
  src: string | null;
  blurhash: string | null;
  width: number;
  height: number;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Shows the blurhash until the real image has loaded, then fades it in. */
export function BlurImage({ src, blurhash, width, height, alt, className, style }: BlurImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={cn('relative overflow-hidden bg-muted', className)} style={style}>
      {blurhash && !loaded && (
        <Blurhash
          hash={blurhash}
          width="100%"
          height="100%"
          resolutionX={32}
          resolutionY={32}
          punch={1}
          className="!absolute inset-0"
        />
      )}
      {src && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={cn(
            'relative size-full object-cover transition-opacity duration-500',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  );
}
