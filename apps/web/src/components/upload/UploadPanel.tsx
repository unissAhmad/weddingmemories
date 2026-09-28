import { useRef } from 'react';
import { CheckCircle2, CircleAlert, Copy, ImagePlus, Loader2, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn, formatBytes } from '@/lib/utils';
import { useUploader, type UploadItem } from './useUploader';

interface UploadPanelProps {
  eventId: string;
  guestId: string;
  maxUploadMb: number;
  uploadsOpen: boolean;
}

export function UploadPanel({ eventId, guestId, maxUploadMb, uploadsOpen }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploader = useUploader({ eventId, guestId, maxUploadMb });

  if (!uploadsOpen) {
    return (
      <div className="rounded-xl border border-dashed bg-card/60 p-6 text-center">
        <p className="font-serif text-xl">Uploads are closed</p>
        <p className="mt-1 text-sm text-muted-foreground">Thank you for every moment you shared.</p>
      </div>
    );
  }

  return (
    <section aria-label="Upload photos" className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) uploader.addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <button
        type="button"
        disabled={!uploader.ready}
        onClick={() => inputRef.current?.click()}
        className="group flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-accent/50 bg-card px-6 py-10 text-center transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent transition-transform group-active:scale-95">
          <ImagePlus className="size-7" strokeWidth={1.5} />
        </span>
        <span className="font-serif text-2xl">Add your photos</span>
        <span className="text-sm text-muted-foreground">
          Choose as many as you like · up to {maxUploadMb} MB each
        </span>
      </button>

      {uploader.items.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">
              {uploader.active
                ? `Uploading… ${uploader.totalPercent}%`
                : uploader.failed
                  ? `${uploader.failed} upload${uploader.failed > 1 ? 's' : ''} paused`
                  : 'All done'}
            </p>
            {uploader.failed > 0 && (
              <Button size="sm" variant="outline" onClick={() => uploader.retryAll()}>
                <RotateCw /> Retry all
              </Button>
            )}
          </div>
          {uploader.active && <Progress value={uploader.totalPercent} className="mb-4" />}
          <ul className="space-y-3">
            {uploader.items.map((item) => (
              <UploadRow
                key={item.id}
                item={item}
                onRetry={() => uploader.retry(item.id)}
                onRemove={() => uploader.remove(item.id)}
              />
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Weak signal? Keep this page open. If you close it, your uploads carry on next time you
            open it.
          </p>
        </div>
      )}
    </section>
  );
}

function UploadRow({
  item,
  onRetry,
  onRemove,
}: {
  item: UploadItem;
  onRetry: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-3">
      <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
        {item.previewUrl && (
          <img src={item.previewUrl} alt="" width={48} height={48} className="size-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm">{item.name}</p>
          <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(item.size)}</span>
        </div>
        {item.state === 'uploading' || item.state === 'preparing' ? (
          <Progress value={item.percent} className="mt-2" />
        ) : (
          <p
            className={cn(
              'mt-1 flex items-center gap-1.5 text-xs',
              item.state === 'error' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {item.state === 'done' && <CheckCircle2 className="size-3.5 text-accent" />}
            {item.state === 'duplicate' && <Copy className="size-3.5" />}
            {item.state === 'error' && <CircleAlert className="size-3.5" />}
            {item.state === 'done' && 'Uploaded'}
            {item.state === 'duplicate' && 'Already shared'}
            {item.state === 'error' && (item.error ?? 'Upload failed')}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center">
        {item.state === 'preparing' && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        {item.state === 'error' && (
          <Button size="icon" variant="ghost" onClick={onRetry} aria-label={`Retry ${item.name}`}>
            <RotateCw />
          </Button>
        )}
        {item.state !== 'done' && item.state !== 'duplicate' && (
          <Button size="icon" variant="ghost" onClick={onRemove} aria-label={`Remove ${item.name}`}>
            <X />
          </Button>
        )}
      </div>
    </li>
  );
}
