export type Track = {
  id: number;
  title: string;
  track_number: number;
  runtime_seconds: number;
  grade: string;
  note: string | null;
  starts_new_side: boolean;
};

export type ArtistCredit = {
  artist_order: number;
  artist_rank: number;
  artists: {
    id: number;
    name: string;
    slug: string;
  };
  artist_aliases: {
    id: number;
    alias_name: string;
  } | null;
};

export type Album = {
  id: number;
  title: string;
  slug: string;
  release_year: number;
  release_month: number;
  runtime_minutes: number;
  grade: string;
  collected: boolean;
  note: string | null;
  cover_path: string | null;
  spotify_url: string | null;
  album_artists: ArtistCredit[];
  tracks: Track[];
};

export type RankingEntry = {
  position: number;
  albums: Album;
};