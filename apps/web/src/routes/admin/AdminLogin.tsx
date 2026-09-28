import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldCheck } from 'lucide-react';
import {
  AdminLoginSchema,
  TotpCodeSchema,
  type AdminLogin,
  type AdminLoginResult,
  type AdminMe,
  type TotpCode,
} from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAdminMe } from './hooks';

export function AdminLogin() {
  const me = useAdminMe();
  const [step, setStep] = useState<AdminLoginResult | null>(null);

  if (me.isPending) return <FullPageSpinner />;
  if (me.data) return <Navigate to="/admin" replace />;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="eyebrow mb-4 text-center">Wedding Memories · Admin</p>
        {step ? <SecondFactor step={step} onRestart={() => setStep(null)} /> : <PasswordStep onNext={setStep} />}
      </div>
    </main>
  );
}

function PasswordStep({ onNext }: { onNext: (r: AdminLoginResult) => void }) {
  const form = useForm<AdminLogin>({ resolver: zodResolver(AdminLoginSchema), defaultValues: { email: '', password: '' } });
  const login = useMutation({
    mutationFn: (d: AdminLogin) => api<AdminLoginResult>('/admin/login', { method: 'POST', body: d }),
    onSuccess: onNext,
    onError: (err) => form.setError('password', { message: err.message }),
  });
  const { errors } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" noValidate onSubmit={form.handleSubmit((d) => login.mutate(d))}>
          <FormField id="email" label="Email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="username" {...form.register('email')} />
          </FormField>
          <FormField id="password" label="Password" error={errors.password?.message}>
            <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
          </FormField>
          <Button type="submit" disabled={login.isPending}>
            {login.isPending && <Loader2 className="animate-spin" />}
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SecondFactor({ step, onRestart }: { step: AdminLoginResult; onRestart: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<TotpCode>({ resolver: zodResolver(TotpCodeSchema), defaultValues: { code: '' } });
  const verify = useMutation({
    mutationFn: (d: TotpCode) => api<AdminMe>('/admin/2fa', { method: 'POST', body: d }),
    onSuccess: (me) => {
      qc.setQueryData(queryKeys.admin.me, me);
      navigate('/admin', { replace: true });
    },
    onError: (err) => {
      form.setError('code', { message: err.message });
      if (err.message.includes('expired')) onRestart();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-accent" />
          {step.next === 'setup' ? 'Set up two-factor' : 'Two-factor code'}
        </CardTitle>
        <CardDescription>
          {step.next === 'setup'
            ? 'Scan this with Google Authenticator, 1Password or a similar app, then enter the 6-digit code it shows.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {step.next === 'setup' && (
          <div className="grid justify-items-center gap-2 rounded-lg border bg-white p-4">
            <img src={step.qrDataUrl} alt="Two-factor QR code" width={200} height={200} />
            <code className="text-xs break-all text-muted-foreground">{step.secret}</code>
          </div>
        )}
        <form className="grid gap-4" noValidate onSubmit={form.handleSubmit((d) => verify.mutate(d))}>
          <FormField id="code" label="Code" error={form.formState.errors.code?.message}>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className="text-center font-mono text-xl tracking-[0.4em]"
              {...form.register('code')}
            />
          </FormField>
          <Button type="submit" disabled={verify.isPending}>
            {verify.isPending && <Loader2 className="animate-spin" />}
            Verify
          </Button>
          <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={onRestart}>
            Start over
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
