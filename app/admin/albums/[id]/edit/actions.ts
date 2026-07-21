"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createSlug,
  trackRuntimeToSeconds,
} from "@/lib/admin-input";

type TrackSubmission = {
  title: string;
  runtime: string;
  grade: string;
  note: string;
  startsNewSide: boolean;
};

export type EditAlbumState = {
  error: string | null;
};

export async function updateAlbum(
  previousState: EditAlbumState,
  formData: FormData
): Promise<EditAlbumState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user ||
    user.email !== "rydevs1@gmail.com"
  ) {
    return {
      error: "You are not authorized.",
    };
  }

  const albumId = Number(formData.get("albumId"));
  const title = String(formData.get("title") ?? "").trim();
  const artistName = String(
    formData.get("artistName") ?? ""
  ).trim();

  const displayArtistName = String(
    formData.get("displayArtistName") ?? ""
  ).trim();

  const releaseYear = Number(
    formData.get("releaseYear")
  );

  const releaseMonth = Number(
    formData.get("releaseMonth")
  );

  const runtimeMinutes = Number(
    formData.get("runtimeMinutes")
  );

  const grade = String(formData.get("grade") ?? "").trim();
  const collected =
    formData.get("collected") === "on";

  const note = String(formData.get("note") ?? "").trim();
  const spotifyUrl = String(
    formData.get("spotifyUrl") ?? ""
  ).trim();

  if (
    !Number.isInteger(albumId) ||
    !title ||
    !artistName ||
    !grade
  ) {
    return {
      error: "Album title, artist, and grade are required.",
    };
  }

  let submittedTracks: TrackSubmission[];

  try {
    submittedTracks = JSON.parse(
      String(formData.get("tracks") ?? "[]")
    ) as TrackSubmission[];
  } catch {
    return {
      error: "Track information could not be read.",
    };
  }

  if (submittedTracks.length === 0) {
    return {
      error: "The album must have at least one track.",
    };
  }

  let tracks;

  try {
    tracks = submittedTracks.map((track, index) => {
      const trackTitle = track.title.trim();
      const trackGrade = track.grade.trim();

      if (!trackTitle || !trackGrade) {
        throw new Error(
          `Track ${index + 1} needs a title and grade.`
        );
      }

      return {
        album_id: albumId,
        track_number: index + 1,
        title: trackTitle,
        runtime_seconds: trackRuntimeToSeconds(
          track.runtime
        ),
        grade: trackGrade,
        note: track.note.trim() || null,
        starts_new_side: track.startsNewSide,
      };
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "One or more tracks are invalid.",
    };
  }

  const { data: existingArtistRows } = await supabase
    .from("artists")
    .select("id, name")
    .ilike("name", artistName);

  let artist = existingArtistRows?.find(
    (row) =>
      row.name.toLowerCase() ===
      artistName.toLowerCase()
  );

  if (!artist) {
    let slug = createSlug(artistName);

    const { data: duplicateSlug } = await supabase
      .from("artists")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (duplicateSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const { data: newArtist, error } = await supabase
      .from("artists")
      .insert({
        name: artistName,
        slug,
      })
      .select("id, name")
      .single();

    if (error || !newArtist) {
      return {
        error:
          error?.message ??
          "The artist could not be created.",
      };
    }

    artist = newArtist;
  }

  const { data: currentCredit } = await supabase
    .from("album_artists")
    .select("artist_id, artist_rank")
    .eq("album_id", albumId)
    .order("artist_order")
    .limit(1)
    .single();

  let artistRank = currentCredit?.artist_rank ?? 1;

  if (
    !currentCredit ||
    currentCredit.artist_id !== artist.id
  ) {
    const { data: lastArtistAlbum } = await supabase
      .from("album_artists")
      .select("artist_rank")
      .eq("artist_id", artist.id)
      .order("artist_rank", { ascending: false })
      .limit(1)
      .maybeSingle();

    artistRank =
      (lastArtistAlbum?.artist_rank ?? 0) + 1;
  }

  let aliasId: number | null = null;

  if (
    displayArtistName &&
    displayArtistName.toLowerCase() !==
      artistName.toLowerCase()
  ) {
    const { data: existingAliases } = await supabase
      .from("artist_aliases")
      .select("id, alias_name")
      .eq("artist_id", artist.id)
      .ilike("alias_name", displayArtistName);

    const existingAlias = existingAliases?.find(
      (alias) =>
        alias.alias_name.toLowerCase() ===
        displayArtistName.toLowerCase()
    );

    if (existingAlias) {
      aliasId = existingAlias.id;
    } else {
      const { data: newAlias, error } = await supabase
        .from("artist_aliases")
        .insert({
          artist_id: artist.id,
          alias_name: displayArtistName,
        })
        .select("id")
        .single();

      if (error || !newAlias) {
        return {
          error:
            error?.message ??
            "The display alias could not be created.",
        };
      }

      aliasId = newAlias.id;
    }
  }

  const { error: albumError } = await supabase
    .from("albums")
    .update({
      title,
      release_year: releaseYear,
      release_month: releaseMonth,
      runtime_minutes: runtimeMinutes,
      grade,
      collected,
      note: note || null,
      spotify_url: spotifyUrl || null,
    })
    .eq("id", albumId);

  if (albumError) {
    return {
      error: albumError.message,
    };
  }

  await supabase
    .from("album_artists")
    .delete()
    .eq("album_id", albumId);

  const { error: creditError } = await supabase
    .from("album_artists")
    .insert({
      album_id: albumId,
      artist_id: artist.id,
      alias_id: aliasId,
      artist_order: 1,
      artist_rank: artistRank,
    });

  if (creditError) {
    return {
      error: creditError.message,
    };
  }

  const { error: deleteTracksError } = await supabase
    .from("tracks")
    .delete()
    .eq("album_id", albumId);

  if (deleteTracksError) {
    return {
      error: deleteTracksError.message,
    };
  }

  const { error: tracksError } = await supabase
    .from("tracks")
    .insert(tracks);

  if (tracksError) {
    return {
      error: tracksError.message,
    };
  }

  const cover = formData.get("cover");
  const currentCoverPath = String(
    formData.get("currentCoverPath") ?? ""
  );

  if (cover instanceof File && cover.size > 0) {
    const extension =
      cover.name.split(".").pop()?.toLowerCase() ??
      "webp";

    const coverPath = `${albumId}/cover.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("album-covers")
      .upload(coverPath, cover, {
        upsert: true,
        contentType: cover.type,
      });

    if (uploadError) {
      return {
        error: uploadError.message,
      };
    }

    const { error: pathError } = await supabase
      .from("albums")
      .update({
        cover_path: coverPath,
      })
      .eq("id", albumId);

    if (pathError) {
      return {
        error: pathError.message,
      };
    }

    if (
      currentCoverPath &&
      currentCoverPath !== coverPath
    ) {
      await supabase.storage
        .from("album-covers")
        .remove([currentCoverPath]);
    }
  }

  revalidatePath("/");
  revalidatePath("/database");

  redirect("/");
}