import Image from "next/image";
import type { Album } from "@/data/albums";

type AlbumRankingEntryProps = {
  album: Album;
};

export default function AlbumRankingEntry({
  album,
}: AlbumRankingEntryProps) {
  return (
    <article className="max-w-4xl border-t border-neutral-700 py-8">
      <div className="flex gap-6">
        <div className="text-3xl font-bold text-neutral-500">
          {album.rank}
        </div>

        <Image
          src={album.cover}
          alt={`${album.title} album cover`}
          width={180}
          height={180}
          className="h-[180px] w-[180px] object-cover"
        />

        <div className="flex-1">
          <h2 title={album.notes} className="text-2xl font-bold">
            {album.title}
          </h2>

          <p className="mt-1 text-neutral-400">
            {album.artist} · {album.year} · {album.runtime} · {album.grade}
          </p>

          <ol className="mt-5 space-y-2">
            {album.tracks.map((track, index) => (
              <li
                key={track.title}
                title={track.notes}
                className="flex justify-between"
              >
                <span>
                  {index + 1}. {track.title}
                </span>

                <span>
                  {track.grade} · {track.runtime}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </article>
  );
}