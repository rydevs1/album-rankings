"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "rydevs1@gmail.com";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || user.email !== ADMIN_EMAIL) {
    throw new Error("You are not authorized.");
  }

  return supabase;
}

async function getCurrentTop50Order() {
  const supabase = await requireAdmin();

  const { data: list, error: listError } = await supabase
    .from("album_lists")
    .select("id")
    .eq("slug", "top-50")
    .single();

  if (listError || !list) {
    throw new Error("Top 50 list was not found.");
  }

  const { data: entries, error: entriesError } = await supabase
    .from("album_list_entries")
    .select("album_id, position")
    .eq("list_id", list.id)
    .order("position", { ascending: true });

  if (entriesError) {
    throw new Error(entriesError.message);
  }

  return {
    supabase,
    albumIds: (entries ?? []).map((entry) => entry.album_id),
  };
}

async function saveTop50Order(
  supabase: Awaited<ReturnType<typeof createClient>>,
  albumIds: number[]
) {
  const { error } = await supabase.rpc("set_album_list_order", {
    requested_list_slug: "top-50",
    ordered_album_ids: albumIds,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function moveTop50AlbumUp(albumId: number) {
  const { supabase, albumIds } = await getCurrentTop50Order();

  const index = albumIds.indexOf(albumId);

  if (index <= 0) {
    return;
  }

  [albumIds[index - 1], albumIds[index]] = [
    albumIds[index],
    albumIds[index - 1],
  ];

  await saveTop50Order(supabase, albumIds);
}

export async function moveTop50AlbumDown(albumId: number) {
  const { supabase, albumIds } = await getCurrentTop50Order();

  const index = albumIds.indexOf(albumId);

  if (index === -1 || index >= albumIds.length - 1) {
    return;
  }

  [albumIds[index], albumIds[index + 1]] = [
    albumIds[index + 1],
    albumIds[index],
  ];

  await saveTop50Order(supabase, albumIds);
}

export async function removeAlbumFromTop50(albumId: number) {
  const { supabase, albumIds } = await getCurrentTop50Order();

  const newOrder = albumIds.filter(
    (currentAlbumId) => currentAlbumId !== albumId
  );

  await saveTop50Order(supabase, newOrder);
}

export async function addAlbumToTop50(formData: FormData) {
  const albumId = Number(formData.get("albumId"));

  if (!Number.isInteger(albumId)) {
    throw new Error("Select an album.");
  }

  const { supabase, albumIds } = await getCurrentTop50Order();

  if (albumIds.includes(albumId)) {
    throw new Error("That album is already in the Top 50.");
  }

  if (albumIds.length >= 50) {
    throw new Error(
      "Remove an album before adding another album."
    );
  }

  albumIds.push(albumId);

  await saveTop50Order(supabase, albumIds);
}