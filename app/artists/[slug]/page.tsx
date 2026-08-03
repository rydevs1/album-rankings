import { createClient } from "@/lib/supabase/server";
import AlbumRankingEntry from "@/components/AlbumRankingEntry";
import type { RankingEntry } from "@/types/album";
import Link from "next/link";
import LogoutButton from "@/components/admin/LogoutButton";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

type ArtistPageProps = {
  params: Promise<{
    slug: string;
  }>;

  searchParams: Promise<{
    sort?: string;
  }>;
};

type SortMode = "best" | "chronological";

async function moveArtistAlbum(formData: FormData) {
  "use server";

  const artistId = Number(formData.get("artistId"));
  const albumId = Number(formData.get("albumId"));
  const slug = String(formData.get("slug") ?? "");
  const direction = String(formData.get("direction") ?? "");

  if (
    !artistId ||
    !albumId ||
    !slug ||
    (direction !== "up" && direction !== "down")
  ) {
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user?.email === "rydevs1@gmail.com";

  if (!isAdmin) {
    return;
  }

  /*
   * Get the complete custom ranking for this artist.
   *
   * We use the full ordered list rather than simply looking for
   * currentRank + 1 or currentRank - 1. That means this still works
   * if your ranks ever contain a gap.
   */
  const { data: artistRanking, error: rankingError } = await supabase
    .from("album_artists")
    .select(`
      album_id,
      artist_rank
    `)
    .eq("artist_id", artistId)
    .not("artist_rank", "is", null)
    .order("artist_rank", { ascending: true });

  if (rankingError || !artistRanking) {
    return;
  }

  const currentIndex = artistRanking.findIndex(
    (entry) => entry.album_id === albumId
  );

  if (currentIndex === -1) {
    return;
  }

  const targetIndex =
    direction === "up"
      ? currentIndex - 1
      : currentIndex + 1;

  if (
    targetIndex < 0 ||
    targetIndex >= artistRanking.length
  ) {
    return;
  }

  const currentEntry = artistRanking[currentIndex];
  const targetEntry = artistRanking[targetIndex];

  if (
    currentEntry.artist_rank === null ||
    targetEntry.artist_rank === null
  ) {
    return;
  }

  /*
   * Temporarily give the current album a negative rank so that
   * swapping does not conflict with a unique artist/rank rule,
   * if you have one.
   */
  const temporaryRank = -1000000 - currentEntry.artist_rank;

  const { error: temporaryMoveError } = await supabase
    .from("album_artists")
    .update({
      artist_rank: temporaryRank,
    })
    .eq("artist_id", artistId)
    .eq("album_id", currentEntry.album_id);

  if (temporaryMoveError) {
    return;
  }

  const { error: targetMoveError } = await supabase
    .from("album_artists")
    .update({
      artist_rank: currentEntry.artist_rank,
    })
    .eq("artist_id", artistId)
    .eq("album_id", targetEntry.album_id);

  if (targetMoveError) {
    /*
     * Attempt to restore the original rank if the second update fails.
     */
    await supabase
      .from("album_artists")
      .update({
        artist_rank: currentEntry.artist_rank,
      })
      .eq("artist_id", artistId)
      .eq("album_id", currentEntry.album_id);

    return;
  }

  const { error: currentMoveError } = await supabase
    .from("album_artists")
    .update({
      artist_rank: targetEntry.artist_rank,
    })
    .eq("artist_id", artistId)
    .eq("album_id", currentEntry.album_id);

  if (currentMoveError) {
    return;
  }

  revalidatePath(`/artists/${slug}`);
}

export default async function ArtistPage({
  params,
  searchParams,
}: ArtistPageProps) {
  const { slug } = await params;
  const { sort } = await searchParams;

  const sortMode: SortMode =
    sort === "chronological"
      ? "chronological"
      : "best";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user?.email === "rydevs1@gmail.com";

  /*
   * First find the artist using the slug from the URL.
   */
  const { data: artistData, error: artistError } = await supabase
    .from("artists")
    .select(`
      id,
      name,
      slug
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (artistError) {
    return (
      <main>
        <h1>Database error</h1>
        <pre>{artistError.message}</pre>
      </main>
    );
  }

  if (!artistData) {
    notFound();
  }

  /*
   * Then find every album connected to this artist.
   *
   * The outer artist_rank is this album's custom position for
   * the artist whose page we are currently viewing.
   *
   * The album_artists inside albums contains all displayed artist
   * credits, exactly like your homepage query.
   */
  const { data: artistAlbumEntries, error: albumsError } =
    await supabase
      .from("album_artists")
      .select(`
        artist_rank,
        albums (
          id,
          title,
          slug,
          release_year,
          release_month,
          runtime_minutes,
          grade,
          collected,
          note,
          cover_path,
          spotify_url,
          album_artists (
            artist_order,
            artist_rank,
            artists (
              id,
              name,
              slug
            ),
            artist_aliases (
              id,
              alias_name
            )
          ),
          tracks (
            id,
            title,
            track_number,
            runtime_seconds,
            grade,
            note,
            starts_new_side
          )
        )
      `)
      .eq("artist_id", artistData.id);

  if (albumsError) {
    return (
      <main>
        <h1>Database error</h1>
        <pre>{albumsError.message}</pre>
      </main>
    );
  }

  /*
   * Normalize Supabase's nested relationship results in the same
   * way as your homepage.
   *
   * originalArtistRank is kept separately because position will
   * be recalculated after chronological sorting.
   */
  const normalizedAlbums = (artistAlbumEntries ?? []).flatMap(
    (entry) => {
      const album = Array.isArray(entry.albums)
        ? entry.albums[0]
        : entry.albums;

      if (!album) {
        return [];
      }

      const normalizedAlbum = {
        ...album,

        album_artists: (album.album_artists ?? []).flatMap(
          (credit) => {
            const creditArtist = Array.isArray(credit.artists)
              ? credit.artists[0]
              : credit.artists;

            if (!creditArtist) {
              return [];
            }

            const alias = Array.isArray(credit.artist_aliases)
              ? credit.artist_aliases[0] ?? null
              : credit.artist_aliases ?? null;

            return [
              {
                artist_order: credit.artist_order,
                artist_rank: credit.artist_rank,
                artists: creditArtist,
                artist_aliases: alias,
              },
            ];
          }
        ),

        tracks: album.tracks ?? [],
      };

      return [
        {
          originalArtistRank: entry.artist_rank,
          album: normalizedAlbum,
        },
      ];
    }
  );

  /*
   * Sort either by the stored custom artist rank or by release date.
   */
  const sortedAlbums = [...normalizedAlbums].sort((a, b) => {
    if (sortMode === "best") {
      const rankA =
        a.originalArtistRank ?? Number.MAX_SAFE_INTEGER;

      const rankB =
        b.originalArtistRank ?? Number.MAX_SAFE_INTEGER;

      return rankA - rankB;
    }

    const yearA =
      a.album.release_year ?? Number.MAX_SAFE_INTEGER;

    const yearB =
      b.album.release_year ?? Number.MAX_SAFE_INTEGER;

    if (yearA !== yearB) {
      return yearA - yearB;
    }

    const monthA = a.album.release_month ?? 0;
    const monthB = b.album.release_month ?? 0;

    if (monthA !== monthB) {
      return monthA - monthB;
    }

    /*
     * Use the custom ranking as a stable tiebreaker when two
     * albums have the same release month and year.
     */
    return (
      (a.originalArtistRank ?? Number.MAX_SAFE_INTEGER) -
      (b.originalArtistRank ?? Number.MAX_SAFE_INTEGER)
    );
  });

  /*
   * AlbumRankingEntry expects a RankingEntry with a position.
   *
   * In best mode, position represents the custom artist ranking.
   * In chronological mode, position represents chronological order.
   */
  const typedRankingEntries = sortedAlbums.map(
    (item, index): {
      entry: RankingEntry;
      originalArtistRank: number | null;
    } => {
      const displayedPosition =
        sortMode === "best"
          ? item.originalArtistRank ?? index + 1
          : index + 1;

      return {
        originalArtistRank: item.originalArtistRank,

        entry: {
          position: displayedPosition,
          albums: item.album,
        },
      };
    }
  );

  return (
    <main className="px-4 py-1">
      <header>
        <h1>{artistData.name}</h1>

        <nav>
          {sortMode === "best" ? (
            <>
              <strong>Best to worst</strong>
              {" | "}
              <Link
                href={`/artists/${artistData.slug}?sort=chronological`}
              >
                Chronological
              </Link>
            </>
          ) : (
            <>
              <Link href={`/artists/${artistData.slug}?sort=best`}>
                Best to worst
              </Link>
              {" | "}
              <strong>Chronological</strong>
            </>
          )}
        </nav>

        {isAdmin ? (
          <>
            <p>Admin mode</p>

            <LogoutButton />

            <p>
              <Link href="/admin/albums/new">
                Add new album to database
              </Link>
            </p>
          </>
        ) : (
          <p>
            <Link
              href="/login"
              className="inline-block border border-black px-1 rounded"
            >
              Sign in
            </Link>
          </p>
        )}
      </header>

      <section>
        {typedRankingEntries.map(
          ({ entry }, index) => (
            <div key={entry.albums.id}>
              <AlbumRankingEntry
                entry={entry}

                /*
                 * Keep this false so AlbumRankingEntry does not
                 * show the Top 50-specific movement controls.
                 */
                isAdmin={false}

                isFirst={index === 0}
                isLast={
                  index === typedRankingEntries.length - 1
                }
              />

              {isAdmin && sortMode === "best" && (
                <div>
                  <form action={moveArtistAlbum}>
                    <input
                      type="hidden"
                      name="artistId"
                      value={artistData.id}
                    />

                    <input
                      type="hidden"
                      name="albumId"
                      value={entry.albums.id}
                    />

                    <input
                      type="hidden"
                      name="slug"
                      value={artistData.slug}
                    />

                    <input
                      type="hidden"
                      name="direction"
                      value="up"
                    />

                    <button
                      type="submit"
                      disabled={index === 0}
                    >
                      Move Up
                    </button>
                  </form>

                  <form action={moveArtistAlbum}>
                    <input
                      type="hidden"
                      name="artistId"
                      value={artistData.id}
                    />

                    <input
                      type="hidden"
                      name="albumId"
                      value={entry.albums.id}
                    />

                    <input
                      type="hidden"
                      name="slug"
                      value={artistData.slug}
                    />

                    <input
                      type="hidden"
                      name="direction"
                      value="down"
                    />

                    <button
                      type="submit"
                      disabled={
                        index === typedRankingEntries.length - 1
                      }
                    >
                      Move Down
                    </button>
                  </form>
                </div>
              )}
            </div>
          )
        )}
      </section>

      {typedRankingEntries.length === 0 && (
        <p>No albums have been added for this artist.</p>
      )}
    </main>
  );
}