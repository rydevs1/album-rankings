import { createClient } from "@/lib/supabase/server";
import AlbumRankingEntry from "@/components/AlbumRankingEntry";
import type { RankingEntry } from "@/types/album";
import Link from "next/link";
import LogoutButton from "@/components/admin/LogoutButton";
import AddAlbumToTop50 from "@/components/admin/AddAlbumToTop50";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user?.email === "rydevs1@gmail.com";

  const { data: rankingEntries, error } = await supabase
    .from("album_list_entries")
    .select(`
      position,
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
      ),
      album_lists!inner (
        slug
      )
    `)
    .eq("album_lists.slug", "top-50")
    .order("position", { ascending: true });

  if (error) {
    return (
      <main>
        <h1>Database error</h1>
        <pre>{error.message}</pre>
      </main>
    );
  }

  const typedRankingEntries: RankingEntry[] = (rankingEntries ?? []).map(
    (entry) => {
      const album = entry.albums[0];

      return {
        position: entry.position,
        albums: {
          ...album,
          album_artists: album.album_artists.map((credit) => ({
            ...credit,
            artists: credit.artists[0],
            artist_aliases: credit.artist_aliases[0] ?? null,
          })),
          tracks: album.tracks,
        },
      };
    }
  );

  let availableAlbums: Array<{
    id: number;
    title: string;
    artistName: string;
  }> = [];

  if (isAdmin) {
    const top50AlbumIds = new Set(
      typedRankingEntries.map((entry) => entry.albums.id)
    );

    const { data: databaseAlbums, error: albumsError } =
      await supabase
        .from("albums")
        .select(`
          id,
          title,
          album_artists (
            artist_order,
            artists (
              name
            ),
            artist_aliases (
              alias_name
            )
          )
        `)
        .order("title", { ascending: true });

    if (albumsError) {
      return (
        <main>
          <h1>Database error</h1>
          <pre>{albumsError.message}</pre>
        </main>
      );
    }

    availableAlbums = (databaseAlbums ?? [])
      .filter((album) => !top50AlbumIds.has(album.id))
      .map((album) => {
        const credits = [...album.album_artists].sort(
          (a, b) => a.artist_order - b.artist_order
        );

        const artistName = credits
          .map(
            (credit) =>
              credit.artist_aliases?.[0]?.alias_name ??
              credit.artists[0]?.name
          )
          .join(" & ");

        return {
          id: album.id,
          title: album.title,
          artistName,
        };
      });
  }

  return (
    <main className="px-4 py-1">
      <header>
        <h1>Ryan's Top Albums</h1>

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
        {typedRankingEntries.map((entry, index) => (
          <AlbumRankingEntry
            key={entry.albums.id}
            entry={entry}
            isAdmin={isAdmin}
            isFirst={index === 0}
            isLast={index === typedRankingEntries.length - 1}
          />
        ))}
      </section>

      {isAdmin && (
        <AddAlbumToTop50 albums={availableAlbums} />
      )}
    </main>
  );
}