import { Helmet } from 'react-helmet-async';
import { useEffect } from 'react';
import { BlogSEOProps } from '@/types/blog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdvancedTranslation } from '@/hooks/useAdvancedTranslation';
import { seoUtils, LANGUAGE_SEO_CONFIGS } from '@/lib/i18n-seo';

export function BlogSEO({ post, isIndex = false }: BlogSEOProps) {
  const { language } = useLanguage();
  const { t } = useAdvancedTranslation('homepage');
  const languageConfig = LANGUAGE_SEO_CONFIGS[language];
  // Initialize SEO for current language
  useEffect(() => {
    seoUtils.initializeSEO(language);
  }, [language]);

  // Default SEO values for the blog (localized)
  const defaultTitle = t('blog.title', { defaultValue: 'The Mataresit Blog' });
  const defaultDescription = t('blog.description', {
    defaultValue: 'Insights, updates, and expert tips on AI-powered expense management, productivity, and digital transformation for modern businesses.'
  });
  const defaultImage = '/og-blog.jpg';
  const siteUrl = window.location.origin;

  // Generate SEO values based on whether it's index or individual post
  const getSEOData = () => {
    if (isIndex) {
      return {
        title: defaultTitle,
        description: defaultDescription,
        url: `${siteUrl}/blog`,
        image: defaultImage,
        type: 'website',
      };
    }

    if (!post) {
      return {
        title: t('blog.notFound.title', { defaultValue: 'Blog Post Not Found | Mataresit' }),
        description: t('blog.notFound.description', { defaultValue: 'The requested blog post could not be found.' }),
        url: `${siteUrl}/blog`,
        image: defaultImage,
        type: 'article',
      };
    }

    // Individual post SEO with language-specific URL structure
    const title = `${post.title} | ${t('blog.title', { defaultValue: 'Mataresit Blog' })}`;
    const description = post.excerpt || defaultDescription;

    // Build language-aware URL
    const basePath = language === 'en' ? '/blog' : `/${language}/blog`;
    const url = `${siteUrl}${basePath}/${post.slug}`;
    const image = post.image_url || defaultImage;

    return {
      title,
      description,
      url,
      image,
      type: 'article',
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      author: post.author ? `${post.author.first_name || ''} ${post.author.last_name || ''}`.trim() : 'Mataresit Team',
      tags: post.tags,
    };
  };

  const seoData = getSEOData();

  return (
    <Helmet>
      {/* Language and Locale Meta Tags */}
      <html lang={languageConfig.locale} dir={languageConfig.direction} />
      <meta name="language" content={languageConfig.language} />
      <meta name="locale" content={languageConfig.locale} />

      {/* Basic Meta Tags */}
      <title>{seoData.title}</title>
      <meta name="description" content={seoData.description} />
      <link rel="canonical" href={seoData.url} />

      {/* Alternate Language Links */}
      <link rel="alternate" hreflang="en" href={`${siteUrl}/blog${post ? `/${post.slug}` : ''}`} />
      <link rel="alternate" hreflang="ms" href={`${siteUrl}/ms/blog${post ? `/${post.slug}` : ''}`} />
      <link rel="alternate" hreflang="x-default" href={`${siteUrl}/blog${post ? `/${post.slug}` : ''}`} />

      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={seoData.title} />
      <meta property="og:description" content={seoData.description} />
      <meta property="og:url" content={seoData.url} />
      <meta property="og:image" content={seoData.image} />
      <meta property="og:type" content={seoData.type} />
      <meta property="og:site_name" content="Mataresit" />
      <meta property="og:locale" content={languageConfig.locale} />

      {/* Alternate locales for Open Graph */}
      {language === 'en' && <meta property="og:locale:alternate" content="ms_MY" />}
      {language === 'ms' && <meta property="og:locale:alternate" content="en_US" />}

      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoData.title} />
      <meta name="twitter:description" content={seoData.description} />
      <meta name="twitter:image" content={seoData.image} />

      {/* Article-specific Meta Tags */}
      {seoData.type === 'article' && (
        <>
          {seoData.publishedTime && (
            <meta property="article:published_time" content={seoData.publishedTime} />
          )}
          {seoData.modifiedTime && (
            <meta property="article:modified_time" content={seoData.modifiedTime} />
          )}
          {seoData.author && (
            <meta property="article:author" content={seoData.author} />
          )}
          {seoData.tags && seoData.tags.map((tag) => (
            <meta key={tag} property="article:tag" content={tag} />
          ))}
          <meta property="article:section" content="Business Technology" />
        </>
      )}

      {/* Additional SEO Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content={seoData.author || 'Mataresit Team'} />
      
      {/* Schema.org JSON-LD */}
      <script type="application/ld+json">
        {JSON.stringify(
          isIndex
            ? {
                '@context': 'https://schema.org',
                '@type': 'Blog',
                name: defaultTitle,
                description: defaultDescription,
                url: seoData.url,
                publisher: {
                  '@type': 'Organization',
                  name: 'Mataresit',
                  url: siteUrl,
                },
              }
            : post
            ? {
                '@context': 'https://schema.org',
                '@type': 'BlogPosting',
                headline: post.title,
                description: post.excerpt || defaultDescription,
                image: post.image_url || defaultImage,
                url: seoData.url,
                datePublished: post.published_at,
                dateModified: post.updated_at,
                author: {
                  '@type': 'Person',
                  name: seoData.author,
                },
                publisher: {
                  '@type': 'Organization',
                  name: 'Mataresit',
                  url: siteUrl,
                },
                mainEntityOfPage: {
                  '@type': 'WebPage',
                  '@id': seoData.url,
                },
                keywords: post.tags?.join(', ') || '',
              }
            : {}
        )}
      </script>

      {/* Preconnect to external domains for performance */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    </Helmet>
  );
}
