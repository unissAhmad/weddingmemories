import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Loader2, Mail, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  AccessCodeLoginSchema,
  type AccessCodeLogin,
  type AccessCodeLoginInput,
  GuestEmailSchema,
  GuestNameSchema,
  OTP_LENGTH,
  OtpCodeSchema,
  type GuestMe,
} from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, isApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useMe } from '@/hooks/useMe';
import { useEventContext } from './EventLayout';
import { MadeBy } from '@/components/MadeBy';

const DetailsSchema = z.object({ name: GuestNameSchema, email: GuestEmailSchema });
type DetailsInput = z.input<typeof DetailsSchema>;
type Details = z.output<typeof DetailsSchema>;

const CodeSchema = z.object({ code: OtpCodeSchema });
type CodeForm = z.output<typeof CodeSchema>;

const RESEND_COOLDOWN_S = 30;

type Method = 'code' | 'email';

export function JoinPage() {
  const event = useEventContext();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const method = (['code', 'email'] as const).find((m) => m === params.get('via')) ?? null;
  const [details, setDetails] = useState<Details | null>(null);

  // Kept in the URL so the phone's back button returns to the choice.
  const choose = (m: Method | null) => {
    setDetails(null);
    setParams(m ? { via: m } : {});
  };

  if (me.data?.event.id === event.id) return <Navigate to={`/e/${event.slug}/upload`} replace />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-6">
      {method ? (
        <button
          type="button"
          onClick={() => choose(null)}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Other ways to join
        </button>
      ) : (
        <Link
          to=".."
          relative="path"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {event.name}
        </Link>
      )}

      <div className="flex flex-1 flex-col justify-center py-8">
        {method === null && <ChooseMethod onChoose={choose} />}
        {method === 'code' && <AccessCodeStep />}
        {method === 'email' &&
          (details ? (
            <CodeStep details={details} onBack={() => setDetails(null)} />
          ) : (
            <DetailsStep onSent={setDetails} />
          ))}
      </div>
      <MadeBy className="mt-auto pt-10" />
    </main>
  );
}

function ChooseMethod({ onChoose }: { onChoose: (m: Method) => void }) {
  return (
    <div className="grid gap-4">
      <div className="mb-2 text-center">
        <h1 className="text-4xl">Join the celebration</h1>
        <p className="mt-2 text-sm text-muted-foreground">How would you like to come in?</p>
      </div>
      <MethodCard
        icon={<Ticket />}
        title="I have an access code"
        description="Enter your name and the code from your invitation. You'll see the whole gallery straight away."
        onClick={() => onChoose('code')}
      />
      <MethodCard
        icon={<Mail />}
        title="Request access by email"
        description="Verify your email to share photos, then ask the couple to open the gallery for you."
        onClick={() => onChoose('email')}
      />
    </div>
  );
}

