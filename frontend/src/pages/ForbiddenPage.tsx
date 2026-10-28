import { Link } from "react-router-dom";
import { ArrowLeft, ShieldWarning } from "@phosphor-icons/react";
import { useAuth } from "@/auth/AuthProvider";
import { buttonStyles } from "@/components/ui/Button";

export function ForbiddenPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center sm:py-24">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
        <ShieldWarning size={26} aria-hidden="true" />
      </div>

      <p className="mt-5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted-fg">
        403 · Forbidden
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-strong">
        This area is for the lost-and-found desk
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-fg">
        {user
          ? `You are signed in as ${user.full_name} (${user.role.toLowerCase()}). Your account does not have permission to open this page. If you think that is wrong, ask the lost-and-found desk to review your role.`
          : "Your account does not have permission to open this page."}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link to="/" className={buttonStyles("primary", "md")}>
          Go to overview
        </Link>
        <Link to="/browse" className={buttonStyles("secondary", "md")}>
          Browse reports
        </Link>
        <button
          type="button"
          onClick={() => window.history.back()}
          className={buttonStyles("ghost", "md")}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Go back
        </button>
      </div>
    </div>
  );
}
