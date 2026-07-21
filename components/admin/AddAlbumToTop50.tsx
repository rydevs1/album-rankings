"use client";

import { useState } from "react";
import { addAlbumToTop50 } from "@/app/admin/top-50/actions";

type AlbumOption = {
  id: number;
  title: string;
  artistName: string;
};

type AddAlbumToTop50Props = {
  albums: AlbumOption[];
};

export default function AddAlbumToTop50({
  albums,
}: AddAlbumToTop50Props) {
  const [searchValue, setSearchValue] = useState("");

  const selectedAlbum = albums.find(
    (album) =>
      `${album.title} — ${album.artistName}` === searchValue
  );

  return (
    <section>
      <h2>Add album to Top 50</h2>

      {albums.length === 0 ? (
        <p>Every album is already in the Top 50.</p>
      ) : (
        <form action={addAlbumToTop50}>
          <label htmlFor="top50AlbumSearch">
            Search albums
          </label>

          <br />

          <input
            id="top50AlbumSearch"
            list="top50AlbumOptions"
            value={searchValue}
            onChange={(event) =>
              setSearchValue(event.target.value)
            }
            placeholder="Type an album or artist"
            autoComplete="off"
          />

          <datalist id="top50AlbumOptions">
            {albums.map((album) => (
              <option
                key={album.id}
                value={`${album.title} — ${album.artistName}`}
              />
            ))}
          </datalist>

          <input
            type="hidden"
            name="albumId"
            value={selectedAlbum?.id ?? ""}
          />

          <button
            type="submit"
            disabled={!selectedAlbum}
          >
            Add to bottom of Top 50
          </button>
        </form>
      )}
    </section>
  );
}