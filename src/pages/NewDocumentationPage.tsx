import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  BookOpen,
  Rocket,
  Wrench,
  Brain,
  Users,
  Search,
  Clock,
  User,
  ArrowRight,
  Star,
  Zap
} from 'lucide-react';
import { documentationService, DocumentationStructure, DocumentationGuide } from '@/services/documentationService';

const iconMap = {
  Rocket,
  Wrench,
  Brain,
  Users,
  BookOpen
};

// Helper functions
const getUserTypeIcon = (userType: string) => {
  switch (userType) {
    case 'new-user': return <User className="h-3 w-3" />;
    case 'team-admin': return <Users className="h-3 w-3" />;
    case 'power-user': return <Zap className="h-3 w-3" />;
    default: return <BookOpen className="h-3 w-3" />;
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

export default function NewDocumentationPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [documentation, setDocumentation] = useState<DocumentationStructure | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DocumentationGuide[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocumentation();
  }, [language]);

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, documentation]);

  const loadDocumentation = async () => {
    try {
      setLoading(true);
      const docs = await documentationService.getDocumentationStructure(language);
      setDocumentation(docs);
    } catch (error) {
      console.error('Failed to load documentation:', error);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async () => {
    if (!documentation || !searchQuery.trim()) return;
    
    try {
      const results = await documentationService.searchGuides(searchQuery, language);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  if (!documentation) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Documentation Not Available</h1>
          <p className="text-muted-foreground mt-2">Unable to load documentation. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Mataresit User Guides
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Comprehensive documentation to help you master Mataresit's intelligent receipt management capabilities.
        </p>
        
        {/* Search Bar */}
        <div className="mt-8 max-w-lg mx-auto relative">
          <Input
            placeholder="Search guides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 h-12 text-base"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>
      </motion.div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-bold mb-6">Search Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchResults.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
          <Separator className="mt-8" />
        </motion.section>
      )}

      {/* Quick Start Section */}
      {!searchQuery && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <div className="flex items-center gap-2 mb-6">
            <Zap className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Quick Start</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {documentation.quickStart.map((guide) => (
              <QuickStartCard key={guide.id} guide={guide} />
            ))}
          </div>
        </motion.section>
      )}

      {/* Featured Guides */}
      {!searchQuery && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <div className="flex items-center gap-2 mb-6">
            <Star className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Featured Guides</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {documentation.featured.map((guide) => (
              <FeaturedGuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        </motion.section>
      )}

      {/* Categories */}
      {!searchQuery && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold mb-6">All Categories</h2>
          <div className="space-y-8">
            {documentation.categories.map((category) => {
              const IconComponent = iconMap[category.icon as keyof typeof iconMap] || BookOpen;
              
              return (
                <div key={category.id} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <IconComponent className={`h-6 w-6 ${category.color}`} />
                    <h3 className="text-xl font-semibold">{category.title}</h3>
                    <Badge variant="secondary">{category.guides.length} guides</Badge>
                  </div>
                  <p className="text-muted-foreground">{category.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {category.guides.map((guide) => (
                      <GuideCard key={guide.id} guide={guide} compact />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}
    </div>
  );
}

// Guide Card Component
function GuideCard({ guide, compact = false }: { guide: DocumentationGuide; compact?: boolean }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/docs/guide/${guide.id}`);
  };

  return (
    <Card className="h-full hover:shadow-lg transition-all duration-200 cursor-pointer group" onClick={handleClick}>
      <CardHeader className={compact ? "pb-3" : "pb-4"}>
        <div className="flex items-start justify-between">
          <CardTitle className={`${compact ? "text-base" : "text-lg"} group-hover:text-primary transition-colors`}>
            {guide.title}
          </CardTitle>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
        {!compact && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {guide.description}
          </p>
        )}
      </CardHeader>
      <CardContent className={compact ? "pt-0" : ""}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getDifficultyColor(guide.difficulty)}>
              {guide.difficulty}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {guide.readingTime}m
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {getUserTypeIcon(guide.userType)}
          </div>
        </div>
        {!compact && guide.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {guide.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Quick Start Card Component
function QuickStartCard({ guide }: { guide: DocumentationGuide }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/docs/guide/${guide.id}`);
  };

  return (
    <Card className="h-full hover:shadow-lg transition-all duration-200 cursor-pointer group border-primary/20" onClick={handleClick}>
      <CardContent className="p-6 text-center">
        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
          <Rocket className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">
          {guide.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {guide.description}
        </p>
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {guide.readingTime}m read
        </div>
      </CardContent>
    </Card>
  );
}

// Featured Guide Card Component
function FeaturedGuideCard({ guide }: { guide: DocumentationGuide }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/docs/guide/${guide.id}`);
  };

  return (
    <Card className="h-full hover:shadow-lg transition-all duration-200 cursor-pointer group" onClick={handleClick}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {guide.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {guide.description}
            </p>
          </div>
          <Star className="h-5 w-5 text-yellow-500 flex-shrink-0" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getDifficultyColor(guide.difficulty)}>
              {guide.difficulty}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {guide.readingTime}m
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </CardContent>
    </Card>
  );
}


