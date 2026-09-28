import { UploadPanel } from '@/components/upload/UploadPanel';
import { MyPhotoGrid } from '@/components/gallery/MyPhotoGrid';
import { useGuestContext } from './GuestShell';

export function UploadPage() {
  const { event, me } = useGuestContext();
  const firstName = me.guest.name.split(' ')[0];

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8">
      <div className="mb-6">
        <h1 className="text-4xl">Hello, {firstName}</h1>
        <p className="mt-1 text-muted-foreground">Thank you for capturing the day with us.</p>
      </div>

      <UploadPanel
        eventId={event.id}
        guestId={me.guest.id}
        maxUploadMb={event.maxUploadMb}
        uploadsOpen={event.uploadsOpen}
      />

      <section className="mt-10" aria-labelledby="mine-heading">
        <h2 id="mine-heading" className="mb-4 text-2xl">
          My uploads
        </h2>
        <MyPhotoGrid eventId={event.id} />
      </section>
    </main>
  );
}
