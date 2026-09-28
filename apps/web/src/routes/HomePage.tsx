import { Navigate } from 'react-router';
import { QrCode } from 'lucide-react';
import { Ornament } from '@/components/Ornament';
import { lastEvent } from '@/lib/lastEvent';

export function HomePage() {
  const slug = lastEvent();
  if (slug) return <Navigate to={`/e/${slug}`} replace />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <QrCode className="size-10 text-accent" strokeWidth={1.25} />
      <h1 className="text-4xl">Wedding Memories</h1>
      <Ornament />
      <p className="text-muted-foreground">
        Scan the QR code on your table card to join the celebration and share your photos.
      </p>
    </main>
  );
}
