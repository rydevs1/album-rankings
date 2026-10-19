
import { createClient } from "@/lib/supabase/server";
import AlbumRankingEntry from "@/components/AlbumRankingEntry";
import type { RankingEntry } from "@/types/album";
import Link from "next/link";
import LogoutButton from "@/components/admin/LogoutButton";
import { notFound } from "next/navigation";

type YearPageProps = {
  params: Promise<{
    slug: string;
  }>;

  searchParams: Promise<{
    sort?: string;
  }>;
};

type SortMode = "best" | "chronological";

/*
 * Grade order from highest to lowest.
 *
 * Any unrecognized or missing grade will be placed
 * below the listed grades.
 */
const gradeOrder = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
];

function getGradeRank(grade: string | null | undefined) {
  const index = gradeOrder.indexOf(grade ?? "");

  return index === -1
    ? Number.MAX_SAFE_INTEGER
    : index;
}

/*
 * Compare two Top 50 positions.
 *
 * Albums without a Top 50 position are placed last.
 */
function compareTop50Rank(
  rankA: number | null,
  rankB: number | null
) {
  return (
    (rankA ?? Number.MAX_SAFE_INTEGER) -
    (rankB ?? Number.MAX_SAFE_INTEGER)
  );
}

export default async function YearPage({
  params,
  searchParams,
}: YearPageProps) {
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
   * The year slug is the year itself.
   *
   * Example:
   * /years/1973
   */
  const year = Number(slug);

  if (
    !/^\d{4}$/.test(slug) ||
    !Number.isInteger(year)
  ) {
    notFound();
  }

  /*
   * Find every album released in this year.
   *
   * album_list_entries contains the album's
   * position on the Top 50, if applicable.
   *
   * album_artists contains all displayed artist
   * credits, exactly like the artist page.
   */
  const { data: yearAlbums, error: albumsError } =
    await supabase
      .from("albums")
      .select(`
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
        album_list_entries (
          position
        ),
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
      `)
      .eq("release_year", year);

  if (albumsError) {
    return (
      <main>
        <h1>Database error</h1>
        <pre>{albumsError.message}</pre>
      </main>
    );
  }

  /*
   * Normalize Supabase's nested relationship results
   * in the same way as your artist page.
   *
   * Keep the original Top 50 ranking separately
   * because position will be recalculated based
   * on the selected sorting mode.
   */
  const normalizedAlbums = (yearAlbums ?? []).map(
    (album) => {
      const top50Entries = album.album_list_entries ?? [];

      const top50Ranks = top50Entries
        .map((entry) => entry.position)
        .filter(
          (position): position is number =>
            position != null && position > 0
        );

      const top50Rank =
        top50Ranks.length > 0
          ? Math.min(...top50Ranks)
          : null;

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

      return {
        top50Rank,
        album: normalizedAlbum,
      };
    }
  );

  /*
   * Sort the albums.
   *
   * BEST TO WORST:
   * 1. Top 50 ranking
   * 2. Album grade
   * 3. Earliest release date
   *
   * CHRONOLOGICAL:
   * 1. Earliest release date
   * 2. Top 50 ranking
   * 3. Album grade
   */
  const sortedAlbums = [...normalizedAlbums].sort((a, b) => {
    const rankComparison = compareTop50Rank(
      a.top50Rank,
      b.top50Rank
    );

    const gradeComparison =
      getGradeRank(a.album.grade) -
      getGradeRank(b.album.grade);

    const monthA =
      a.album.release_month ?? 13;

    const monthB =
      b.album.release_month ?? 13;

    const dateComparison = monthA - monthB;

    if (sortMode === "best") {
      /*
       * First prioritize albums in the Top 50.
       * If both albums are unranked, compare grade.
       */
      if (rankComparison !== 0) {
        return rankComparison;
      }

      if (gradeComparison !== 0) {
        return gradeComparison;
      }

      return dateComparison;
    }

    /*
     * Chronological sorting.
     *
     * Since all albums belong to the same year,
     * comparing release months is sufficient.
     */
    if (dateComparison !== 0) {
      return dateComparison;
    }

    if (rankComparison !== 0) {
      return rankComparison;
    }

    return gradeComparison;
  });

  /*
   * AlbumRankingEntry expects a RankingEntry
   * with a position.
   *
   * The displayed position is the album's
   * placement within the selected year sorting.
   *
   * In best mode: best-to-worst order.
   * In chronological mode: chronological order.
   */
  const typedRankingEntries = sortedAlbums.map(
    (item, index): {
      entry: RankingEntry;
      top50Rank: number | null;
    } => {
      return {
        top50Rank: item.top50Rank,

        entry: {
          position: index + 1,
          albums: item.album,
        },
      };
    }
  );

  return (
    <main className="px-4 py-1">
      <header>
        <h1>{year}</h1>

        <nav>
          {sortMode === "best" ? (
            <>
              <strong>Best to worst</strong>
              {" | "}
              <Link
                href={`/years/${slug}?sort=chronological`}
              >
                Chronological
              </Link>
            </>
          ) : (
            <>
              <Link href={`/years/${slug}?sort=best`}>
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
                 * Keep false so AlbumRankingEntry
                 * does not show the Top 50-specific
                 * movement controls.
                 */
                isAdmin={false}

                isFirst={index === 0}
                isLast={
                  index === typedRankingEntries.length - 1
                }
              />
            </div>
          )
        )}
      </section>

      {typedRankingEntries.length === 0 && (
        <p>No albums have been added for {year}.</p>
      )}
    </main>
  );
}
