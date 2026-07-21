import Link from "next/link";
import {
  moveTop50AlbumDown,
  moveTop50AlbumUp,
  removeAlbumFromTop50,
} from "@/app/admin/top-50/actions";

type Top50AlbumControlsProps = {
  albumId: number;
  isFirst: boolean;
  isLast: boolean;
};

export default function Top50AlbumControls({
  albumId,
  isFirst,
  isLast,
}: Top50AlbumControlsProps) {
  const moveUp = moveTop50AlbumUp.bind(null, albumId);
  const moveDown = moveTop50AlbumDown.bind(null, albumId);
  const remove = removeAlbumFromTop50.bind(null, albumId);

  return (
    <div>
      <Link href={`/admin/albums/${albumId}/edit`}>
        Edit
      </Link>

      <form action={moveUp}>
        <button type="submit" disabled={isFirst}>
          Move up
        </button>
      </form>

      <form action={moveDown}>
        <button type="submit" disabled={isLast}>
          Move down
        </button>
      </form>

      <form action={remove}>
        <button type="submit">
          Remove from Top 50
        </button>
      </form>
    </div>
  );
}