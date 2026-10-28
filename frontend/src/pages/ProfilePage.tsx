import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Key, WarningCircle } from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { errorMessage } from "@/api/errors";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input, PasswordInput } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { RoleBadge } from "@/components/domain/StatusBadges";
import { formatDate, initials } from "@/lib/format";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120, "Keep this under 120 characters"),
  department: z.string().trim().max(80, "Keep this under 80 characters").optional(),
  roll_number: z.string().trim().max(40, "Keep this under 40 characters").optional(),
  phone: z.string().trim().max(20, "Keep this under 20 characters").optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Keep the password under 72 characters"),
    confirm: z.string().min(1, "Repeat the new password"),
  })
  .refine((values) => values.new_password === values.confirm, {
    path: ["confirm"],
    message: "The two passwords do not match",
  });

type PasswordValues = z.infer<typeof passwordSchema>;

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [profileError, setProfileError] = useState<string | null>(null);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name ?? "",
      department: user?.department ?? "",
      roll_number: user?.roll_number ?? "",
      phone: user?.phone ?? "",
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "", confirm: "" },
  });

  const profileMutation = useMutation({
    mutationFn: (values: ProfileValues) =>
      endpoints.updateMe({
        full_name: values.full_name.trim(),
        department: values.department?.trim() || null,
        roll_number: values.roll_number?.trim() || null,
        phone: values.phone?.trim() || null,
      }),
    onSuccess: async () => {
      setProfileError(null);
      await refreshUser();
      toast.success("Profile updated", "Your details are up to date.");
    },
    onError: (error) => {
      setProfileError(errorMessage(error));
      toast.error("Could not save your profile", errorMessage(error));
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) =>
      endpoints.changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      }),
    onSuccess: () => {
      passwordForm.reset();
      toast.success("Password changed", "Use your new password the next time you sign in.");
    },
    onError: (error) => {
      toast.error("Could not change your password", errorMessage(error));
    },
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your profile"
        description="Keep your contact details current so the lost-and-found desk can reach you about a claim."
      />

      <div className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft font-mono text-lg font-semibold text-brand-ink">
          {initials(user.full_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-ink-strong">{user.full_name}</h2>
            <RoleBadge role={user.role} size="sm" />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-fg">{user.email}</p>
          <p className="mt-1 text-xs text-muted-fg">Member since {formatDate(user.created_at)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="details-heading" className="surface-card p-5 sm:p-6">
          <h2 id="details-heading" className="text-base font-semibold text-ink-strong">
            Your details
          </h2>
          <p className="mt-1 text-sm text-muted-fg">
            Your email and role are managed by the college and cannot be changed here.
          </p>

          {profileError && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger-soft/50 px-3.5 py-3 text-sm text-danger-strong"
            >
              <WarningCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>{profileError}</p>
            </div>
          )}

          <form
            className="mt-5 space-y-4"
            onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))}
            noValidate
          >
            <Input
              id="profile-name"
              label="Full name"
              autoComplete="name"
              required
              error={profileForm.formState.errors.full_name?.message}
              {...profileForm.register("full_name")}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="profile-roll"
                label="Roll number"
                autoComplete="off"
                error={profileForm.formState.errors.roll_number?.message}
                {...profileForm.register("roll_number")}
              />
              <Input
                id="profile-department"
                label="Department"
                autoComplete="organization"
                error={profileForm.formState.errors.department?.message}
                {...profileForm.register("department")}
              />
            </div>

            <Input
              id="profile-phone"
              label="Phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              hint="Shown only to the lost-and-found desk."
              error={profileForm.formState.errors.phone?.message}
              {...profileForm.register("phone")}
            />

            <div className="flex justify-end">
              <Button type="submit" loading={profileMutation.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </section>

        <section aria-labelledby="password-heading" className="surface-card p-5 sm:p-6">
          <h2 id="password-heading" className="flex items-center gap-2 text-base font-semibold text-ink-strong">
            <Key size={18} className="text-brand-strong" aria-hidden="true" />
            Password
          </h2>
          <p className="mt-1 text-sm text-muted-fg">
            Choose something long and unique. You will stay signed in on this device.
          </p>

          <form
            className="mt-5 space-y-4"
            onSubmit={passwordForm.handleSubmit((values) => passwordMutation.mutate(values))}
            noValidate
          >
            <PasswordInput
              id="current-password"
              label="Current password"
              autoComplete="current-password"
              required
              error={passwordForm.formState.errors.current_password?.message}
              {...passwordForm.register("current_password")}
            />

            <PasswordInput
              id="new-password"
              label="New password"
              autoComplete="new-password"
              hint="At least 8 characters."
              required
              error={passwordForm.formState.errors.new_password?.message}
              {...passwordForm.register("new_password")}
            />

            <PasswordInput
              id="confirm-password"
              label="Confirm new password"
              autoComplete="new-password"
              required
              error={passwordForm.formState.errors.confirm?.message}
              {...passwordForm.register("confirm")}
            />

            <div className="flex justify-end">
              <Button type="submit" variant="secondary" loading={passwordMutation.isPending}>
                Change password
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
