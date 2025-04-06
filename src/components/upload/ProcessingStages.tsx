
import { Loader2, Check, XCircle } from "lucide-react";

// Define processing stages with their details
export const PROCESSING_STAGES = {
  QUEUED: {
    name: "Queued",
    description: "Receipt is queued for processing",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-blue-400 border-blue-400"
  },
  START: {
    name: "Started",
    description: "Processing has started",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-blue-500 border-blue-500"
  },
  FETCH: {
    name: "Fetching",
    description: "Fetching receipt image",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-indigo-500 border-indigo-500"
  },
  OCR: {
    name: "OCR",
    description: "Performing OCR on receipt",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-purple-500 border-purple-500"
  },
  EXTRACT: {
    name: "Extracting",
    description: "Extracting data from OCR results",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-violet-500 border-violet-500"
  },
  GEMINI: {
    name: "Analyzing",
    description: "Analyzing receipt with AI",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-fuchsia-500 border-fuchsia-500"
  },
  SAVE: {
    name: "Saving",
    description: "Saving processed data",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-pink-500 border-pink-500"
  },
  COMPLETE: {
    name: "Complete",
    description: "Processing complete",
    icon: <Check size={16} />,
    color: "text-green-500 border-green-500"
  },
  ERROR: {
    name: "Error",
    description: "An error occurred during processing",
    icon: <XCircle size={16} />,
    color: "text-red-500 border-red-500"
  }
};
