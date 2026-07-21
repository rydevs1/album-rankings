import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewAlbumForm from "@/components/admin/NewAlbumForm";
import LogoutButton from "@/components/admin/LogoutButton";

export const dynamic = "force-dynamic";

export default async function NewAlbumPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== "rydevs1@gmail.com") {
    redirect("/login");
  }

  return (
    <main>
      <h1>Add Album</h1>

      <LogoutButton />

      <NewAlbumForm />
    </main>
  );
}