/**
 * Photography, in one place.
 *
 * Two reasons this is a module and not a URL typed into each page. First,
 * swapping the art direction of the whole product should be one edit. Second,
 * every image here is served through a sizing pipeline - a hero shipped at its
 * native 4000px costs a farmer real money on a metered connection, and the
 * `w`/`q` parameters below are the difference between a 90 KB header and a
 * 2 MB one.
 *
 * Each photo is deliberately of this crop system - transplanted paddy, wheat
 * at ear, seedbeds on the Gangetic plain - not generic agri-stock. And each
 * carries a `tone` so the panel behind it can be painted the same colour,
 * which means a slow or failed image load degrades to a considered block of
 * colour rather than a white hole in the layout.
 */

type Photo = {
  id: string;
  alt: string;
  /** Average colour, used as the placeholder behind the image. */
  tone: string;
};

const UNSPLASH = "https://images.unsplash.com";

const PHOTOS = {
  /** A farmer puddling a paddy field with a tractor, bullocks alongside. */
  paddyFarmer: {
    id: "photo-1574943320219-553eb213f72d",
    alt: "A farmer preparing a flooded paddy field for transplanting",
    tone: "#2f4a2a",
  },
  /** Wheat at ear, shallow depth of field. */
  wheatEars: {
    id: "photo-1577283640779-66bb84010b18",
    alt: "Wheat ears standing in a green field",
    tone: "#5b6b3a",
  },
  /** A ripening field under low sun. */
  goldenField: {
    id: "photo-1500382017468-9049fed747ef",
    alt: "A ripening cereal field under a low evening sun",
    tone: "#8a6a2c",
  },
  /** Young seedlings in worked soil. */
  seedlings: {
    id: "photo-1625246333195-78d9c38ad449",
    alt: "Young crop seedlings in freshly worked soil",
    tone: "#3f5228",
  },
  /** Hands setting seedlings into a tray. */
  handsPlanting: {
    id: "photo-1530836369250-ef72a3f5cda8",
    alt: "Hands setting young seedlings into a nursery tray",
    tone: "#4a4033",
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;

export const photoTone = (key: PhotoKey) => PHOTOS[key].tone;
export const photoAlt = (key: PhotoKey) => PHOTOS[key].alt;

/**
 * A src for a given rendered width. Quality is held at 62 - above that the
 * file doubles for a difference nobody sees behind a gradient overlay.
 */
export const photoSrc = (key: PhotoKey, width: number) =>
  `${UNSPLASH}/${PHOTOS[key].id}?auto=format&fit=crop&q=62&w=${width}`;

/** A srcset so a phone never downloads the desktop-sized crop. */
export const photoSrcSet = (key: PhotoKey, widths = [640, 960, 1440, 1920]) =>
  widths.map((w) => `${photoSrc(key, w)} ${w}w`).join(", ");
