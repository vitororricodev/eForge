import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // On the server, redirect to welcome by default. Client-side effect will
    // route authenticated users straight to the dashboard.
    if (typeof window === "undefined") {
      throw redirect({ to: "/welcome" });
    }
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/dashboard" : "/welcome" });
  },
  component: IndexSplash,
});

function IndexSplash() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      navigate({ to: data.session ? "/dashboard" : "/welcome", replace: true });
    })();
  }, [navigate]);
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div className="size-10 animate-spin rounded-full border-2 border-neon border-t-transparent" />
    </div>
  );
}
