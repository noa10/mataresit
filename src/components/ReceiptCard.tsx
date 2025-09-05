import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Calendar, Store, DollarSign, Eye, Loader2, AlertTriangle, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ReceiptStatus, ProcessingStatus, CustomCategory, Receipt } from "@/types/receipt";
import { ReceiptCardImage } from "@/components/ui/OptimizedImage";
import { formatCurrencySafe } from "@/utils/currency";
import { ClaimFromReceiptButton } from "@/components/claims/ClaimFromReceiptButton";
import { useReceiptsTranslation } from "@/contexts/LanguageContext";
import { CategoryDisplay } from "@/components/categories/CategorySelector";

interface ReceiptCardProps {
  id: string;
  merchant: string;
  date: string;
  total: number;
  currency: string;
  imageUrl: string;
  status: ReceiptStatus;
  confidence: number;
  processingStatus?: ProcessingStatus;
  disableInternalLink?: boolean;
  category?: CustomCategory | null;
}

export default function ReceiptCard({
  id,
  merchant,
  date,
  total,
  currency,
  imageUrl,
  status,
  confidence,
  processingStatus,
  disableInternalLink,
  category
}: ReceiptCardProps) {
  const { t } = useReceiptsTranslation();
  const [isHovered, setIsHovered] = useState(false);

  // Helper function to normalize confidence scores (handles decimal/percentage format)
  const normalizeConfidence = (score: number): number => {
    const numScore = Number(score);
    if (isNaN(numScore)) return 50; // Default to 50% if invalid

    // Handle different score formats:
    // - If score is between 0 and 1 (exclusive of 1), treat as decimal (0.85 = 85%)
    // - If score is exactly 1, treat as 1% (edge case)
    // - If score is > 1, treat as already a percentage (85 = 85%)
    let normalizedScore: number;
    if (numScore < 1) {
      normalizedScore = numScore * 100; // Convert decimal to percentage
    } else {
      normalizedScore = numScore; // Already a percentage (including 1 = 1%)
    }

    // Ensure the score is capped at 100% maximum
    return Math.min(Math.round(normalizedScore), 100);
  };

  // Normalize the confidence score to ensure it's within 0-100% range
  const normalizedConfidence = normalizeConfidence(confidence);

  const formatCurrency = (amount: number) => {
    return formatCurrencySafe(amount, currency, 'en-US', 'MYR');
  };

  const getStatusColor = () => {
    switch (status) {
      case "reviewed": return "bg-blue-500";
      case "unreviewed": return "bg-yellow-500";
      default: return "bg-green-500";
    }
  };

  const getConfidenceColor = () => {
    if (normalizedConfidence >= 80) return "text-green-500";
    if (normalizedConfidence >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  // Normalize processing status for cross-platform compatibility
  const normalizeProcessingStatus = (status: string | null | undefined): ProcessingStatus => {
    if (!status) return 'complete';

    // Handle Flutter app status values
    switch (status.toLowerCase()) {
      case 'completed':
        return 'complete';
      case 'pending':
        return 'uploading';
      case 'manual_review':
        return 'complete';
      default:
        // If it's already a valid React status, return as-is
        if (['uploading', 'uploaded', 'processing', 'failed', 'complete'].includes(status.toLowerCase())) {
          return status.toLowerCase() as ProcessingStatus;
        }
        // Default to complete for unknown statuses to prevent infinite loading
        return 'complete';
    }
  };

  const normalizedStatus = normalizeProcessingStatus(processingStatus);

  const getProcessingInfo = () => {
    if (!normalizedStatus || normalizedStatus === 'complete') return null;

    let statusText = t('processingStatus.processing');
    let icon = <Loader2 size={12} className="animate-spin mr-1" />;
    let colorClass = 'border-blue-500 text-blue-500';

    switch (normalizedStatus) {
      case 'uploading':
        statusText = t('processingStatus.uploading');
        colorClass = 'border-blue-500 text-blue-500';
        break;
      case 'uploaded':
        statusText = t('processingStatus.uploaded');
        colorClass = 'border-indigo-500 text-indigo-500';
        break;
      case 'processing':
        statusText = t('processingStatus.processing');
        colorClass = 'border-purple-500 text-purple-500';
        break;
      case 'failed':
        statusText = t('processingStatus.failed');
        icon = <AlertTriangle size={12} className="mr-1" />;
        colorClass = 'border-red-500 text-red-500';
        break;
    }

    return { statusText, icon, colorClass };
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -5 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="glass-card overflow-hidden group flex flex-col h-full"
    >
      <div className="relative h-48 overflow-hidden">
        <ReceiptCardImage
          src={imageUrl}
          alt={`Receipt from ${merchant}`}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          containerClassName="w-full h-full"
          skeletonClassName="w-full h-full"
          errorClassName="w-full h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"></div>
        
        <div className="absolute top-2 right-2 flex gap-2">
          <Badge 
            variant="outline"
            className="text-xs font-medium bg-black/60 backdrop-blur-sm text-white border-white/20"
          >
            <span className={`mr-1.5 inline-block w-2 h-2 rounded-full ${getStatusColor()}`}></span>
            {t(`status.${status}`)}
          </Badge>
        </div>
        
        {/* Processing indicator overlay */}
        {normalizedStatus && normalizedStatus !== 'complete' && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-white flex flex-col items-center">
              {normalizedStatus === 'uploading' || normalizedStatus === 'uploaded' ||
               normalizedStatus === 'processing' ? (
                <Loader2 size={32} className="animate-spin mb-3" />
              ) : (
                <AlertTriangle size={32} className="mb-3 text-red-500" />
              )}
              <p className="text-sm font-medium">
                {processingStatus === 'uploading' && t('processingStatus.uploading')}
                {processingStatus === 'uploaded' && t('processingStatus.processing')}
                {processingStatus === 'processing' && t('processingStatus.processing')}
                {processingStatus === 'failed' && t('processingStatus.failed')}
              </p>
            </div>
          </div>
        )}
        
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-semibold text-lg truncate drop-shadow-md">{merchant}</h3>
          <div className="flex justify-between items-end">
            <p className="text-white/90 text-sm flex items-center gap-1 drop-shadow-md">
              <Calendar size={14} />
              {date}
            </p>
            <p className="text-white font-bold drop-shadow-md">
              {formatCurrency(total)}
            </p>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Store size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium truncate">{merchant}</span>
          </div>
          <div className="flex items-center gap-1">
            {getProcessingInfo() && (
              <Badge
                variant="outline"
                className={`text-xs font-medium flex items-center ${getProcessingInfo()?.colorClass}`}
              >
                {getProcessingInfo()?.icon}
                {getProcessingInfo()?.statusText}
              </Badge>
            )}
          </div>
        </div>

        {/* Confidence score below merchant name */}
        {!getProcessingInfo() && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{t('confidence.label')}</span>
            <TooltipProvider delayDuration={200}>
              <Tooltip onOpenChange={(open) => console.debug('[ReceiptCard ConfidenceTooltip] open change:', open, 'for receipt', id)}>
                <TooltipTrigger asChild>
                  <span
                    className={`text-xs font-semibold cursor-help ${getConfidenceColor()}`}
                    onMouseEnter={() => console.debug('[ReceiptCard ConfidenceTooltip] mouse enter on trigger for receipt', id)}
                  >
                    {normalizedConfidence}%
                  </span>
                </TooltipTrigger>
                <TooltipContent forceMount side="top" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{t('confidence.tooltip.title')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('confidence.tooltip.description')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('confidence.tooltip.range')}
                    </p>
                  </div>
                </TooltipContent>
                </Tooltip>
              </TooltipProvider>
          </div>
        )}

        {/* Category display */}
        <div className="mt-2 flex items-center gap-2">
          <CategoryDisplay category={category} size="sm" />
        </div>
        
        <div className="mt-4 space-y-2">
          {disableInternalLink ? (
            <Button className="w-full gap-2">
              <Eye size={16} />
              {t('actions.viewDetails')}
            </Button>
          ) : (
            <Button
              className="w-full gap-2"
              onClick={() => {
                const url = `/receipt/${id}`;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            >
              <Eye size={16} />
              {t('actions.viewDetails')}
            </Button>
          )}

          {/* Create Claim Button */}
          <ClaimFromReceiptButton
            receipt={{
              id,
              merchant,
              date,
              total,
              currency,
              image_url: imageUrl,
              status,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              payment_method: '',
            } as Receipt}
            variant="outline"
            size="sm"
            className="w-full"
          />
        </div>
      </div>
    </motion.div>
  );
}