function MethodCard(props: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="group flex items-start gap-4 rounded-xl border bg-card p-5 text-left shadow-xs transition-colors hover:border-accent/60 hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent [&_svg]:size-5">
        {props.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-2xl leading-tight">{props.title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{props.description}</span>
      </span>
      <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function AccessCodeStep() {
  const event = useEventContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<AccessCodeLoginInput, unknown, AccessCodeLogin>({
    resolver: zodResolver(AccessCodeLoginSchema),
    defaultValues: { slug: event.slug, name: '', code: '' },
  });
  const signIn = useMutation({
    mutationFn: (d: AccessCodeLogin) => api<GuestMe>('/guest/code', { method: 'POST', body: d }),
    onSuccess: (me) => {
      qc.setQueryData(queryKeys.me, me);
      navigate(`/e/${event.slug}/gallery`, { replace: true });
    },
    onError: (err) => form.setError('code', { message: err.message }),
  });
  const { errors } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter your access code</CardTitle>
        <CardDescription>Type your name exactly as it appears on your invitation, with its code.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" noValidate onSubmit={form.handleSubmit((d) => signIn.mutate(d))}>
          <FormField id="code-name" label="Your name" error={errors.name?.message}>
            <Input
              id="code-name"
              autoComplete="name"
              autoCapitalize="words"
              aria-invalid={Boolean(errors.name)}
              {...form.register('name')}
            />
          </FormField>
          <FormField id="access-code" label="Access code" error={errors.code?.message}>
            <Input
              id="access-code"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              className="font-mono tracking-[0.2em] uppercase"
              aria-invalid={Boolean(errors.code)}
              {...form.register('code')}
            />
          </FormField>
          <Button type="submit" size="lg" disabled={signIn.isPending}>
            {signIn.isPending && <Loader2 className="animate-spin" />}
            Enter
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DetailsStep({ onSent }: { onSent: (d: Details) => void }) {
  const event = useEventContext();
  const form = useForm<DetailsInput, unknown, Details>({
    resolver: zodResolver(DetailsSchema),
    defaultValues: { name: '', email: '' },
  });

  const request = useMutation({
    mutationFn: (d: Details) =>
      api<void>('/guest/otp/request', { method: 'POST', body: { slug: event.slug, ...d } }),
    onSuccess: (_data, d) => onSent(d),
    onError: (err) => toast.error(err.message),
  });

  const { errors } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>
          We'll email you a {OTP_LENGTH}-digit code. Your name appears on the photos you share.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-5"
          noValidate
          onSubmit={form.handleSubmit((d) => request.mutate(d))}
        >
          <FormField id="name" label="Your name" error={errors.name?.message}>
            <Input
              id="name"
              autoComplete="name"
              autoCapitalize="words"
              aria-invalid={Boolean(errors.name)}
              {...form.register('name')}
            />
          </FormField>
          <FormField id="email" label="Email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              aria-invalid={Boolean(errors.email)}
              {...form.register('email')}
            />
          </FormField>
          <Button type="submit" size="lg" disabled={request.isPending}>
            {request.isPending && <Loader2 className="animate-spin" />}
            Send my code
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CodeStep({ details, onBack }: { details: Details; onBack: () => void }) {
  const event = useEventContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const form = useForm<CodeForm>({
    resolver: zodResolver(CodeSchema),
    defaultValues: { code: '' },
  });

  const verify = useMutation({
    mutationFn: ({ code }: CodeForm) =>
      api<GuestMe>('/guest/otp/verify', {
        method: 'POST',
        body: { slug: event.slug, ...details, code },
      }),
    onSuccess: (me) => {
      qc.setQueryData(queryKeys.me, me);
      navigate(`/e/${event.slug}/upload`, { replace: true });
    },
    onError: (err) => {
      form.setError('code', { message: err.message });
      if (isApiError(err, 'OTP_EXPIRED') || isApiError(err, 'OTP_TOO_MANY_ATTEMPTS')) {
        form.setValue('code', '');
      }
    },
  });

  const resend = useMutation({
    mutationFn: () =>
      api<void>('/guest/otp/request', { method: 'POST', body: { slug: event.slug, ...details } }),
    onSuccess: () => {
      setCooldown(RESEND_COOLDOWN_S);
      form.reset({ code: '' });
      toast.success('A new code is on its way.');
    },
    onError: (err) => toast.error(err.message),
  });

  const submit = form.handleSubmit((d) => verify.mutate(d));
  const codeField = form.register('code');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent a code to <span className="font-medium text-foreground">{details.email}</span>.
          It expires in 10 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" noValidate onSubmit={submit}>
          <FormField id="code" label="Code" error={form.formState.errors.code?.message}>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={OTP_LENGTH}
              autoFocus
              className="text-center font-mono text-2xl tracking-[0.5em]"
              aria-invalid={Boolean(form.formState.errors.code)}
              {...codeField}
              onChange={(e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH);
                void codeField.onChange(e);
                // Submit as soon as the code is complete (including iOS autofill).
                if (e.target.value.length === OTP_LENGTH && !verify.isPending) void submit();
              }}
            />
          </FormField>
          <Button type="submit" size="lg" disabled={verify.isPending}>
            {verify.isPending && <Loader2 className="animate-spin" />}
            Continue
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="text-muted-foreground underline-offset-4 hover:underline" onClick={onBack}>
              Change email
            </button>
            <button
              type="button"
              className="text-muted-foreground underline-offset-4 hover:underline disabled:no-underline disabled:opacity-60"
              disabled={cooldown > 0 || resend.isPending}
              onClick={() => resend.mutate()}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
