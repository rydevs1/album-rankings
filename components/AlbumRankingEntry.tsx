import Link from "next/link";
import Top50AlbumControls from "@/components/admin/Top50AlbumControls";
import type { RankingEntry } from "@/types/album";
import {
  formatAlbumRuntime,
  formatReleaseDate,
  formatTrackRuntime,
} from "@/lib/formatting";

type AlbumRankingEntryProps = {
  entry: RankingEntry;
  isAdmin?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
};

export default function AlbumRankingEntry({
  entry,
  isAdmin = false,
  isFirst = false,
  isLast = false,
}: AlbumRankingEntryProps) {
  const album = entry.albums;

  const sortedArtists = [...album.album_artists].sort(
    (a, b) => a.artist_order - b.artist_order
  );

  const sortedTracks = [...album.tracks].sort(
    (a, b) => a.track_number - b.track_number
  );

  const coverUrl = album.cover_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/album-covers/${album.cover_path}`
    : null;

  return (
    <article className="mb-2">
      <p className="mb-2 text-2xl font-bold">
        {entry.position}.
      </p>

      <div className="flex items-start gap-4">
        {coverUrl && (
          <img
            src={coverUrl}
            alt={`${album.title} album cover`}
            width="170"
            height="170"
            className="shrink-0"
          />
        )}

        {/* Album information */}
        <div className="w-96 shrink-0">
          <h2
            title={album.note ?? undefined}
            className="max-w-96 text-balance text-2xl font-bold leading-tight"
          >
            {album.spotify_url ? (
              <a
                href={album.spotify_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {album.title}
              </a>
            ) : (
              album.title
            )}
          </h2>

          <p className="text-lg">
            {sortedArtists.map((credit, index) => {
              const displayName =
                credit.artist_aliases?.alias_name ??
                credit.artists.name;

              return (
                <span key={credit.artists.id}>
                  {index > 0 && " & "}

                  <Link href={`/artists/${credit.artists.slug}`}>
                    {displayName}
                  </Link>
                </span>
              );
            })}
          </p>

          <p className="text-sm">
            <Link href={`/years/${album.release_year}`}>
              {formatReleaseDate(
                album.release_year,
                album.release_month
              )}
            </Link>

            {" — "}

            {formatAlbumRuntime(album.runtime_minutes)}
          </p>

          <p className="mt-1 text-4xl font-bold">
            {album.grade}
          </p>

          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={album.collected}
              readOnly
            />

            Collected
          </label>
        </div>

        {/* Track list */}
        <div className="ml-1 overflow-x-auto">
          <div
            className="grid min-w-max gap-x-4 gap-y-1"
            style={{
              gridTemplateColumns: `repeat(${sortedTracks.length}, 80px)`,
            }}
          >
            {/* Row 1: track numbers */}
            {sortedTracks.map((track) => (
              <div
                key={`number-${track.id}`}
                className="relative text-center text-sm text-gray-500"
              >
                {track.track_number}

                {track.starts_new_side &&
                  track.track_number !== 1 && (
                    <span className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-500">
                      |
                    </span>
                  )}
              </div>
            ))}

            {/* Row 2: track titles */}
            {sortedTracks.map((track) => (
              <div
                key={`title-${track.id}`}
                className="flex h-[4.2rem] items-center justify-center px-1 text-center text-sm leading-4"
              >
                <span
                  title={track.note ?? undefined}
                  className="text-balance"
                >
                  {track.title}
                </span>
              </div>
            ))}

            {/* Row 3: track grades */}
            {sortedTracks.map((track) => (
              <div
                key={`grade-${track.id}`}
                className="text-center text-lg font-bold leading-none"
              >
                {track.grade}
              </div>
            ))}

            {/* Row 4: track runtimes */}
            {sortedTracks.map((track) => (
              <div
                key={`runtime-${track.id}`}
                className="mt-1 text-center text-sm"
              >
                {formatTrackRuntime(track.runtime_seconds)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {isAdmin && (
        <Top50AlbumControls
          albumId={album.id}
          isFirst={isFirst}
          isLast={isLast}
        />
      )}
    </article>
  );
}