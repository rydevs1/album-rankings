"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" onClick={logout}>
      Log out
    </button>
  );
}