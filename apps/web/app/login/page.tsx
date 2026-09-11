import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";
import { accessConfig } from "@/lib/auth/config";
import { safeNextPath } from "@/lib/auth/guard";

type Props = {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
};

/** The single pilot user's sign-in. The passphrase is checked server-side by `/auth/session`. */
export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  const config = accessConfig();
  if (config.mode !== "configured") {
    return (
      <>
        <AppHeader title="Sign in" />
        <ErrorState
          title="Sign-in is not available"
          body={
            config.mode === "development_open"
              ? "This development build has no sign-in; every route is open locally."
              : "This deployment is not configured for access. This is a configuration problem."
          }
        />
      </>
    );
  }
  return (
    <>
      <AppHeader title="Sign in" subtitle="Private pilot" />
      <Card as="div">
        <form method="post" action="/auth/session" className="pp-stack">
          <input type="hidden" name="next" value={safeNextPath(next)} />
          <label className="pp-label" htmlFor="passphrase">
            Pilot passphrase
          </label>
          <input
            id="passphrase"
            name="passphrase"
            type="password"
            autoComplete="current-password"
            required
            className="pp-input"
          />
          {error ? (
            <p className="pp-sub" role="alert">
              That passphrase was not accepted.
            </p>
          ) : null}
          <Button type="submit">Sign in</Button>
        </form>
      </Card>
    </>
  );
}
