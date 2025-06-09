import { Loader2, Check, XCircle } from "lucide-react";

// Define processing stages with their details
export const PROCESSING_STAGES = {
  START: {
    name: "Uploading",
    description: "Uploading receipt image",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-blue-400 border-blue-400"
  },
  FETCH: {
    name: "Uploaded",
    description: "Receipt image uploaded successfully",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-blue-500 border-blue-500"
  },
  PROCESSING: {
    name: "AI Processing",
    description: "Processing receipt with AI",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-indigo-500 border-indigo-500"
  },
  EXTRACT: {
    name: "Extracting",
    description: "Extracting key data from receipt",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-purple-500 border-purple-500"
  },
  GEMINI: {
    name: "AI Analysis",
    description: "Analyzing receipt with AI",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-violet-500 border-violet-500"
  },
  SAVE: {
    name: "Saving",
    description: "Saving processed data",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-fuchsia-500 border-fuchsia-500"
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
