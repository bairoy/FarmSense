import { photoAlt, photoSrc, photoSrcSet, photoTone, type PhotoKey } from "../../brand";

/**
 * A photograph with its own average colour painted behind it.
 *
 * The tone is not decoration. Until the image arrives - and on a rural
 * connection that can be several seconds - the layout would otherwise show a
 * white gap where a dark hero is about to appear, and white text over it is
 * invisible for exactly as long as that lasts. Painting the tone first means
 * the page is legible from the first frame and the photo fades in over it.
 */
export function Photo({
  name,
  className = "",
  sizes = "100vw",
  priority = false,
}: {
  name: PhotoKey;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={photoSrc(name, 1440)}
      srcSet={photoSrcSet(name)}
      sizes={sizes}
      alt={photoAlt(name)}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      style={{ backgroundColor: photoTone(name) }}
      className={`object-cover ${className}`}
    />
  );
}
