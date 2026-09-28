import { useState } from 'react';
import { Navigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { CreateAdminSchema, type AdminTeamMember, type CreateAdmin } from '@wm/shared';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from '@/components/ui/native-select';
import { FormField } from '@/components/ui/form-field';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { formatDateTime, useAdminEvents, useAdminMe } from './hooks';
import { PageHeader } from './PageHeader';

export function TeamPage() {
  const me = useAdminMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<AdminTeamMember | null>(null);
  const team = useQuery({
    queryKey: queryKeys.admin.team,
    queryFn: ({ signal }) => api<AdminTeamMember[]>('/admin/team', { signal }),
    enabled: me.data?.role === 'OWNER',
  });
  const events = useAdminEvents();
  const eventName = (id: string) => events.data?.find((e) => e.id === id)?.name ?? 'Unknown event';

  const refresh = () => void qc.invalidateQueries({ queryKey: queryKeys.admin.team });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/team/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Admin removed');
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });
  const reset2fa = useMutation({
    mutationFn: (id: string) => api(`/admin/team/${id}/reset-2fa`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Two-factor reset. They will set it up again at next sign-in.');
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  if (me.data && me.data.role !== 'OWNER') return <Navigate to="/admin" replace />;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-10">
      <PageHeader
        title="Team"
        description="Moderators can approve guests and manage photos for the events you assign them."
        actions={
          <Button onClick={() => setOpen(true)}>
            <UserPlus /> Add admin
          </Button>
        }
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admin</TableHead>
              <TableHead className="hidden md:table-cell">Events</TableHead>
              <TableHead className="hidden lg:table-cell">Last sign-in</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.data?.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <p className="font-medium">{a.email}</p>
                  <div className="mt-1 flex gap-1">
                    <Badge variant={a.role === 'OWNER' ? 'default' : 'secondary'}>{a.role.toLowerCase()}</Badge>
                    {!a.twoFactor && <Badge variant="warning">2FA not set up</Badge>}
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {a.role === 'OWNER' ? 'All events' : a.eventIds.map(eventName).join(', ') || '—'}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {a.lastLoginAt ? formatDateTime(a.lastLoginAt) : 'Never'}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {a.id !== me.data?.id && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Reset two-factor"
                        aria-label={`Reset two-factor for ${a.email}`}
                        onClick={() => reset2fa.mutate(a.id)}
                      >
                        <KeyRound />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Remove"
                        aria-label={`Remove ${a.email}`}
                        onClick={() => setRemoving(a)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {team.isPending && <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />}
      </Card>
      <AddAdminDialog open={open} onOpenChange={setOpen} onCreated={refresh} />
      <AlertDialog open={removing !== null} onOpenChange={(v) => !v && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.email}?</AlertDialogTitle>
            <AlertDialogDescription>They lose access to the admin panel immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => removing && remove.mutate(removing.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function AddAdminDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const events = useAdminEvents();
  const form = useForm<z.input<typeof CreateAdminSchema>, unknown, CreateAdmin>({
    resolver: zodResolver(CreateAdminSchema),
    defaultValues: { email: '', password: '', role: 'MODERATOR', eventIds: [] },
  });
  const eventIds = form.watch('eventIds') ?? [];
  const role = form.watch('role');
  const create = useMutation({
    mutationFn: (d: CreateAdmin) => api('/admin/team', { method: 'POST', body: d }),
    onSuccess: () => {
      toast.success('Admin added. Share the password with them securely.');
      form.reset();
      onOpenChange(false);
      onCreated();
    },
    onError: (err) => form.setError('email', { message: err.message }),
  });
  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an admin</DialogTitle>
          <DialogDescription>They'll set up two-factor authentication the first time they sign in.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" noValidate onSubmit={form.handleSubmit((d) => create.mutate(d))}>
          <FormField id="new-email" label="Email" error={errors.email?.message}>
            <Input id="new-email" type="email" className="h-10 text-sm" {...form.register('email')} />
          </FormField>
          <FormField id="new-password" label="Temporary password" hint="At least 12 characters." error={errors.password?.message}>
            <Input id="new-password" type="text" autoComplete="new-password" className="h-10 text-sm" {...form.register('password')} />
          </FormField>
          <FormField id="new-role" label="Role">
            <NativeSelect id="new-role" {...form.register('role')}>
              <option value="MODERATOR">Moderator: access, photos and guests</option>
              <option value="OWNER">Owner: everything, including downloads</option>
            </NativeSelect>
          </FormField>
          {role === 'MODERATOR' && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Events</legend>
              {events.data?.map((ev) => (
                <label key={ev.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={eventIds.includes(ev.id)}
                    onCheckedChange={(v) =>
                      form.setValue(
                        'eventIds',
                        v === true ? [...eventIds, ev.id] : eventIds.filter((id) => id !== ev.id),
                      )
                    }
                  />
                  {ev.name}
                </label>
              ))}
            </fieldset>
          )}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}
              Add admin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
