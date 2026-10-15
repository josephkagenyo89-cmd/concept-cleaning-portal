type Props = {
  image: string;
  alt: string;
  className: string;
  loading?: 'lazy' | 'eager';
};

/** Service image. Demo videos were removed. */
export default function ServiceVisual({ image, alt, className, loading = 'lazy' }: Props) {
  return <img src={image} alt={alt} loading={loading} className={className} />;
}
