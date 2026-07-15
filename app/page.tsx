import AlbumRankingEntry from "@/components/AlbumRankingEntry";
import { albums } from "@/data/albums";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <header className="mb-10">
        <h1 className="text-4xl font-bold">Top 50 Albums</h1>

        <p className="mt-2 text-neutral-400">
          My current top albums of all time.
        </p>
      </header>

      {albums.map((album) => (
        <AlbumRankingEntry key={album.title} album={album} />
      ))}
    </main>
  );
}