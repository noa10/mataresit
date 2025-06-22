
import { motion } from "framer-motion";

// SVG illustrations for drop zone states
export const DropZoneIllustrations = {
  default: (
    <motion.div className="flex flex-col items-center gap-2">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <motion.path
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          d="M24 16V32"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <motion.path
          initial={{ opacity: 0, x: 3 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          d="M16 24H32"
          stroke="currentColor"
          strokeWidth="1.5"
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
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M24 16V32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 24H32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="24" cy="24" r="10" stroke="currentColor" strokeWidth="1.5" />
        <path d="M20 20L28 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M28 20L20 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="text-sm font-medium">Invalid file type</span>
    </motion.div>
  )
};

// File type icon selector
export const getFileTypeIcon = (type: string) => {
  if (type.startsWith('image/')) {
    return <Image size={20} className="text-blue-500" />;
  } else if (type === 'application/pdf') {
    return <FileText size={20} className="text-red-500" />;
  }
  return <File size={20} className="text-gray-500" />;
};

// Need to import the icons used by getFileTypeIcon
import { Image, FileText, File } from "lucide-react";
