
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Calendar, Store, DollarSign, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ReceiptStatus } from "@/types/receipt";

interface ReceiptCardProps {
  id: string;
  merchant: string;
  date: string;
  total: number;
  currency: string;
  imageUrl: string;
  status: ReceiptStatus;
  confidence: number;
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
}: ReceiptCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageSource, setImageSource] = useState<string>("/placeholder.svg");
  
  useEffect(() => {
    async function getImageUrl() {
      // Check if imageUrl is empty or a placeholder
      if (!imageUrl || imageUrl === "/placeholder.svg") {
        setImageSource("/placeholder.svg");
        return;
      }
      
      // Handle various URL formats
      if (imageUrl.startsWith('http')) {
        // Already a full URL, use it directly
        setImageSource(imageUrl);
      } else if (imageUrl.includes('receipt_images/')) {
        // It's a storage path, get a signed URL
        try {
          const { data, error } = await supabase.storage
            .from('receipt_images')
            .createSignedUrl(imageUrl.replace('receipt_images/', ''), 3600); // 1 hour expiry
          
          if (data && !error) {
            setImageSource(data.signedUrl);
          } else {
            console.error("Error getting signed URL:", error);
            setImageSource("/placeholder.svg");
          }
        } catch (error) {
          console.error("Error in getImageUrl:", error);
          setImageSource("/placeholder.svg");
        }
      } else {
        // Try to get from public bucket
        try {
          const { data: publicUrlData } = supabase.storage
            .from('receipt_images')
            .getPublicUrl(imageUrl);
            
          if (publicUrlData?.publicUrl) {
            setImageSource(publicUrlData.publicUrl);
          } else {
            setImageSource("/placeholder.svg");
          }
        } catch (error) {
          console.error("Error getting public URL:", error);
          setImageSource("/placeholder.svg");
        }
      }
    }
    
    getImageUrl();
  }, [imageUrl]);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };
  
  const getStatusColor = () => {
    switch (status) {
      case "synced": return "bg-green-500";
      case "reviewed": return "bg-blue-500";
      default: return "bg-yellow-500";
    }
  };
  
  const getConfidenceColor = () => {
    if (confidence >= 80) return "text-green-500";
    if (confidence >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -5 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="glass-card overflow-hidden group"
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={imageSource} 
          alt={`Receipt from ${merchant}`}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          onError={() => {
            console.log("Image failed to load:", imageUrl);
            setImageSource("/placeholder.svg");
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"></div>
        
        <div className="absolute top-2 right-2 flex gap-2">
          <Badge 
            variant="outline"
            className="text-xs font-medium bg-black/60 backdrop-blur-sm text-white border-white/20"
          >
            <span className={`mr-1.5 inline-block w-2 h-2 rounded-full ${getStatusColor()}`}></span>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
        
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
            <span className="text-sm font-medium">{merchant}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs">Confidence:</span>
            <span className={`text-xs font-semibold ${getConfidenceColor()}`}>
              {confidence}%
            </span>
          </div>
        </div>
        
        <div className="mt-4">
          <Link to={`/receipt/${id}`}>
            <Button className="w-full gap-2">
              <Eye size={16} />
              View Details
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
