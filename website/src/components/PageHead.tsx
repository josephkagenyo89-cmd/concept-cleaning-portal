import { Helmet } from "react-helmet-async";

interface PageHeadProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
}

const PageHead = ({ title, description, keywords, canonical }: PageHeadProps) => (
  <Helmet>
    <title>{title}</title>
    <meta name="description" content={description} />
    {keywords && <meta name="keywords" content={keywords} />}
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    {canonical && <link rel="canonical" href={canonical} />}
  </Helmet>
);

export default PageHead;
