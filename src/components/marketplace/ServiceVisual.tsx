import { useState } from 'react';

type Props = {
  video?: string | null;
  image: string;
  alt: string;
  className: string;
  loading?: 'lazy' | 'eager';
};

/** A silent, cropped demo with the existing service image as its fallback. */
export default function ServiceVisual({ video, image, alt, className, loading = 'lazy' }: Props) {
  const [failed, setFailed] = useState(false);

  if (!video || failed) {
    return <img src={image} alt={alt} loading={loading} className={className} />;
  }

  return (
    <>
      <img src={image} alt={alt} loading={loading} className={`${className} motion-safe:hidden`} />
      <video
        aria-label={alt}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster={image}
        onError={() => setFailed(true)}
        className={`${className} motion-reduce:hidden`}
      >
        <source src={video} type="video/mp4" media="(prefers-reduced-motion: no-preference)" />
      </video>
    </>
  );
}
