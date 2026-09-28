import { Navigate, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { CreateEventSchema, type AdminEventSummary, type CreateEvent } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAdminEvents, useAdminMe } from './hooks';

/** Sends the admin to their event; offers to create one if there is none yet. */
export function AdminHome() {
  const me = useAdminMe();
  const events = useAdminEvents();

  if (events.isPending) return <FullPageSpinner />;
  const first = events.data?.[0];
  if (first) return <Navigate to={`/admin/e/${first.id}`} replace />;

  return (
    <main className="mx-auto max-w-lg p-6 lg:p-10">
      {me.data?.role === 'OWNER' ? (
        <CreateEventCard />
      ) : (
        <p className="text-muted-foreground">You haven't been assigned to an event yet. Ask the owner to add you.</p>
      )}
    </main>
  );
}

function CreateEventCard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<CreateEvent>({
    resolver: zodResolver(CreateEventSchema),
    defaultValues: { name: '', slug: '', date: '' },
  });
  const create = useMutation({
    mutationFn: (d: CreateEvent) => api<AdminEventSummary>('/admin/events', { method: 'POST', body: d }),
    onSuccess: (ev) => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.events });
      navigate(`/admin/e/${ev.id}/settings`);
    },
    onError: (err) => form.setError('slug', { message: err.message }),
  });
  const { errors } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your event</CardTitle>
        <CardDescription>The link becomes the address guests reach from the QR code.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" noValidate onSubmit={form.handleSubmit((d) => create.mutate(d))}>
          <FormField id="name" label="Couple / event name" error={errors.name?.message}>
            <Input id="name" placeholder="Aisha & Omar" {...form.register('name')} />
          </FormField>
          <FormField id="slug" label="Link" hint="Lowercase letters, numbers and dashes, e.g. aisha-omar" error={errors.slug?.message}>
            <Input id="slug" placeholder="aisha-omar" {...form.register('slug')} />
          </FormField>
          <FormField id="date" label="Wedding date" error={errors.date?.message}>
            <Input id="date" type="date" {...form.register('date')} />
          </FormField>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />}
            Create event
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
