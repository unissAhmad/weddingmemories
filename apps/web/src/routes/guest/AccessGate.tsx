import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Hourglass, KeyRound, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { FamilyCodeSchema, type AccessState, type FamilyCode, type GuestMe } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

function useSetAccess() {
  const qc = useQueryClient();
  return (state: AccessState) =>
    qc.setQueryData<GuestMe | null>(queryKeys.me, (me) => (me ? { ...me, access: state.status } : me));
}

/** Shown in place of the gallery until the guest's access is approved. */
export function AccessGate({ status }: { status: GuestMe['access'] }) {
  const setAccess = useSetAccess();
  const request = useMutation({
    mutationFn: () => api<AccessState>('/access/request', { method: 'POST' }),
    onSuccess: (state) => {
      setAccess(state);
      if (state.status === 'APPROVED') toast.success('Welcome to the gallery!');
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 pt-10">
      <Card>
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent">
            {status === 'PENDING' ? <Hourglass className="size-6" /> : <Lock className="size-6" />}
          </span>
          <CardTitle>
            {status === 'PENDING'
              ? 'Your request is on its way'
              : status === 'REJECTED'
                ? 'The gallery is private'
                : 'A private gallery'}
          </CardTitle>
          <CardDescription className="text-balance">
            {status === 'PENDING'
              ? "The couple will approve it soon. We'll email you as soon as you can see every photo."
              : status === 'REJECTED'
                ? 'Your access to the full gallery was not approved. You can still share your photos.'
                : 'Photos from every guest are shared with family and friends the couple approves.'}
          </CardDescription>
        </CardHeader>
        {status === null && (
          <CardContent>
            <Button className="w-full" size="lg" onClick={() => request.mutate()} disabled={request.isPending}>
              {request.isPending && <Loader2 className="animate-spin" />}
              Request access
            </Button>
          </CardContent>
        )}
      </Card>

      {status !== 'REJECTED' && <FamilyCodeForm onApproved={setAccess} />}
    </main>
  );
}

function FamilyCodeForm({ onApproved }: { onApproved: (s: AccessState) => void }) {
  const form = useForm<FamilyCode>({
    resolver: zodResolver(FamilyCodeSchema),
    defaultValues: { code: '' },
  });
  const submit = useMutation({
    mutationFn: (d: FamilyCode) => api<AccessState>('/access/code', { method: 'POST', body: d }),
    onSuccess: (state) => {
      onApproved(state);
      toast.success('Welcome to the gallery!');
    },
    onError: (err) => form.setError('code', { message: err.message }),
  });

  return (
    <form
      className="rounded-xl border border-dashed p-5"
      noValidate
      onSubmit={form.handleSubmit((d) => submit.mutate(d))}
    >
      <p className="mb-4 flex items-center gap-2 text-sm font-medium">
        <KeyRound className="size-4 text-accent" /> Have a family code?
      </p>
      <div className="flex items-start gap-2">
        <FormField id="family-code" label="Family code" error={form.formState.errors.code?.message} className="flex-1 [&>label]:sr-only">
          <Input
            id="family-code"
            autoComplete="off"
            autoCapitalize="none"
            placeholder="Enter code"
            aria-invalid={Boolean(form.formState.errors.code)}
            {...form.register('code')}
          />
        </FormField>
        <Button type="submit" variant="secondary" className="h-12" disabled={submit.isPending}>
          {submit.isPending && <Loader2 className="animate-spin" />}
          Unlock
        </Button>
      </div>
    </form>
  );
}
