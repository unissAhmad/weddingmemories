import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, Loader2, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import type { CodeGuest } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useAdminEventContext } from './hooks';

const MAX_NAMES = 500;

function parseNames(text: string) {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => {
      const key = l.toLowerCase();
      if (!l || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function AddCodeGuestsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { event, base } = useAdminEventContext();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [created, setCreated] = useState<CodeGuest[] | null>(null);
  const names = parseNames(text);

  const create = useMutation({
    mutationFn: (list: string[]) => api<CodeGuest[]>(`${base}/guests`, { method: 'POST', body: { names: list } }),
    onSuccess: (res) => {
      setCreated(res);
      void qc.invalidateQueries({ queryKey: ['admin', 'event', event.id] });
    },
    onError: (err) => toast.error(err.message),
  });

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setText('');
      setCreated(null);
    }
  };

  const asText = (list: CodeGuest[]) =>
    list.map((g) => `${g.name}: ${g.code}`).join('\n') + `\n\nJoin at ${event.guestUrl}`;

  const downloadCsv = (list: CodeGuest[]) => {
    const rows = [['name', 'access_code', 'link'], ...list.map((g) => [g.name, g.code, event.guestUrl])];
    const blob = new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${event.slug}-access-codes.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{created.length === 1 ? 'Guest added' : `${created.length} guests added`}</DialogTitle>
              <DialogDescription>
                Share each code with its guest, for example printed on the invitation. They enter their name and
                code at {event.guestUrl} and can see the gallery straight away.
              </DialogDescription>
            </DialogHeader>
            <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
              {created.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="truncate">{g.name}</span>
                  <code className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono tracking-wider">{g.code}</code>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(asText(created)).then(() => toast.success('Copied'))}
              >
                <Copy /> Copy all
              </Button>
              <Button variant="outline" onClick={() => downloadCsv(created)}>
                <Download /> Download CSV
              </Button>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ticket className="size-5 text-accent" /> Add guests with access codes
              </DialogTitle>
              <DialogDescription>
                Each guest gets a personal code. With their name and code they can join without an email and see the
                whole gallery. You can revoke access or block them later.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="code-names">Names, one per line</Label>
              <Textarea
                id="code-names"
                rows={8}
                placeholder={'Zara Khan\nImran Mir\nThe Shah family'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {names.length} {names.length === 1 ? 'name' : 'names'}
                {names.length > MAX_NAMES && ` (maximum ${MAX_NAMES} at a time)`}. Guests will need to type their name
                as written here (capitals and accents don't matter).
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => create.mutate(names)}
                disabled={names.length === 0 || names.length > MAX_NAMES || create.isPending}
              >
                {create.isPending && <Loader2 className="animate-spin" />}
                Create {names.length > 0 ? names.length : ''} {names.length === 1 ? 'code' : 'codes'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
