import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import type { AdminEventDetail, UpdateEvent } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAdminEventContext } from './hooks';
import { PageHeader } from './PageHeader';

function useUpdateEvent() {
  const { event, base } = useAdminEventContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateEvent) => api<AdminEventDetail>(base, { method: 'PATCH', body }),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.admin.event(event.id), updated);
      void qc.invalidateQueries({ queryKey: queryKeys.admin.events });
      void qc.invalidateQueries({ queryKey: queryKeys.event(event.slug) });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <TogglesCard />
        <DetailsCard />
        <FamilyCodeCard />
      </div>
    </>
  );
}

const TOGGLES: { key: 'uploadsOpen' | 'autoApprove' | 'moderateBeforePublish'; label: string; help: string }[] = [
  { key: 'uploadsOpen', label: 'Uploads open', help: 'Turn off after the event to stop new uploads.' },
  {
    key: 'autoApprove',
    label: 'Auto-approve gallery access',
    help: 'Every verified guest can see the full gallery without waiting for you.',
  },
  {
    key: 'moderateBeforePublish',
    label: 'Review photos before publishing',
    help: 'New photos stay hidden until you publish them from Photos.',
  },
];

function TogglesCard() {
  const { event } = useAdminEventContext();
  const update = useUpdateEvent();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Guest experience</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {TOGGLES.map((t) => (
          <div key={t.key} className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor={t.key}>{t.label}</Label>
              <p className="mt-1 text-sm text-muted-foreground">{t.help}</p>
            </div>
            <Switch
              id={t.key}
              checked={event.settings[t.key]}
              disabled={update.isPending}
              onCheckedChange={(v) =>
                update.mutate({ [t.key]: v }, { onSuccess: () => toast.success(`${t.label}: ${v ? 'on' : 'off'}`) })
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const DetailsSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(120),
  date: z.iso.date('Pick a date'),
});
type Details = z.infer<typeof DetailsSchema>;

function DetailsCard() {
  const { event } = useAdminEventContext();
  const update = useUpdateEvent();
  const form = useForm<Details>({
    resolver: zodResolver(DetailsSchema),
    values: { name: event.name, date: event.date.slice(0, 10) },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event details</CardTitle>
        <CardDescription>Shown on the guest landing page.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit((d) => update.mutate(d, { onSuccess: () => toast.success('Saved') }))}
        >
          <FormField id="ev-name" label="Name" error={form.formState.errors.name?.message}>
            <Input id="ev-name" {...form.register('name')} />
          </FormField>
          <FormField id="ev-date" label="Date" error={form.formState.errors.date?.message}>
            <Input id="ev-date" type="date" {...form.register('date')} />
          </FormField>
          <Button type="submit" className="justify-self-start" disabled={update.isPending || !form.formState.isDirty}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const CodeSchema = z.object({ code: z.string().trim().min(4, 'At least 4 characters').max(64) });

function FamilyCodeCard() {
  const { event } = useAdminEventContext();
  const update = useUpdateEvent();
  const form = useForm<z.infer<typeof CodeSchema>>({ resolver: zodResolver(CodeSchema), defaultValues: { code: '' } });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-accent" /> Family code
        </CardTitle>
        <CardDescription>
          Share with close family: entering it unlocks the gallery immediately. Codes are stored hashed, so you can
          replace one but not view it. Not case-sensitive.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm">
          Status: <strong>{event.settings.hasFamilyCode ? 'a code is set' : 'no code set'}</strong>
        </p>
        <form
          className="flex items-start gap-2"
          noValidate
          onSubmit={form.handleSubmit((d) =>
            update.mutate(
              { familyCode: d.code },
              {
                onSuccess: () => {
                  form.reset({ code: '' });
                  toast.success('Family code saved');
                },
              },
            ),
          )}
        >
          <FormField id="family-code" label="New code" error={form.formState.errors.code?.message} className="flex-1 [&>label]:sr-only">
            <Input id="family-code" autoComplete="off" placeholder="e.g. khan-family-2026" className="h-10 text-sm" {...form.register('code')} />
          </FormField>
          <Button type="submit" disabled={update.isPending}>
            Set code
          </Button>
        </form>
        {event.settings.hasFamilyCode && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start text-destructive"
            onClick={() => update.mutate({ familyCode: null }, { onSuccess: () => toast.success('Family code removed') })}
          >
            Remove code
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
