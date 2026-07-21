import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditAlbumForm from "@/components/admin/EditAlbumForm";

type EditAlbumPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditAlbumPage({
  params,
}: EditAlbumPageProps) {
  const { id } = await params;
  const albumId = Number(id);

  if (!Number.isInteger(albumId)) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== "rydevs1@gmail.com") {
    redirect("/login");
  }

  const { data: album, error } = await supabase
    .from("albums")
    .select(`
      id,
      title,
      release_year,
      release_month,
      runtime_minutes,
      grade,
      collected,
      note,
      spotify_url,
      cover_path,
      album_artists (
        artist_order,
        artist_rank,
        artists (
          id,
          name
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
    .eq("id", albumId)
    .single();

  if (error || !album) {
    notFound();
  }

  album.album_artists.sort(
    (a, b) => a.artist_order - b.artist_order
  );

  album.tracks.sort(
    (a, b) => a.track_number - b.track_number
  );

  const normalizedAlbum = {
  ...album,
  album_artists: (album.album_artists ?? []).flatMap((credit) => {
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
        ...credit,
        artists: artist,
        artist_aliases: alias,
      },
    ];
  }),
  tracks: album.tracks ?? [],
};

  return (
    <main>
      <h1>Edit album</h1>

      <EditAlbumForm album={normalizedAlbum} />
    </main>
  );
}