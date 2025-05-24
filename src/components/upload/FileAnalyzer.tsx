import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  FileText, 
  Zap, 
  Brain, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Settings,
  TrendingUp,
  Shield,
  Info
} from "lucide-react";
import { analyzeFile, getProcessingRecommendation, ProcessingRecommendation, FileAnalysis } from "@/utils/processingOptimizer";
import { formatDuration } from "@/utils/timeEstimation";

interface FileAnalyzerProps {
  file: File;
  onRecommendationChange?: (recommendation: ProcessingRecommendation) => void;
  showDetails?: boolean;
  compact?: boolean;
}

export function FileAnalyzer({ 
  file, 
  onRecommendationChange, 
  showDetails = true,
  compact = false 
}: FileAnalyzerProps) {
  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null);
  const [recommendation, setRecommendation] = useState<ProcessingRecommendation | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Analyze file when it changes
  useEffect(() => {
    if (!file) return;

    const analyzeFileAsync = async () => {
      // Get image dimensions if it's an image
      let imageDimensions: { width: number; height: number } | undefined;
      
      if (file.type.startsWith('image/')) {
        try {
          imageDimensions = await getImageDimensions(file);
          setDimensions(imageDimensions);
        } catch (error) {
          console.warn('Could not get image dimensions:', error);
        }
      }

      // Analyze file
      const fileAnalysis = analyzeFile(file, imageDimensions);
      setAnalysis(fileAnalysis);

      // Get processing recommendation
      const processingRecommendation = getProcessingRecommendation(fileAnalysis);
      setRecommendation(processingRecommendation);
      
      // Notify parent component
      onRecommendationChange?.(processingRecommendation);
    };

    analyzeFileAsync();
  }, [file, onRecommendationChange]);

  // Helper function to get image dimensions
  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  };

  if (!analysis || !recommendation) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        Analyzing file...
      </div>
    );
  }

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getMethodIcon = (method: string) => {
    return method === 'ai-vision' ? 
      <Brain className="h-4 w-4 text-purple-500" /> : 
      <Zap className="h-4 w-4 text-blue-500" />;
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-blue-600 bg-blue-100';
      case 'low': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
      >
        {getMethodIcon(recommendation.recommendedMethod)}
        <span className="text-sm font-medium">
          {recommendation.recommendedMethod === 'ai-vision' ? 'AI Vision' : 'OCR + AI'}
        </span>
        <Badge variant="outline" className={getConfidenceColor(recommendation.confidence)}>
          {recommendation.confidence} confidence
        </Badge>
        {getRiskIcon(recommendation.riskLevel)}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Processing Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Information */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Size:</span>
              <span className="ml-2 font-medium">
                {(analysis.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>
              <span className="ml-2 font-medium">
                {analysis.type === 'application/pdf' ? 'PDF' : 'Image'}
              </span>
            </div>
            {dimensions && (
              <>
                <div>
                  <span className="text-muted-foreground">Dimensions:</span>
                  <span className="ml-2 font-medium">
                    {dimensions.width} × {dimensions.height}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Resolution:</span>
                  <span className="ml-2 font-medium">
                    {((dimensions.width * dimensions.height) / 1000000).toFixed(1)}MP
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Analysis Results */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={getComplexityColor(analysis.complexity)}>
              {analysis.complexity} complexity
            </Badge>
            <Badge variant="outline" className={getConfidenceColor(recommendation.confidence)}>
              {recommendation.confidence} confidence
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="flex items-center gap-1">
                    {getRiskIcon(recommendation.riskLevel)}
                    {recommendation.riskLevel} risk
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Processing risk level based on file characteristics</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Recommendation */}
          <div className="p-3 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              {getMethodIcon(recommendation.recommendedMethod)}
              <span className="font-medium">
                Recommended: {recommendation.recommendedMethod === 'ai-vision' ? 'AI Vision' : 'OCR + AI'}
              </span>
              <Badge variant="secondary">{recommendation.recommendedModel}</Badge>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>~{formatDuration(recommendation.estimatedProcessingTime)}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>Optimized for this file</span>
              </div>
            </div>
          </div>

          {/* Reasoning */}
          {showDetails && recommendation.reasoning.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                Analysis Details
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                {recommendation.reasoning.map((reason, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fallback Strategy */}
          {showDetails && (
            <div className="p-2 bg-blue-50 rounded-md border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-3 w-3 text-blue-600" />
                <span className="text-xs font-medium text-blue-800">Fallback Strategy</span>
              </div>
              <div className="text-xs text-blue-700">
                If primary method fails, will automatically switch to{' '}
                <span className="font-medium">
                  {recommendation.fallbackStrategy.fallbackMethod === 'ai-vision' ? 'AI Vision' : 'OCR + AI'}
                </span>
                {' '}with {recommendation.fallbackStrategy.maxRetries} retry attempts.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
