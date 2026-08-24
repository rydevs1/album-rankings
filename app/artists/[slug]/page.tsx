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
  const direction = String(formData.get("direction"));
  const slug = String(formData.get("slug"));

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user?.email === "rydevs1@gmail.com";

  if (!isAdmin) {
    return;
  }

  // Get all albums for this artist in current best-to-worst order
  const { data: rankings, error: rankingError } = await supabase
    .from("album_artists")
    .select(`
      album_id,
      artist_rank
    `)
    .eq("artist_id", artistId)
    .order("artist_rank", { ascending: true });

  if (rankingError) {
    console.error("Ranking fetch error:", rankingError);
    return;
  }

  if (!rankings) {
    return;
  }

  const currentIndex = rankings.findIndex(
    (entry) => entry.album_id === albumId
  );

  if (currentIndex === -1) {
    console.error("Album not found in artist rankings.");
    return;
  }

  const targetIndex =
    direction === "up"
      ? currentIndex - 1
      : currentIndex + 1;

  // Don't move past the beginning or end
  if (
    targetIndex < 0 ||
    targetIndex >= rankings.length
  ) {
    return;
  }

  const currentAlbum = rankings[currentIndex];
  const targetAlbum = rankings[targetIndex];

  const currentRank = currentAlbum.artist_rank;
  const targetRank = targetAlbum.artist_rank;

  if (currentRank == null || targetRank == null) {
    console.error("One or more artist_rank values are null.");
    return;
  }

  /*
   * Give the current album a temporary rank first.
   * This avoids problems if you have a UNIQUE constraint on:
   *
   * artist_id + artist_rank
   */
  const temporaryRank = 999999;

  const { error: tempError } = await supabase
    .from("album_artists")
    .update({
      artist_rank: temporaryRank,
    })
    .eq("artist_id", artistId)
    .eq("album_id", currentAlbum.album_id);

  if (tempError) {
    console.error("Temporary rank error:", tempError);
    return;
  }

  // Move the neighboring album into the current album's old position
  const { error: targetError } = await supabase
    .from("album_artists")
    .update({
      artist_rank: currentRank,
    })
    .eq("artist_id", artistId)
    .eq("album_id", targetAlbum.album_id);

  if (targetError) {
    console.error("Target album move error:", targetError);
    return;
  }

  // Move the selected album into its new position
  const { error: currentError } = await supabase
    .from("album_artists")
    .update({
      artist_rank: targetRank,
    })
    .eq("artist_id", artistId)
    .eq("album_id", currentAlbum.album_id);

  if (currentError) {
    console.error("Current album move error:", currentError);
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