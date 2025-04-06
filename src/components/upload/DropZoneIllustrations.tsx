
import { motion } from "framer-motion";

// SVG illustrations for drop zone states
export const DropZoneIllustrations = {
  default: (
    <motion.div className="flex flex-col items-center gap-2">
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="12" width="56" height="56" rx="6" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        <motion.path 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          d="M40 28V52" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
        />
        <motion.path 
          initial={{ opacity: 0, x: 5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          d="M28 40H52" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
        />
      </svg>
      <motion.span 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="text-sm text-muted-foreground"
      >
        Add receipts
      </motion.span>
    </motion.div>
  ),
  drag: (
    <motion.div 
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 1, repeat: Infinity, repeatType: "loop" }}
      className="flex flex-col items-center gap-2"
    >
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="12" width="56" height="56" rx="6" stroke="currentColor" strokeWidth="2" />
        <path d="M40 28V52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 40H52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-sm font-medium">Drop files here</span>
    </motion.div>
  ),
  error: (
    <motion.div 
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.05, 0.95, 1.05, 1] }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-2 text-destructive"
    >
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="12" width="56" height="56" rx="6" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        <circle cx="40" cy="40" r="16" stroke="currentColor" strokeWidth="2" />
        <path d="M34 34L46 46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M46 34L34 46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-sm font-medium">Invalid file type</span>
    </motion.div>
  )
};

// File type icon selector
export const getFileTypeIcon = (type: string) => {
  if (type.startsWith('image/')) {
    return <Image size={24} className="text-blue-500" />;
  } else if (type === 'application/pdf') {
    return <FileText size={24} className="text-red-500" />;
  }
  return <File size={24} className="text-gray-500" />;
};

// Need to import the icons used by getFileTypeIcon
import { Image, FileText, File } from "lucide-react";
