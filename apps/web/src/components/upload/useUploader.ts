import { useEffect, useReducer, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { createUploader, type Uploader, type UploaderFile } from './createUploader';

const DONE_LINGER_MS = 2000;

export type UploadItemState = 'preparing' | 'uploading' | 'done' | 'duplicate' | 'error';

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  percent: number;
  state: UploadItemState;
  error?: string;
  previewUrl?: string;
}

const PREVIEWABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

function toItem(file: UploaderFile, duplicates: Set<string>, previews: Map<string, string>): UploadItem {
  const progress = file.progress;
  let state: UploadItemState = 'preparing';
  if (duplicates.has(file.id)) state = 'duplicate';
  else if (file.error) state = 'error';
  else if (progress.uploadComplete) state = 'done';
  else if (progress.uploadStarted && (progress.bytesUploaded as number) > 0) state = 'uploading';

  return {
    id: file.id,
    name: file.name ?? 'photo',
    size: file.size ?? 0,
    percent: progress.percentage ?? 0,
    state,
    error: file.error ?? undefined,
    previewUrl: previews.get(file.id),
  };
}

export function useUploader(opts: { eventId: string; guestId: string; maxUploadMb: number }) {
  const { eventId, guestId, maxUploadMb } = opts;
  const qc = useQueryClient();
  const [uppy, setUppy] = useState<Uploader | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const duplicates = useRef(new Set<string>());
  const previews = useRef(new Map<string, string>());

  useEffect(() => {
    const later = (fn: () => void, ms: number) => window.setTimeout(fn, ms);
    const timers: number[] = [];

    const instance = createUploader(`wm-${eventId}-${guestId}`, maxUploadMb, {
      onDuplicate: (id) => duplicates.current.add(id),
    });

    const removeSoon = (id: string, ms = DONE_LINGER_MS) => {
      timers.push(later(() => instance.getFile(id) && instance.removeFile(id), ms));
    };
    const refreshMine = () => qc.invalidateQueries({ queryKey: queryKeys.myPhotos(eventId) });

    instance.on('state-update', rerender);
    instance.on('file-added', (file) => {
      if (file.data && PREVIEWABLE.has(file.type ?? '')) {
        previews.current.set(file.id, URL.createObjectURL(file.data));
      }
    });
    instance.on('file-removed', (file) => {
      const url = previews.current.get(file.id);
      if (url) URL.revokeObjectURL(url);
      previews.current.delete(file.id);
      duplicates.current.delete(file.id);
    });
    instance.on('upload-success', (file) => {
      if (file) removeSoon(file.id);
      void refreshMine();
    });
    instance.on('upload-error', (file) => {
      if (file && duplicates.current.has(file.id)) removeSoon(file.id, 3500);
    });
    instance.on('restriction-failed', (file, error) => {
      toast.error(file?.name ? `${file.name}: ${error.message}` : error.message);
    });
    instance.on('complete', (result) => {
      const count = result.successful?.length ?? 0;
      if (count > 0) toast.success(count === 1 ? 'Photo shared' : `${count} photos shared`);
    });

    // Resume uploads that were interrupted by a reload or the phone locking.
    instance.on('restored', () => {
      const ghosts = instance.getFiles().filter((f) => f.isGhost);
      ghosts.forEach((f) => instance.removeFile(f.id));
      if (ghosts.length) {
        toast.message(`${ghosts.length} interrupted photo(s) need to be added again.`);
      }
      if (instance.getFiles().length) {
        (instance.emit as (event: string) => void)('restore-confirmed');
        toast.message('Resuming your uploads…');
      }
    });

    const onOnline = () => instance.retryAll().catch(() => {});
    window.addEventListener('online', onOnline);

    setUppy(instance);

    return () => {
      window.removeEventListener('online', onOnline);
      timers.forEach(clearTimeout);
      previews.current.forEach((url) => URL.revokeObjectURL(url));
      previews.current.clear();
      instance.destroy();
      setUppy(null);
    };
  }, [eventId, guestId, maxUploadMb, qc]);

  const files = uppy?.getFiles() ?? [];
  const items = files.map((f) => toItem(f, duplicates.current, previews.current));

  const addFiles = (list: FileList | File[]) => {
    if (!uppy) return;
    const incoming = Array.from(list).map((file) => ({
      name: file.name,
      type: file.type,
      data: file,
      source: 'Local',
      isRemote: false,
    }));
    try {
      uppy.addFiles(incoming);
    } catch {
      // Restriction failures are already reported through 'restriction-failed'.
    }
  };

  return {
    ready: Boolean(uppy),
    items,
    totalPercent: uppy?.getState().totalProgress ?? 0,
    active: items.some((i) => i.state === 'preparing' || i.state === 'uploading'),
    failed: items.filter((i) => i.state === 'error').length,
    addFiles,
    retry: (id: string) => uppy?.retryUpload(id),
    retryAll: () => uppy?.retryAll(),
    remove: (id: string) => uppy?.removeFile(id),
  };
}
