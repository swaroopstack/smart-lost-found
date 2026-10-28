import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { errorMessage } from "@/api/errors";
import { useAuth } from "@/auth/AuthProvider";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input, PasswordInput } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";

const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name").max(120, "Keep this under 120 characters"),
    email: z.string().trim().min(1, "Enter your email address").email("Enter a valid email address"),
    roll_number: z.string().trim().max(40, "Keep this under 40 characters").optional(),
    department: z.string().trim().max(80, "Keep this under 80 characters").optional(),
    phone: z.string().trim().max(20, "Keep this under 20 characters").optional(),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Keep the password under 72 characters"),
    confirm: z.string().min(1, "Repeat your password"),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "The two passwords do not match",
  });

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { user, status, login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      roll_number: "",
      department: "",
      phone: "",
      password: "",
      confirm: "",
    },
  });

  if (status === "authenticated" && user) {
    return <Navigate to="/" replace />;
  }

  async function submit(values: RegisterValues) {
    setFormError(null);
    try {
      await endpoints.register({
        email: values.email.trim(),
        password: values.password,
        full_name: values.full_name.trim(),
        roll_number: values.roll_number?.trim() || undefined,
        department: values.department?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
      });

      await login(values.email.trim(), values.password);
      toast.success("Account created", "Welcome to CampusFind.");
      navigate("/", { replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <AuthLayout>
      <div className="surface-card p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-ink-strong">Create your account</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-fg">
          Student accounts can report items, see possible matches and submit ownership claims.
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

        <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4" noValidate>
          <Input
            id="register-name"
            label="Full name"
            autoComplete="name"
            placeholder="Aarav Sharma"
            required
            error={errors.full_name?.message}
            {...register("full_name")}
          />

          <Input
            id="register-email"
            label="Email address"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@campus.edu"
            required
            error={errors.email?.message}
            {...register("email")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="register-roll"
              label="Roll number"
              placeholder="24BCS00001"
              autoComplete="off"
              error={errors.roll_number?.message}
              {...register("roll_number")}
            />
            <Input
              id="register-department"
              label="Department"
              placeholder="CSE"
              autoComplete="organization"
              error={errors.department?.message}
              {...register("department")}
            />
          </div>

          <Input
            id="register-phone"
            label="Phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Optional, for the desk to reach you"
            error={errors.phone?.message}
            {...register("phone")}
          />

          <PasswordInput
            id="register-password"
            label="Password"
            autoComplete="new-password"
            hint="At least 8 characters. A short phrase is easier to remember."
            required
            error={errors.password?.message}
            {...register("password")}
          />

          <PasswordInput
            id="register-confirm"
            label="Confirm password"
            autoComplete="new-password"
            required
            error={errors.confirm?.message}
            {...register("confirm")}
          />

          <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
            Create account
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-fg">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-brand-strong underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
