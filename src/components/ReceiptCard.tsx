
import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Calendar, Store, DollarSign, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ReceiptCardProps {
  id: string;
  merchant: string;
  date: string;
  total: number;
  currency: string;
  imageUrl: string;
  status: "unreviewed" | "reviewed" | "synced";
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
          src={imageUrl} 
          alt={`Receipt from ${merchant}`}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        
        <div className="absolute top-2 right-2 flex gap-2">
          <Badge 
            variant="outline"
            className={`text-xs font-medium bg-white/80 backdrop-blur-sm`}
          >
            <span className={`mr-1.5 inline-block w-2 h-2 rounded-full ${getStatusColor()}`}></span>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
        
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-semibold text-lg truncate">{merchant}</h3>
          <div className="flex justify-between items-end">
            <p className="text-white/90 text-sm flex items-center gap-1">
              <Calendar size={14} />
              {date}
            </p>
            <p className="text-white font-bold">
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
