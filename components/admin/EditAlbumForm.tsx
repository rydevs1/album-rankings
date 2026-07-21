"use client";

import {
  useActionState,
  useState,
  type ChangeEvent,
} from "react";
import {
  updateAlbum,
  type EditAlbumState,
} from "@/app/admin/albums/[id]/edit/actions";
import { formatTrackRuntime } from "@/lib/formatting";

type EditTrack = {
  temporaryId: string;
  title: string;
  runtime: string;
  grade: string;
  note: string;
  startsNewSide: boolean;
};

type EditAlbumFormProps = {
  album: {
    id: number;
    title: string;
    release_year: number;
    release_month: number;
    runtime_minutes: number;
    grade: string;
    collected: boolean;
    note: string | null;
    spotify_url: string | null;
    cover_path: string | null;

    album_artists: Array<{
      artist_order: number;
      artist_rank: number;

      artists: {
        id: number;
        name: string;
      };

      artist_aliases: {
        id: number;
        alias_name: string;
      } | null;
    }>;

    tracks: Array<{
      id: number;
      title: string;
      track_number: number;
      runtime_seconds: number;
      grade: string;
      note: string | null;
      starts_new_side: boolean;
    }>;
  };
};

const initialState: EditAlbumState = {
  error: null,
};

function createEmptyTrack(): EditTrack {
  return {
    temporaryId: crypto.randomUUID(),
    title: "",
    runtime: "",
    grade: "",
    note: "",
    startsNewSide: false,
  };
}

