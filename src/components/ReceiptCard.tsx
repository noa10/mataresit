import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Calendar, Store, DollarSign, Eye, Loader2, AlertTriangle, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    if (confidence >= 80) return "text-green-500";
    if (confidence >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getProcessingInfo = () => {
    if (!processingStatus || processingStatus === 'complete') return null;

    let statusText = t('processingStatus.processing');
    let icon = <Loader2 size={12} className="animate-spin mr-1" />;
    let colorClass = 'border-blue-500 text-blue-500';

    switch (processingStatus) {
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
        {processingStatus && processingStatus !== 'complete' && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-white flex flex-col items-center">
              {processingStatus === 'uploading' || processingStatus === 'uploaded' ||
               processingStatus === 'processing' ? (
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
            {getProcessingInfo() ? (
              <Badge
                variant="outline"
                className={`text-xs font-medium flex items-center ${getProcessingInfo()?.colorClass}`}
              >
                {getProcessingInfo()?.icon}
                {getProcessingInfo()?.statusText}
              </Badge>
            ) : (
              <>
                <span className="text-xs">{t('confidence.label')}</span>
                <span className={`text-xs font-semibold ${getConfidenceColor()}`}>
                  {confidence}%
                </span>
              </>
            )}
          </div>
        </div>

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
