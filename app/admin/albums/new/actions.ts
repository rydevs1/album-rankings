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

export type CreateAlbumState = {
  error: string | null;
};

export async function createAlbum(
  previousState: CreateAlbumState,
  formData: FormData
): Promise<CreateAlbumState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (
    userError ||
    !user ||
    user.email !== "rydevs1@gmail.com"
  ) {
    return {
      error: "You are not authorized to add albums.",
    };
  }

  const title = readRequiredText(formData, "title");
  const artistName = readRequiredText(
    formData,
    "artistName"
  );

  const displayArtistName = String(
    formData.get("displayArtistName") ?? ""
  ).trim();

  const grade = readRequiredText(formData, "grade");
  const releaseYear = Number(formData.get("releaseYear"));
  const releaseMonth = Number(formData.get("releaseMonth"));
  const runtimeMinutes = Number(
    formData.get("runtimeMinutes")
  );

  const collected = formData.get("collected") === "on";

  const note = String(formData.get("note") ?? "").trim();
  const spotifyUrl = String(
    formData.get("spotifyUrl") ?? ""
  ).trim();

  if (!title) {
    return { error: "Album title is required." };
  }

  if (!artistName) {
    return { error: "Artist is required." };
  }

  if (!grade) {
    return { error: "Album grade is required." };
  }

  if (
    !Number.isInteger(releaseYear) ||
    releaseYear < 1800 ||
    releaseYear > 2200
  ) {
    return { error: "Release year is invalid." };
  }

  if (
    !Number.isInteger(releaseMonth) ||
    releaseMonth < 1 ||
    releaseMonth > 12
  ) {
    return { error: "Release month is invalid." };
  }

  if (
    !Number.isInteger(runtimeMinutes) ||
    runtimeMinutes <= 0
  ) {
    return {
      error: "Album runtime must be a positive number.",
    };
  }

  const tracksResult = parseTracks(formData);

  if ("error" in tracksResult) {
    return tracksResult;
  }

  /*
   * Find the canonical artist without case sensitivity.
   * If it does not exist, create it.
   */

  let artistId: number;
  let createdArtist = false;

  const { data: matchingArtists, error: artistSearchError } =
    await supabase
      .from("artists")
      .select("id, name, slug")
      .ilike("name", artistName);

  if (artistSearchError) {
    return {
      error: `Could not search artists: ${artistSearchError.message}`,
    };
  }

  const exactArtist = matchingArtists?.find(
    (artist) =>
      artist.name.localeCompare(artistName, undefined, {
        sensitivity: "accent",
      }) === 0
  );

  if (exactArtist) {
    artistId = exactArtist.id;
  } else {
    const artistSlugResult = await createUniqueArtistSlug(
      supabase,
      artistName
    );

    if ("error" in artistSlugResult) {
      return artistSlugResult;
    }

    const { data: newArtist, error: newArtistError } =
      await supabase
        .from("artists")
        .insert({
          name: artistName,
          slug: artistSlugResult.slug,
        })
        .select("id")
        .single();

    if (newArtistError || !newArtist) {
      return {
        error:
          newArtistError?.message ??
          "The artist could not be created.",
      };
    }

    artistId = newArtist.id;
    createdArtist = true;
  }

  /*
   * Create or reuse the displayed alias.
   */

  let aliasId: number | null = null;

  if (
    displayArtistName &&
    displayArtistName.toLocaleLowerCase() !==
      artistName.toLocaleLowerCase()
  ) {
    const { data: existingAliases, error: aliasSearchError } =
      await supabase
        .from("artist_aliases")
        .select("id, alias_name")
        .eq("artist_id", artistId)
        .ilike("alias_name", displayArtistName);

    if (aliasSearchError) {
      return {
        error: `Could not search aliases: ${aliasSearchError.message}`,
      };
    }

    const existingAlias = existingAliases?.find(
      (alias) =>
        alias.alias_name.localeCompare(
          displayArtistName,
          undefined,
          { sensitivity: "accent" }
        ) === 0
    );

    if (existingAlias) {
      aliasId = existingAlias.id;
    } else {
      const { data: newAlias, error: aliasError } =
        await supabase
          .from("artist_aliases")
          .insert({
            artist_id: artistId,
            alias_name: displayArtistName,
          })
          .select("id")
          .single();

      if (aliasError || !newAlias) {
        return {
          error:
            aliasError?.message ??
            "The artist alias could not be created.",
        };
      }

      aliasId = newAlias.id;
    }
  }

  /*
   * Generate a unique album slug.
   */

  const albumSlugResult = await createUniqueAlbumSlug(
    supabase,
    title,
    artistName
  );

  if ("error" in albumSlugResult) {
    return albumSlugResult;
  }

  /*
   * Insert the album.
   */

  const { data: album, error: albumError } = await supabase
    .from("albums")
    .insert({
      title,
      slug: albumSlugResult.slug,
      release_year: releaseYear,
      release_month: releaseMonth,
      runtime_minutes: runtimeMinutes,
      grade,
      collected,
      note: note || null,
      spotify_url: spotifyUrl || null,
      cover_path: null,
    })
    .select("id, slug")
    .single();

  if (albumError || !album) {
    if (createdArtist) {
      await supabase
        .from("artists")
        .delete()
        .eq("id", artistId);
    }

    return {
      error:
        albumError?.message ??
        "The album could not be created.",
    };
  }

  /*
   * Automatically place the album at the bottom of the
   * canonical artist's ranking.
   */

  const { data: lastRankedAlbum, error: rankError } =
    await supabase
      .from("album_artists")
      .select("artist_rank")
      .eq("artist_id", artistId)
      .order("artist_rank", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (rankError) {
    await deleteIncompleteAlbum(supabase, album.id);

    return {
      error: `Could not determine artist rank: ${rankError.message}`,
    };
  }

  const nextArtistRank =
    (lastRankedAlbum?.artist_rank ?? 0) + 1;

  const { error: artistCreditError } = await supabase
    .from("album_artists")
    .insert({
      album_id: album.id,
      artist_id: artistId,
      alias_id: aliasId,
      artist_order: 1,
      artist_rank: nextArtistRank,
    });

  if (artistCreditError) {
    await deleteIncompleteAlbum(supabase, album.id);

    return {
      error: `Artist credit failed: ${artistCreditError.message}`,
    };
  }

  /*
   * Insert tracks.
   */

  const { error: trackError } = await supabase
    .from("tracks")
    .insert(
      tracksResult.tracks.map((track, index) => ({
        album_id: album.id,
        track_number: index + 1,
        title: track.title,
        runtime_seconds: track.runtimeSeconds,
        grade: track.grade,
        note: track.note || null,
        starts_new_side: track.startsNewSide,
      }))
    );

  if (trackError) {
    await deleteIncompleteAlbum(supabase, album.id);

    return {
      error: `Tracks could not be created: ${trackError.message}`,
    };
  }

  /*
   * Upload the cover if one was selected.
   */

  const cover = formData.get("cover");

  if (cover instanceof File && cover.size > 0) {
    const extension =
      cover.name.split(".").pop()?.toLowerCase() || "webp";

    const coverPath = `${album.slug}/cover.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("album-covers")
      .upload(coverPath, cover, {
        upsert: false,
        contentType: cover.type,
      });

    if (uploadError) {
      await deleteIncompleteAlbum(supabase, album.id);

      return {
        error: `Cover upload failed: ${uploadError.message}`,
      };
    }

    const { error: coverPathError } = await supabase
      .from("albums")
      .update({
        cover_path: coverPath,
      })
      .eq("id", album.id);

    if (coverPathError) {
      await supabase.storage
        .from("album-covers")
        .remove([coverPath]);

      await deleteIncompleteAlbum(supabase, album.id);

      return {
        error: `Cover path could not be saved: ${coverPathError.message}`,
      };
    }
  }

  /*
   * The album is deliberately not inserted into the Top 50.
   */

  revalidatePath("/");
  revalidatePath("/database");
  revalidatePath(`/artists/${createSlug(artistName)}`);

  redirect("/");
}

function readRequiredText(
  formData: FormData,
  name: string
): string {
  return String(formData.get(name) ?? "").trim();
}

function parseTracks(
  formData: FormData
):
  | {
      tracks: Array<{
        title: string;
        runtimeSeconds: number;
        grade: string;
        note: string;
        startsNewSide: boolean;
      }>;
    }
  | CreateAlbumState {
  const tracksJson = String(
    formData.get("tracks") ?? "[]"
  );

  let submittedTracks: TrackSubmission[];

  try {
    submittedTracks = JSON.parse(
      tracksJson
    ) as TrackSubmission[];
  } catch {
    return {
      error: "The track information could not be read.",
    };
  }

  if (submittedTracks.length === 0) {
    return {
      error: "Enter at least one track.",
    };
  }

  try {
    return {
      tracks: submittedTracks.map((track) => {
        const title = track.title.trim();
        const grade = track.grade.trim();

        if (!title) {
          throw new Error(
            "Every track must have a title."
          );
        }

        if (!grade) {
          throw new Error(
            `Enter a grade for "${title}".`
          );
        }

        return {
          title,
          runtimeSeconds: trackRuntimeToSeconds(
            track.runtime
          ),
          grade,
          note: track.note.trim(),
          startsNewSide: track.startsNewSide,
        };
      }),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "One or more tracks are invalid.",
    };
  }
}

async function createUniqueArtistSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  artistName: string
): Promise<{ slug: string } | CreateAlbumState> {
  const baseSlug = createSlug(artistName);

  if (!baseSlug) {
    return {
      error: "The artist name cannot create a valid URL.",
    };
  }

  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const { data, error } = await supabase
      .from("artists")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      return { error: error.message };
    }

    if (!data) {
      return { slug };
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function createUniqueAlbumSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  albumTitle: string,
  artistName: string
): Promise<{ slug: string } | CreateAlbumState> {
  const titleSlug = createSlug(albumTitle);
  const artistSlug = createSlug(artistName);

  if (!titleSlug) {
    return {
      error: "The album title cannot create a valid URL.",
    };
  }

  let slug = titleSlug;

  const { data: existingAlbum, error } = await supabase
    .from("albums")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!existingAlbum) {
    return { slug };
  }

  slug = `${titleSlug}-${artistSlug}`;
  let suffix = 2;

  while (true) {
    const { data, error: repeatedError } =
      await supabase
        .from("albums")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

    if (repeatedError) {
      return { error: repeatedError.message };
    }

    if (!data) {
      return { slug };
    }

    slug = `${titleSlug}-${artistSlug}-${suffix}`;
    suffix += 1;
  }
}

async function deleteIncompleteAlbum(
  supabase: Awaited<ReturnType<typeof createClient>>,
  albumId: number
) {
  await supabase
    .from("albums")
    .delete()
    .eq("id", albumId);
}