export type Track = {
  title: string;
  grade: string;
  runtime: string;
  notes?: string;
};

export type Album = {
  rank: number;
  title: string;
  artist: string;
  year: number;
  runtime: string;
  grade: string;
  cover: string;
  notes?: string;
  tracks: Track[];
};

export const albums: Album[] = [
  {
    rank: 1,
    title: "Visions Of The Emerald Beyond",
    artist: "Mahavishnu Orchestra",
    year: 1975,
    runtime: "40 min",
    grade: "A+",
    cover: "/covers/visions-of-the-emerald-beyond.jpg",
    tracks: [
      {
        title: "Eternity's Breath - Part 1",
        grade: "A-",
        runtime: "3:10",
      },
      {
        title: "Eternity's Breath - Part 2",
        grade: "A-",
        runtime: "4:52",
      },
      {
        title: "Lila's Dance",
        grade: "B+",
        runtime: "5:37",
      },
      {
        title: "Can't Stand Your Funk",
        grade: "B-",
        runtime: "2:09",
      },
      {
        title: "Pastoral",
        grade: "B-",
        runtime: "3:41",
      },
      {
        title: "Faith",
        grade: "B",
        runtime: "2:00",
      },
      {
        title: "Cosmic Strut",
        grade: "B+",
        runtime: "3:28",
      },
      {
        title: "If I Could See",
        grade: "B+",
        runtime: "1:17",
      },
      {
        title: "Be Happy",
        grade: "B+",
        runtime: "3:32",
      },
      {
        title: "Earth Ship",
        grade: "B-",
        runtime: "3:42",
      },
      {
        title: "Pegasus",
        grade: "+",
        runtime: "1:50",
      },
      {
        title: "Opus 1",
        grade: "+",
        runtime: "0:22",
      },
      {
        title: "On The Way Home To Earth",
        grade: "B+",
        runtime: "4:45",
      },
    ],
  },
  {
    rank: 2,
    title: "Close to the Edge",
    artist: "Yes",
    year: 1972,
    runtime: "38 min",
    grade: "A+",
    cover: "/covers/close-to-the-edge.webp",
    tracks: [
      {
        title: "Close to the Edge",
        grade: "A+",
        runtime: "18:38",
      },
      {
        title: "And You and I",
        grade: "B+",
        runtime: "10:12",
      },
      {
        title: "Siberian Khatru",
        grade: "B+",
        runtime: "8:56",
      },
    ],
  },
];