export default function EditAlbumForm({
  album,
}: EditAlbumFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateAlbum,
    initialState
  );

  const sortedCredits = [...album.album_artists].sort(
    (a, b) => a.artist_order - b.artist_order
  );

  const firstCredit = sortedCredits[0];

  const sortedAlbumTracks = [...album.tracks].sort(
    (a, b) => a.track_number - b.track_number
  );

  const [tracks, setTracks] = useState<EditTrack[]>(
    sortedAlbumTracks.length > 0
      ? sortedAlbumTracks.map((track) => ({
          temporaryId: String(track.id),
          title: track.title,
          runtime: formatTrackRuntime(
            track.runtime_seconds
          ),
          grade: track.grade,
          note: track.note ?? "",
          startsNewSide: track.starts_new_side,
        }))
      : [createEmptyTrack()]
  );

  const existingCoverUrl = album.cover_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/album-covers/${album.cover_path}`
    : null;

  const [coverPreview, setCoverPreview] = useState<
    string | null
  >(existingCoverUrl);

  function updateTrack(
    temporaryId: string,
    field: keyof EditTrack,
    value: string | boolean
  ) {
    setTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.temporaryId === temporaryId
          ? {
              ...track,
              [field]: value,
            }
          : track
      )
    );
  }

  function addTrack() {
    setTracks((currentTracks) => [
      ...currentTracks,
      createEmptyTrack(),
    ]);
  }

  function removeTrack(temporaryId: string) {
    setTracks((currentTracks) => {
      if (currentTracks.length === 1) {
        return currentTracks;
      }

      return currentTracks.filter(
        (track) =>
          track.temporaryId !== temporaryId
      );
    });
  }

  function moveTrack(
    index: number,
    direction: -1 | 1
  ) {
    const destination = index + direction;

    if (
      destination < 0 ||
      destination >= tracks.length
    ) {
      return;
    }

    setTracks((currentTracks) => {
      const updatedTracks = [...currentTracks];

      [
        updatedTracks[index],
        updatedTracks[destination],
      ] = [
        updatedTracks[destination],
        updatedTracks[index],
      ];

      return updatedTracks;
    });
  }

  function handleCoverChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      setCoverPreview(existingCoverUrl);
      return;
    }

    setCoverPreview(URL.createObjectURL(file));
  }

  return (
    <form
      action={formAction}
      className="px-6 py-4"
    >
      <input
        type="hidden"
        name="albumId"
        value={album.id}
      />

      <input
        type="hidden"
        name="currentCoverPath"
        value={album.cover_path ?? ""}
      />

      <input
        type="hidden"
        name="tracks"
        value={JSON.stringify(
          tracks.map(
            ({ temporaryId, ...track }) => track
          )
        )}
      />

      {state.error && (
        <p className="mb-4 font-bold">
          {state.error}
        </p>
      )}

      <h1 className="mb-4 text-3xl font-bold">
        Edit album
      </h1>

      <div className="flex items-start gap-6 overflow-x-auto">
        {/* Album cover */}
        <div className="w-[200px] shrink-0">
          <div className="flex h-[200px] w-[200px] items-center justify-center border">
            {coverPreview ? (
              <img
                src={coverPreview}
                alt={`${album.title} album cover preview`}
                width={200}
                height={200}
                className="h-[200px] w-[200px] object-cover"
              />
            ) : (
              <span className="px-4 text-center text-sm">
                No album cover
              </span>
            )}
          </div>

          <label
            htmlFor="cover"
            className="mt-2 block text-sm font-bold"
          >
            Replace album cover
          </label>

          <input
            id="cover"
            name="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleCoverChange}
            className="mt-1 block w-full text-sm"
          />
        </div>

        {/* Album information */}
        <div className="w-80 shrink-0">
          <label
            htmlFor="title"
            className="block text-sm font-bold"
          >
            Album title
          </label>

          <input
            id="title"
            name="title"
            defaultValue={album.title}
            required
            className="mb-2 w-full border px-2 py-1 text-2xl font-bold"
          />

          <label
            htmlFor="artistName"
            className="block text-sm font-bold"
          >
            Canonical artist
          </label>

          <div className="mb-2 flex gap-1">
            <input
              id="artistName"
              name="artistName"
              list="artistSuggestions"
              autoComplete="off"
              defaultValue={
                firstCredit?.artists.name ?? ""
              }
              required
              className="min-w-0 flex-1 border px-2 py-1 text-lg"
            />

            <ArtistSuggestions />
          </div>

          <label
            htmlFor="displayArtistName"
            className="block text-sm font-bold"
          >
            Displayed artist or alias
          </label>

          <input
            id="displayArtistName"
            name="displayArtistName"
            defaultValue={
              firstCredit?.artist_aliases
                ?.alias_name ?? ""
            }
            placeholder="The Mothers of Invention"
            className="mb-2 w-full border px-2 py-1"
          />

          <div className="mb-2 flex items-end gap-2">
            <div>
              <label
                htmlFor="releaseMonth"
                className="block text-sm font-bold"
              >
                Month
              </label>

              <input
                id="releaseMonth"
                name="releaseMonth"
                type="number"
                min="1"
                max="12"
                defaultValue={album.release_month}
                required
                className="w-20 border px-2 py-1"
              />
            </div>

            <span className="pb-1">—</span>

            <div>
              <label
                htmlFor="releaseYear"
                className="block text-sm font-bold"
              >
                Year
              </label>

              <input
                id="releaseYear"
                name="releaseYear"
                type="number"
                min="1800"
                max="2200"
                defaultValue={album.release_year}
                required
                className="w-24 border px-2 py-1"
              />
            </div>

            <span className="pb-1">—</span>

            <div>
              <label
                htmlFor="runtimeMinutes"
                className="block text-sm font-bold"
              >
                Minutes
              </label>

              <input
                id="runtimeMinutes"
                name="runtimeMinutes"
                type="number"
                min="1"
                defaultValue={album.runtime_minutes}
                required
                className="w-20 border px-2 py-1"
              />
            </div>
          </div>

          <label
            htmlFor="grade"
            className="block text-sm font-bold"
          >
            Album grade
          </label>

          <input
            id="grade"
            name="grade"
            defaultValue={album.grade}
            required
            className="mb-2 w-24 border px-2 py-1 text-center text-4xl font-bold"
          />

          <label className="mb-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="collected"
              defaultChecked={album.collected}
            />

            Collected on vinyl
          </label>

          <label
            htmlFor="note"
            className="block text-sm font-bold"
          >
            Album hover note
          </label>

          <textarea
            id="note"
            name="note"
            defaultValue={album.note ?? ""}
            rows={3}
            className="mb-2 w-full border px-2 py-1"
          />

          <label
            htmlFor="spotifyUrl"
            className="block text-sm font-bold"
          >
            Spotify URL
          </label>

          <input
            id="spotifyUrl"
            name="spotifyUrl"
            type="url"
            defaultValue={album.spotify_url ?? ""}
            className="w-full border px-2 py-1"
          />
        </div>

        {/* Track grid */}
        <TrackInputGrid
          tracks={tracks}
          updateTrack={updateTrack}
          moveTrack={moveTrack}
          removeTrack={removeTrack}
          addTrack={addTrack}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 border px-4 py-2 font-bold"
      >
        {isPending
          ? "Saving..."
          : "Save changes"}
      </button>
    </form>
  );
}

type TrackInputGridProps = {
  tracks: EditTrack[];

  updateTrack: (
    temporaryId: string,
    field: keyof EditTrack,
    value: string | boolean
  ) => void;

  moveTrack: (
    index: number,
    direction: -1 | 1
  ) => void;

  removeTrack: (
    temporaryId: string
  ) => void;

  addTrack: () => void;
};

function TrackInputGrid({
  tracks,
  updateTrack,
  moveTrack,
  removeTrack,
  addTrack,
}: TrackInputGridProps) {
  return (
    <div className="flex shrink-0 items-start gap-3">
      <div
        className="grid min-w-max gap-x-2 gap-y-1"
        style={{
          gridTemplateColumns: `repeat(${tracks.length}, 90px)`,
        }}
      >
        {/* Side breaks and track numbers */}
        {tracks.map((track, index) => (
          <div
            key={`number-${track.temporaryId}`}
            className="relative flex h-8 items-center justify-center text-sm"
          >
            {index > 0 && (
              <label
                className="absolute left-0 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
                title={`Start a new album side before track ${
                  index + 1
                }`}
              >
                <input
                  type="checkbox"
                  checked={track.startsNewSide}
                  onChange={(event) =>
                    updateTrack(
                      track.temporaryId,
                      "startsNewSide",
                      event.target.checked
                    )
                  }
                />
              </label>
            )}

            <span className="text-gray-500">
              {index + 1}
            </span>
          </div>
        ))}

        {/* Track titles */}
        {tracks.map((track) => (
          <textarea
            key={`title-${track.temporaryId}`}
            value={track.title}
            onChange={(event) =>
              updateTrack(
                track.temporaryId,
                "title",
                event.target.value
              )
            }
            placeholder="Track title"
            required
            rows={3}
            className="h-[4.5rem] w-[90px] resize-none border px-1 py-1 text-center text-sm leading-4"
          />
        ))}

        {/* Grades */}
        {tracks.map((track) => (
          <input
            key={`grade-${track.temporaryId}`}
            value={track.grade}
            onChange={(event) =>
              updateTrack(
                track.temporaryId,
                "grade",
                event.target.value
              )
            }
            placeholder="A"
            required
            className="w-[90px] border px-1 py-1 text-center text-xl font-bold"
          />
        ))}

        {/* Runtimes */}
        {tracks.map((track) => (
          <input
            key={`runtime-${track.temporaryId}`}
            value={track.runtime}
            onChange={(event) =>
              updateTrack(
                track.temporaryId,
                "runtime",
                event.target.value
              )
            }
            placeholder="3:10"
            pattern="[0-9]+:[0-5][0-9]"
            required
            className="w-[90px] border px-1 py-1 text-center text-sm"
          />
        ))}

        {/* Notes */}
        {tracks.map((track) => (
          <textarea
            key={`note-${track.temporaryId}`}
            value={track.note}
            onChange={(event) =>
              updateTrack(
                track.temporaryId,
                "note",
                event.target.value
              )
            }
            placeholder="Hover note"
            rows={3}
            className="h-[4.5rem] w-[90px] resize-none border px-1 py-1 text-sm"
          />
        ))}

        {/* Track controls */}
        {tracks.map((track, index) => (
          <div
            key={`controls-${track.temporaryId}`}
            className="flex w-[90px] flex-col gap-1"
          >
            <div className="flex justify-center gap-1">
              <button
                type="button"
                onClick={() =>
                  moveTrack(index, -1)
                }
                disabled={index === 0}
                className="border px-2"
                title="Move track left"
              >
                ←
              </button>

              <button
                type="button"
                onClick={() =>
                  moveTrack(index, 1)
                }
                disabled={
                  index === tracks.length - 1
                }
                className="border px-2"
                title="Move track right"
              >
                →
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                removeTrack(
                  track.temporaryId
                )
              }
              disabled={tracks.length === 1}
              className="border px-1 text-sm"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Add-track button stays at far right */}
      <button
        type="button"
        onClick={addTrack}
        className="mt-8 h-[4.5rem] w-24 shrink-0 border px-2 font-bold"
      >
        + Add track
      </button>
    </div>
  );
}

function ArtistSuggestions() {
  const [artists, setArtists] = useState<
    Array<{
      id: number;
      name: string;
    }>
  >([]);

  async function loadArtists() {
    if (artists.length > 0) {
      return;
    }

    const response = await fetch(
      "/api/artists"
    );

    if (!response.ok) {
      return;
    }

    const result = (await response.json()) as {
      artists: Array<{
        id: number;
        name: string;
      }>;
    };

    setArtists(result.artists);
  }

  return (
    <>
      <button
        type="button"
        onClick={loadArtists}
        className="shrink-0 border px-2 text-sm"
      >
        Load
      </button>

      <datalist id="artistSuggestions">
        {artists.map((artist) => (
          <option
            key={artist.id}
            value={artist.name}
          />
        ))}
      </datalist>
    </>
  );
}