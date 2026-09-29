import { createClient } from "@/lib/supabase/server";
import AlbumRankingEntry from "@/components/AlbumRankingEntry";
import type { RankingEntry } from "@/types/album";
import { notFound } from "next/navigation";

type AlbumPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function formatRuntime(seconds: number | null) {
  if (seconds == null) {
    return "";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

export default async function AlbumPage({
  params,
}: AlbumPageProps) {
  const { slug } = await params;

  const supabase = await createClient();

  const { data: albumData, error } = await supabase
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
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return (
      <main>
        <h1>Database error</h1>
        <pre>{error.message}</pre>
      </main>
    );
  }

  if (!albumData) {
    notFound();
  }

  const normalizedAlbum = {
    ...albumData,

    album_artists: (albumData.album_artists ?? []).flatMap(
      (credit) => {
        const artist = Array.isArray(credit.artists)
          ? credit.artists[0]
          : credit.artists;

        if (!artist) {
          return [];
        }

        const alias = Array.isArray(credit.artist_aliases)
          ? credit.artist_aliases[0] ?? null
          : credit.artist_aliases ?? null;

        return [
          {
            artist_order: credit.artist_order,
            artist_rank: credit.artist_rank,
            artists: artist,
            artist_aliases: alias,
          },
        ];
      }
    ),

    tracks: [...(albumData.tracks ?? [])].sort(
      (a, b) => a.track_number - b.track_number
    ),
  };

  /*
   * AlbumRankingEntry expects a RankingEntry.
   *
   * Since this page isn't actually a ranking list,
   * position is just set to 1.
   */
  const albumEntry: RankingEntry = {
    position: 0,
    albums: normalizedAlbum,
  };

  return (
    <main className="px-4 pt-8 py-1">
      {/* Album summary */}
      <section>
        <AlbumRankingEntry
          entry={albumEntry}
          isAdmin={false}
          isFirst={true}
          isLast={true}
        />
      </section>

      {/* Album blurb */}
      <section className="min-h-[5rem] max-w-4xl py-6">
        {normalizedAlbum.note && (
          <p className="whitespace-pre-wrap">
            {normalizedAlbum.note}
          </p>
        )}
      </section>

      {/* Track-by-track section */}
      <section>
        {normalizedAlbum.tracks.map((track) => (
          <div key={track.id} className="mb-8">
            <div className="grid max-w-4xl grid-cols-[4rem_minmax(0,42rem)_6rem] items-baseline">
              {/* Track number */}
              <div className="text-3xl font-bold">
                {track.track_number}.
              </div>

              {/* Track title and runtime */}
              <div className="text-xl font-semibold">
                {track.title}

                {track.runtime_seconds != null && (
                  <span className="ml-2 text-sm font-normal">
                    -- {formatRuntime(track.runtime_seconds)}
                  </span>
                )}
              </div>

              {/* Grade */}
              <div className="text-3xl font-bold">
                {track.grade}
              </div>
            </div>

            {/* Track blurb */}
            <div className="ml-16 min-h-[4rem] max-w-3xl pt-2">
              {track.note && (
                <p className="whitespace-pre-wrap">
                  {track.note}
                </p>
              )}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}