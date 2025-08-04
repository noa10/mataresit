import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Clock,
  User,
  BookOpen,
  ExternalLink,
  Share2,
  Bookmark
} from 'lucide-react';
import { documentationService, DocumentationGuide } from '@/services/documentationService';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

export default function GuideDetailPage() {
  const { guideId } = useParams<{ guideId: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [guide, setGuide] = useState<DocumentationGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (guideId) {
      loadGuide();
    }
  }, [guideId, language]);

  const loadGuide = async () => {
    if (!guideId) return;

    try {
      setLoading(true);
      setError(null);
      const guideData = await documentationService.getGuide(guideId, language);
      
      if (!guideData) {
        setError('Guide not found');
        return;
      }

      setGuide(guideData);
    } catch (err) {
      console.error('Failed to load guide:', err);
      setError('Failed to load guide');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 border-green-200';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'advanced': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'new-user': return <User className="h-4 w-4" />;
      case 'team-admin': return <User className="h-4 w-4" />;
      case 'power-user': return <User className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const handleShare = async () => {
    if (navigator.share && guide) {
      try {
        await navigator.share({
          title: guide.title,
          text: guide.description,
          url: window.location.href,
        });
      } catch (err) {
        // Fallback to clipboard
        navigator.clipboard.writeText(window.location.href);
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !guide) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">
            {error || 'Guide Not Found'}
          </h1>
          <p className="text-muted-foreground mt-2 mb-6">
            The requested guide could not be found or loaded.
          </p>
          <Button onClick={() => navigate('/docs')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documentation
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/docs')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Docs
          </Button>
          
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Bookmark className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="capitalize">{guide.category.replace('-', ' ')}</span>
            {guide.subcategory && (
              <>
                <span>•</span>
                <span className="capitalize">{guide.subcategory.replace('-', ' ')}</span>
              </>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {guide.title}
          </h1>

          <p className="text-lg text-muted-foreground max-w-3xl">
            {guide.description}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Badge variant="outline" className={getDifficultyColor(guide.difficulty)}>
              {guide.difficulty}
            </Badge>
            
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {guide.readingTime} min read
            </div>

            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {getUserTypeIcon(guide.userType)}
              <span className="capitalize">{guide.userType.replace('-', ' ')}</span>
            </div>

            <div className="text-sm text-muted-foreground">
              Updated {new Date(guide.lastUpdated).toLocaleDateString()}
            </div>
          </div>

          {guide.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {guide.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <Separator className="mb-8" />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-4 gap-8"
      >
        {/* Main Content */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-8">
              {guide.content ? (
                <MarkdownRenderer content={guide.content} />
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Content Loading</h3>
                  <p className="text-muted-foreground">
                    The guide content is being loaded...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Source
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Guide
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Bookmark className="h-4 w-4 mr-2" />
                    Bookmark
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Guide Info */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Guide Information</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <div className="font-medium capitalize">
                      {guide.category.replace('-', ' ')}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Difficulty:</span>
                    <div className="font-medium capitalize">{guide.difficulty}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Target User:</span>
                    <div className="font-medium capitalize">
                      {guide.userType.replace('-', ' ')}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reading Time:</span>
                    <div className="font-medium">{guide.readingTime} minutes</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Updated:</span>
                    <div className="font-medium">
                      {new Date(guide.lastUpdated).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
