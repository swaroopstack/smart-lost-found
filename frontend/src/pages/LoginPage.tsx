import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react";
import { useAuth } from "@/auth/AuthProvider";
import { errorMessage } from "@/api/errors";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input, PasswordInput } from "@/components/ui/FormControls";
import { DEMO_ACCOUNTS } from "@/lib/constants";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { user, status, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const requested = params.get("next");
  const destination = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  if (status === "authenticated" && user) {
    return <Navigate to={destination} replace />;
  }

  async function signIn(values: LoginValues) {
    setFormError(null);
    try {
      await login(values.email.trim(), values.password);
      queryClient.clear();
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  async function signInDemo(email: string, password: string) {
    setFormError(null);
    setDemoLoading(email);
    try {
      await login(email, password);
      queryClient.clear();
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setDemoLoading(null);
    }
  }

  return (
    <AuthLayout>
      <div className="surface-card p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-ink-strong">Welcome back</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-fg">
          Sign in to report an item, check your matches, or review the desk queue.
        </p>

        {formError && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger-soft/50 px-3.5 py-3 text-sm text-danger-strong"
          >
            <WarningCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>{formError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(signIn)} className="mt-6 space-y-4" noValidate>
          <Input
            id="login-email"
            label="Email address"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@campus.edu"
            required
            error={errors.email?.message}
            {...register("email")}
          />

          <PasswordInput
            id="login-password"
            label="Password"
            autoComplete="current-password"
            placeholder="Your password"
            required
            error={errors.password?.message}
            {...register("password")}
          />

          <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
            Sign in
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-fg">
          New here?{" "}
          <Link
            to="/register"
            className="font-semibold text-brand-strong underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
          >
            Create a student account
          </Link>
        </p>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-surface/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-fg">
          Try a demo account
        </p>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => signInDemo(account.email, account.password)}
              disabled={demoLoading !== null || isSubmitting}
              className="flex h-9 items-center justify-center rounded-lg border border-line bg-surface text-xs font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {demoLoading === account.email ? "Signing in..." : account.label}
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-2xs leading-relaxed text-muted-fg">
          Demo data is seeded: 24 lost, 17 found, 9 matches and 6 returned items.
        </p>
      </div>
    </AuthLayout>
  );
}
