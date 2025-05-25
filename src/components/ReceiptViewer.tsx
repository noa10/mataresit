import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Calendar, CreditCard, DollarSign, Plus, Minus, Receipt, Send, RotateCw, RotateCcw, ZoomIn, ZoomOut, History, Loader2, AlertTriangle, BarChart2, Check, Sparkles, Tag, Download, Trash2, Upload, Eye, EyeOff, Layers, Settings, Bug, RefreshCw, ChevronDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ReceiptWithDetails, ReceiptLineItem, ProcessingLog, AISuggestions, ProcessingStatus, ConfidenceScore } from "@/types/receipt";
import { updateReceipt, processReceiptWithOCR, logCorrections, fixProcessingStatus, generateEmbeddingsForReceipt } from "@/services/receiptService";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ReceiptHistoryModal } from "@/components/receipts/ReceiptHistoryModal";
import { getFormattedImageUrl, getFormattedImageUrlSync } from "@/utils/imageUtils";
import BoundingBoxOverlay from "@/components/receipts/BoundingBoxOverlay";
import DocumentStructureViewer from "@/components/receipts/DocumentStructureViewer";
import VisualizationSettings from "@/components/receipts/VisualizationSettings";
import { SimilarReceipts } from "@/components/search/SimilarReceipts";

export interface ReceiptViewerProps {
  receipt: ReceiptWithDetails;
  onDelete?: (deletedId: string) => void; // Notify parent of deletion
  onUpdate?: (updatedReceipt: ReceiptWithDetails) => void; // Notify parent of updates
}

// Define a type alias for the confidence structure in ReceiptWithDetails
type ReceiptConfidence = {
  merchant?: number;
  date?: number;
  total?: number;
  tax?: number;
  line_items?: number;
  payment_method?: number;
};

// Then use it in our state and default values
const defaultConfidence: ReceiptConfidence = {
  merchant: 0,
  date: 0,
  total: 0,
  tax: 0,
  payment_method: 0,
  line_items: 0,
};

// Helper function to normalize confidence (handles decimal/percentage)
const normalizeConfidence = (score?: number | null): number => {
  if (score === undefined || score === null) return 50; // Default to 50% instead of 0
  const numScore = Number(score);
  if (isNaN(numScore)) return 50; // Default to 50% if invalid
  // Assume scores > 1 are already percentages, otherwise convert decimal
  return numScore > 1 ? Math.round(numScore) : Math.round(numScore * 100);
};

// Enhanced Confidence indicator component with better visual feedback and tooltips
function ConfidenceIndicator({ score, loading = false }: { score?: number, loading?: boolean }) {
  // Show loading state while processing
  if (loading) {
    return (
      <div className="flex items-center gap-1">
        <span className="inline-block w-4 h-1 rounded bg-gray-300 animate-pulse"></span>
        <span className="text-xs text-gray-400">Processing...</span>
      </div>
    );
  }

  const normalizedScore = normalizeConfidence(score);

  // More granular color scale with 4 levels
  const color = normalizedScore >= 80 ? 'bg-green-500' :
                normalizedScore >= 60 ? 'bg-yellow-500' :
                normalizedScore >= 40 ? 'bg-orange-500' : 'bg-red-500';

  // Add confidence labels for accessibility
  const label = normalizedScore >= 80 ? 'High' :
               normalizedScore >= 60 ? 'Medium' :
               normalizedScore >= 40 ? 'Low' : 'Very Low';

  return (
    <div className="flex items-center gap-1 group relative">
      <span className={`inline-block w-4 h-1 rounded ${color}`}></span>
      <span className="text-xs">{normalizedScore}%</span>

      {/* Tooltip showing confidence explanation */}
      <div className="absolute bottom-full right-0 mb-2 p-2 bg-gray-800 text-white text-xs rounded
                    opacity-0 group-hover:opacity-100 transition-opacity w-48 z-10 pointer-events-none shadow-lg">
        <p className="font-medium">{label} confidence</p>
        <p className="text-gray-300 text-[10px] mt-1">
          {normalizedScore === 100
            ? 'Verified by user'
            : `AI detection with ${label.toLowerCase()} confidence`}
        </p>
        {normalizedScore < 100 && (
          <p className="text-gray-300 text-[10px] mt-1">Edit this field to verify.</p>
        )}
      </div>
    </div>
  );
}

// Debounce function to delay state updates
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default function ReceiptViewer({ receipt, onDelete, onUpdate }: ReceiptViewerProps) {
  // State for image manipulation
  const [rotation, setRotation] = useState(0);
  const [editedReceipt, setEditedReceipt] = useState(receipt);
  // Add a separate state for input values that will be debounced
  const [inputValues, setInputValues] = useState({
    merchant: receipt.merchant || "",
    date: receipt.date || "",
    total: receipt.total || 0,
    tax: receipt.tax || 0,
    currency: receipt.currency || "MYR",
    payment_method: receipt.payment_method || "",
    predicted_category: receipt.predicted_category || ""
  });
  // Debounce the input values to avoid excessive state updates
  const debouncedInputValues = useDebounce(inputValues, 500); // 500ms delay

  // State for confidence scores using ReceiptConfidence type
  const [editedConfidence, setEditedConfidence] = useState<ReceiptConfidence>(
    // Check if confidence_scores exists and is not null
    receipt.confidence_scores ?
      // If it's a string, try to parse it as JSON
      (typeof receipt.confidence_scores === 'string' ?
        JSON.parse(receipt.confidence_scores) : receipt.confidence_scores)
      : defaultConfidence
  );
  const [imageError, setImageError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFullTextData, setShowFullTextData] = useState(false);
  const [showProcessLogs, setShowProcessLogs] = useState(false);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(false);
  const [showPolygons, setShowPolygons] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(30);
  const [showDocumentStructure, setShowDocumentStructure] = useState(false);
  const [showVisualizationSettings, setShowVisualizationSettings] = useState(false);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  // Removed unused state: const [showAiSuggestions, setShowAiSuggestions] = useState(true);
  const [processLogs, setProcessLogs] = useState<ProcessingLog[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>(receipt.processing_status || null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const [imageSource, setImageSource] = useState("/placeholder.svg");
  const imageRef = useRef<HTMLImageElement>(null);

  // Define available expense categories
  const expenseCategories = [
    "Groceries", "Dining", "Transportation", "Utilities",
    "Entertainment", "Travel", "Shopping", "Healthcare",
    "Education", "Other"
  ];

  useEffect(() => {
    setEditedReceipt(receipt);
    // Initialize input values when receipt changes
    setInputValues({
      merchant: receipt.merchant || "",
      date: receipt.date || "",
      total: receipt.total || 0,
      tax: receipt.tax || 0,
      currency: receipt.currency || "MYR",
      payment_method: receipt.payment_method || "",
      predicted_category: receipt.predicted_category || ""
    });
    // Initialize/Update editedConfidence when receipt changes
    // Handle different formats of confidence_scores
    if (receipt.confidence_scores) {
      try {
        const confidenceData = typeof receipt.confidence_scores === 'string'
          ? JSON.parse(receipt.confidence_scores)
          : receipt.confidence_scores;
        setEditedConfidence(confidenceData);
      } catch (error) {
        console.error("Error parsing confidence scores:", error);
        setEditedConfidence(defaultConfidence);
      }
    } else {
      setEditedConfidence(defaultConfidence);
    }
    setProcessingStatus(receipt.processing_status || null);
  }, [receipt]);

  // Effect to update editedReceipt when debounced input values change
  useEffect(() => {
    // Validate currency before updating editedReceipt
    let validatedCurrency = debouncedInputValues.currency;

    // Ensure currency is a valid 3-letter code
    if (!validatedCurrency || !/^[A-Z]{3}$/i.test(validatedCurrency)) {
      validatedCurrency = 'MYR'; // Default to MYR if invalid
    } else {
      validatedCurrency = validatedCurrency.toUpperCase();
    }

    setEditedReceipt(prev => ({
      ...prev,
      merchant: debouncedInputValues.merchant,
      date: debouncedInputValues.date,
      total: debouncedInputValues.total,
      tax: debouncedInputValues.tax,
      currency: validatedCurrency,
      payment_method: debouncedInputValues.payment_method,
      predicted_category: debouncedInputValues.predicted_category
    }));

    // Update confidence scores for fields that have been edited
    // Only update confidence when the value has actually changed from the original receipt
    Object.entries(debouncedInputValues).forEach(([field, value]) => {
      // Special handling for currency field
      if (field === 'currency') {
        // Only update if the validated currency is different from the original
        if (validatedCurrency !== receipt.currency) {
          setEditedConfidence(prev => ({
            ...prev,
            [field]: 100 // Set confidence to 100% for edited fields
          }));

          // Only show the verification toast when the value has been debounced
          toast.success(`Currency verified`, {
            duration: 1500,
            position: 'bottom-right',
            icon: '✓'
          });
        }
      }
      // Handle other fields normally
      else if (field in defaultConfidence && value !== receipt[field as keyof typeof receipt]) {
        setEditedConfidence(prev => ({
          ...prev,
          [field]: 100 // Set confidence to 100% for edited fields
        }));

        // Only show the verification toast when the value has been debounced
        toast.success(`${field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ')} verified`, {
          duration: 1500,
          position: 'bottom-right',
          icon: '✓'
        });
      }
    });
  }, [debouncedInputValues, receipt]);

  // Subscribe to real-time updates for the receipt processing status
  useEffect(() => {
    if (!receipt.id) return;

    const statusChannel = supabase.channel(`receipt-status-${receipt.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'receipts',
          filter: `id=eq.${receipt.id}`
        },
        (payload) => {
          console.log('Receipt status update in viewer:', payload.new);
          const newStatus = payload.new.processing_status as ProcessingStatus;
          const newError = payload.new.processing_error;
          // Get potential confidence update from confidence_scores table via relation/trigger or separate fetch
          // Assuming confidence is not directly on the receipts table payload
          // const newConfidence = payload.new.confidence as ConfidenceScore;

          setProcessingStatus(newStatus);
          // Update confidence if it changed (e.g., after reprocessing)
          // This might require re-fetching the receipt data which includes confidence
          // if (!newConfidence) {
          //   // Potentially refetch to get latest confidence
          // } else {
          //   setEditedConfidence(prev => ({ ...defaultConfidence, ...newConfidence, receipt_id: receipt.id, id: newConfidence.id || prev.id }));
          // }

          if (newError) {
            toast.error(`Processing error: ${newError}`);
          } else if (newStatus === 'complete') {
            toast.success("Receipt processed successfully!");
            // Refresh data - this will also re-run the first useEffect to update confidence
            queryClient.invalidateQueries({ queryKey: ['receipt', receipt.id] });
          }
        }
      )
      .subscribe();

    // Clean up the subscription when component unmounts
    return () => {
      statusChannel.unsubscribe();
    };
  }, [receipt.id, queryClient]);

  // Add useEffect to check if image loads properly
  useEffect(() => {
    // Reset image error state when receipt changes
    setImageError(false);

    if (receipt.image_url) {
      // Track if component is still mounted
      let isMounted = true;

      // Use a placeholder initially
      setImageSource("/placeholder.svg");

      // Start loading with better error handling
      const loadImage = async () => {
        try {
          // Get properly formatted URL
          const formattedUrl = await getFormattedImageUrl(receipt.image_url);

          if (!isMounted) return;

          // Create a new image to test loading
          const img = new Image();

          // Set up load/error handlers
          img.onload = () => {
            if (isMounted) {
              setImageSource(formattedUrl);
              setImageError(false);
              // Update image dimensions for bounding box calculations
              setImageDimensions({
                width: img.width,
                height: img.height
              });
            }
          };

          img.onerror = () => {
            if (isMounted) {
              console.error("Error loading receipt image despite async formatting:", receipt.image_url);
              setImageError(true);
              setImageSource("/placeholder.svg");
            }
          };

          // Start loading
          img.src = formattedUrl;
        } catch (error) {
          if (isMounted) {
            console.error("Exception during image loading:", error);
            setImageError(true);
            setImageSource("/placeholder.svg");
          }
        }
      };

      loadImage();

      // Cleanup function
      return () => {
        isMounted = false;
      };
    }
  }, [receipt.image_url]);

  const updateMutation = useMutation({
    // Update mutation only handles the 'receipts' table update
    mutationFn: async () => {
      // Show a toast to indicate saving has started
      toast.loading("Saving receipt details...");

      try {
        // Format the date properly if it's a string
        let formattedDate = editedReceipt.date;
        if (typeof formattedDate === 'string' && formattedDate.includes('T')) {
          formattedDate = formattedDate.split('T')[0];
        }

        // Ensure line items are properly formatted
        const formattedLineItems = editedReceipt.lineItems?.map(item => ({
          description: item.description || '',
          amount: typeof item.amount === 'number' ? item.amount : parseFloat(item.amount) || 0
        }));

        // Log the data being sent to the server for debugging
        console.log("Sending data to updateReceipt:", {
          id: receipt.id,
          receipt: {
            merchant: editedReceipt.merchant,
            date: formattedDate,
            total: typeof editedReceipt.total === 'number' ? editedReceipt.total : parseFloat(editedReceipt.total) || 0,
            tax: typeof editedReceipt.tax === 'number' ? editedReceipt.tax : parseFloat(editedReceipt.tax) || 0,
            currency: editedReceipt.currency,
            payment_method: editedReceipt.payment_method,
            predicted_category: editedReceipt.predicted_category,
            status: "reviewed",
          },
          lineItems: formattedLineItems
        });

        return await updateReceipt(
          receipt.id,
          {
            merchant: editedReceipt.merchant,
            date: formattedDate,
            total: typeof editedReceipt.total === 'number' ? editedReceipt.total : parseFloat(editedReceipt.total) || 0,
            tax: typeof editedReceipt.tax === 'number' ? editedReceipt.tax : parseFloat(editedReceipt.tax) || 0,
            currency: editedReceipt.currency,
            payment_method: editedReceipt.payment_method,
            predicted_category: editedReceipt.predicted_category,
            status: "reviewed",
          },
          formattedLineItems
        );
      } catch (error) {
        console.error("Error preparing data for update:", error);
        toast.dismiss();
        toast.error("Failed to prepare data for update: " + (error.message || "Unknown error"));
        throw error;
      }
    },
    onSuccess: async () => {
      // Dismiss the loading toast
      toast.dismiss();

      // Show success message
      toast.success("Receipt updated successfully");

      // Invalidate the receipt query to force a refresh
      queryClient.invalidateQueries({ queryKey: ['receipt', receipt.id] });

      // Update the local state to reflect the changes
      // This ensures the UI shows the updated data immediately
      const updatedReceipt: ReceiptWithDetails = {
        ...receipt,
        merchant: editedReceipt.merchant,
        date: editedReceipt.date,
        total: editedReceipt.total,
        tax: editedReceipt.tax,
        currency: editedReceipt.currency,
        payment_method: editedReceipt.payment_method,
        predicted_category: editedReceipt.predicted_category,
        status: "reviewed",
        updated_at: new Date().toISOString()
      };

      // Force update the UI with the new data
      setEditedReceipt(updatedReceipt);

      // Notify parent component of the update
      if (onUpdate) {
        onUpdate(updatedReceipt);
      }

      // Save confidence scores as part of the receipt update
      // This is now handled by the update_receipt_final function
      // We're keeping this code for reference, but it's not needed anymore
      console.log("Confidence scores are now saved as part of the receipt update");

      // Update the local state to reflect the new confidence scores
      const confidenceToSave = {
        merchant: editedConfidence.merchant || 0,
        date: editedConfidence.date || 0,
        total: editedConfidence.total || 0,
        tax: editedConfidence.tax || 0,
        payment_method: editedConfidence.payment_method || 0,
        line_items: editedConfidence.line_items || 0,
      };

      console.log("Updated confidence scores:", confidenceToSave);

      // Invalidate queries to refetch data including updated confidence
      queryClient.invalidateQueries({ queryKey: ['receipt', receipt.id] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast.success("Receipt updated successfully!");

      // If the receipt was in a failed state, try to mark it as fixed
      if (processingStatus === 'failed_ocr' || processingStatus === 'failed_ai') {
        fixProcessingStatus(receipt.id);
      }
    },
    onError: (error: any) => {
      // Dismiss the loading toast
      toast.dismiss();

      console.error("Failed to update receipt:", error);

      // Provide more detailed error message
      let errorMessage = "Failed to update receipt";

      if (error.message) {
        errorMessage += ": " + error.message;
      } else if (error.code) {
        errorMessage += ` (Error code: ${error.code})`;
      }

      // Log additional details for debugging
      const errorObj = error as Record<string, any>;
      if (errorObj.details || errorObj.hint) {
        console.error("Additional error details:", {
          details: errorObj.details,
          hint: errorObj.hint
        });
      }

      toast.error(errorMessage);
    }
  });

  const reprocessMutation = useMutation({
    mutationFn: () => processReceiptWithOCR(receipt.id),
    onSuccess: (data) => {
      if (data) {
        // Invalidate query, the useEffect hook will handle state update
        queryClient.invalidateQueries({ queryKey: ['receipt', receipt.id] });
        toast.success("Receipt processed successfully!");
      }
    },
    onError: (error) => {
      console.error("Failed to process receipt:", error);
      toast.error("Failed to process receipt with OCR");
    }
  });

  const handleGenerateEmbeddings = async () => {
    if (!receipt?.id) return;
    
    setIsGeneratingEmbeddings(true);
    try {
      await generateEmbeddingsForReceipt(receipt.id);
      toast.success("Embeddings generated successfully");
    } catch (error) {
      console.error("Error generating embeddings:", error);
      toast.error("Failed to generate embeddings");
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  };

  const formatCurrency = (amount?: number | null) => {
    // Use a try-catch block to handle potential invalid currency codes
    try {
      // Validate currency code - must be 3 letters according to ISO 4217
      const currencyCode = /^[A-Z]{3}$/i.test(inputValues.currency) ?
        inputValues.currency.toUpperCase() : 'MYR';

      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
      }).format(amount || 0); // Handle potential null/undefined amount
    } catch (error) {
      // Fallback to MYR if there's any error
      console.error("Error formatting currency:", error);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'MYR',
      }).format(amount || 0);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    // Only update the inputValues state, which will be debounced
    setInputValues(prev => ({
      ...prev,
      [field]: value
    }));

    // The actual editedReceipt update and confidence score update
    // will happen in the useEffect that watches debouncedInputValues
  };

  const handleLineItemChange = (index: number, field: string, value: string | number) => {
    const updatedLineItems = [...(editedReceipt.lineItems || [])];
    // Ensure the item exists before updating
    if(updatedLineItems[index]) {
        updatedLineItems[index] = {
        ...updatedLineItems[index],
        [field]: value
      };

      setEditedReceipt(prev => ({
        ...prev,
        lineItems: updatedLineItems
      }));
      // Optionally set line_items confidence to 100 if any item is edited
      setEditedConfidence(prev => ({
        ...prev,
        line_items: 100
      }));
    }
  };

  const handleSaveChanges = () => {
    // Log what we're about to save for debugging
    console.log("Saving receipt details:", {
      id: receipt.id,
      merchant: editedReceipt.merchant,
      date: editedReceipt.date,
      total: editedReceipt.total,
      tax: editedReceipt.tax,
      currency: editedReceipt.currency,
      payment_method: editedReceipt.payment_method,
      predicted_category: editedReceipt.predicted_category,
      lineItems: editedReceipt.lineItems
    });

    // Validate required fields before saving
    if (!editedReceipt.merchant) {
      toast.error("Please enter a merchant name");
      return;
    }

    if (!editedReceipt.date) {
      toast.error("Please enter a date");
      return;
    }

    if (editedReceipt.total === undefined || editedReceipt.total === null) {
      toast.error("Please enter a total amount");
      return;
    }

    // Show a loading toast
    toast.loading("Saving receipt details...");

    // Proceed with the update
    updateMutation.mutate();

    // Removed optimistic update - we'll rely on the mutation's onSuccess callback
    // and query invalidation to update the UI after successful save
  };

  const handleAddLineItem = () => {
    const newLineItem: ReceiptLineItem = {
      id: `temp-${Date.now()}-${Math.random()}`, // Use random for better temp key
      receipt_id: receipt.id,
      description: "New item",
      amount: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setEditedReceipt(prev => ({
      ...prev,
      lineItems: [...(prev.lineItems || []), newLineItem]
    }));
     // Set line_items confidence to 100 when adding items
    setEditedConfidence(prev => ({
      ...prev,
      line_items: 100
    }));
  };

  const handleRemoveLineItem = (index: number) => {
    const updatedLineItems = [...(editedReceipt.lineItems || [])];
    updatedLineItems.splice(index, 1);

    setEditedReceipt(prev => ({
      ...prev,
      lineItems: updatedLineItems
    }));
     // Set line_items confidence to 100 when removing items
    setEditedConfidence(prev => ({
      ...prev,
      line_items: 100
    }));
  };

  // Removed Zoho sync functionality

  const handleReprocessReceipt = () => {
    if (isProcessing) return; // Prevent multiple simultaneous processing

    setIsProcessing(true); // Show loading state in confidence indicators

    // First set processing status to indicate starting OCR
    setProcessingStatus('processing_ocr');

    // Reset confidence scores temporarily to show loading state
    setEditedConfidence(prev => ({
      ...prev,
      merchant: 50,
      date: 50,
      total: 50,
      tax: 50,
      payment_method: 50,
      line_items: 50
    }));

    // Call the reprocess mutation
    reprocessMutation.mutate(undefined, {
      onSettled: () => {
        // Whether success or error, we're no longer processing
        setIsProcessing(false);
      }
    });
  };

  const handleToggleShowFullText = () => {
    setShowFullTextData(!showFullTextData);
  };

  const handleToggleProcessLogs = () => {
    setShowProcessLogs(!showProcessLogs);
  };

  // Subscribe to processing logs for this receipt
  useEffect(() => {
    if (!receipt?.id) return;

    // Fetch initial logs
    const fetchInitialLogs = async () => {
      const { data, error } = await supabase
        .from('processing_logs')
        .select('*')
        .eq('receipt_id', receipt.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching logs:', error);
      } else if (data) {
        setProcessLogs(data as ProcessingLog[]);
      }
    };

    fetchInitialLogs();

    // Set up realtime subscription
    const channel = supabase.channel(`receipt-logs-${receipt.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'processing_logs',
          filter: `receipt_id=eq.${receipt.id}`
        },
        (payload) => {
          const newLog = payload.new as ProcessingLog;
          console.log('New log received:', newLog);

          // Add new log to the list
          setProcessLogs((prev) => {
            // Check if we already have this log (avoid duplicates)
            if (prev.some(log => log.id === newLog.id)) {
              return prev;
            }
            // Add and sort by created_at
            return [...prev, newLog].sort((a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to processing logs');
        }
        if (err) {
          console.error('Error subscribing to logs:', err);
        }
      });

    // Clean up subscription on unmount
    return () => {
      channel.unsubscribe();
    };
  }, [receipt?.id]);

  // Function to format log timestamp
  const formatLogTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Function to get step color
  const getStepColor = (step: string | null) => {
    switch (step) {
      case 'START':
        return 'bg-blue-500';
      case 'FETCH':
        return 'bg-indigo-500';
      case 'OCR':
        return 'bg-purple-500';
      case 'EXTRACT':
        return 'bg-violet-500';
      case 'GEMINI':
        return 'bg-fuchsia-500';
      case 'SAVE':
        return 'bg-pink-500';
      case 'COMPLETE':
        return 'bg-green-500';
      case 'ERROR':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Function to accept an AI suggestion
  const handleAcceptSuggestion = (field: string, value: string | number) => {
    // Special handling for currency field
    if (field === 'currency' && typeof value === 'string') {
      // Validate currency code
      const validatedCurrency = /^[A-Z]{3}$/i.test(value) ?
        value.toUpperCase() : 'MYR';

      // Update with validated currency
      setInputValues(prev => ({
        ...prev,
        [field]: validatedCurrency
      }));
    } else {
      // Update the inputValues state for other fields, which will be debounced
      setInputValues(prev => ({
        ...prev,
        [field]: value
      }));
    }

    // Show a toast immediately for better UX
    toast.success(`Applied AI suggestion for ${field}`);

    // The actual editedReceipt update and confidence score update
    // will happen in the useEffect that watches debouncedInputValues
  };

  // Check if we have AI suggestions for a field
  const hasSuggestion = (field: string): boolean => {
    // Check specifically for the field in the suggestions object
    // Need to refine this check based on actual AISuggestions structure
    return !!(receipt.ai_suggestions && receipt.ai_suggestions[field as keyof AISuggestions]);
  };

  // Get suggestion for a field
  const getSuggestion = (field: string): string | number | null => {
    if (!receipt.ai_suggestions) return null;
    // Use keyof AISuggestions for type safety if structure is known
    return receipt.ai_suggestions[field as keyof AISuggestions] || null;
  };

  // Get suggestion confidence for a field
  const getSuggestionConfidence = (field: string): number => {
    // Confidence for suggestions might be structured differently, adjust as needed
    if (!receipt.ai_suggestions ||
        !receipt.ai_suggestions.confidence ||
        !receipt.ai_suggestions.confidence.suggestions) {
      return 0;
    }
    // Use keyof ConfidenceScore for type safety if suggestions map to these fields
    const suggestionField = field as keyof ConfidenceScore; // Adjust if suggestion keys differ
    // Assuming suggestions confidence structure matches ConfidenceScore fields
    return normalizeConfidence(receipt.ai_suggestions.confidence.suggestions[suggestionField]);
  };

  // Render a suggestion badge with acceptance button if available
  const renderSuggestion = (field: string, label: string) => {
    if (!hasSuggestion(field)) return null;

    const suggestion = getSuggestion(field);
    const confidence = getSuggestionConfidence(field);

    // Only render if there is a suggestion value
    if (suggestion === null || suggestion === undefined || suggestion === '') return null;

    return (
      <div className="mt-1 flex items-center gap-2">
        <Badge
          variant="outline"
          className={`flex items-center gap-1 ${
            confidence >= 80 ? 'border-green-500 text-green-700' :
            confidence >= 60 ? 'border-yellow-500 text-yellow-700' :
            'border-red-500 text-red-700'
          }`}
        >
          <Sparkles size={12} />
          <span>Suggested {label}: {suggestion.toString()}</span>
          <span className="text-xs opacity-70">({confidence}%)</span> {/* Show suggestion confidence */}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full"
          onClick={() => handleAcceptSuggestion(field, suggestion)}
          title={`Accept suggestion (${confidence}% confidence)`}
        >
          <Check size={14} className="text-green-600" />
        </Button>
      </div>
    );
  };

  // Add category change handler
  const handleCategoryChange = (value: string) => {
    // Only update the inputValues state, which will be debounced
    setInputValues(prev => ({
      ...prev,
      predicted_category: value
    }));
    // The actual editedReceipt update will happen in the useEffect that watches debouncedInputValues
  };

  // Function to handle field hover for bounding box highlighting
  const handleFieldHover = (field: string | null) => {
    if (showBoundingBoxes) {
      setHighlightedField(field);
    }
  };

  // Toggle bounding box visualization
  const toggleBoundingBoxes = () => {
    const newValue = !showBoundingBoxes;
    setShowBoundingBoxes(newValue);

    if (newValue) {
      // When enabling, update image dimensions if they're not set
      if (imageDimensions.width === 0 && imageRef.current) {
        setImageDimensions({
          width: imageRef.current.naturalWidth,
          height: imageRef.current.naturalHeight
        });
      }

      // Show visualization settings when enabling bounding boxes
      setShowVisualizationSettings(true);
    } else {
      // When disabling, clear highlighted field and hide settings
      setHighlightedField(null);
      setHighlightedBlockId(null);
      setShowVisualizationSettings(false);
      setShowDocumentStructure(false);
    }
  };

  // Toggle document structure viewer
  const toggleDocumentStructure = () => {
    setShowDocumentStructure(!showDocumentStructure);
  };

  // Toggle visualization settings panel
  const toggleVisualizationSettings = () => {
    setShowVisualizationSettings(!showVisualizationSettings);
  };

  // Handle block selection from document structure viewer
  const handleSelectBlock = (blockId: string) => {
    setHighlightedBlockId(blockId);
    // TODO: Implement highlighting the selected block in the image
    toast.info(`Selected block: ${blockId}`);
  };

  // Add helper to render processing status indicator
  const renderProcessingStatus = () => {
    // Use processingStatus state, not receipt.processing_status
    const currentStatus = processingStatus;

    // Don't render anything if complete
    if (!currentStatus || currentStatus === 'complete') return null;

    let statusText = 'Processing...';
    let icon = <Loader2 className="h-4 w-4 animate-spin mr-2" />;
    let colorClass = 'bg-blue-500';

    switch (currentStatus) {
      case 'uploading':
        statusText = 'Uploading...';
        colorClass = 'bg-blue-500';
        break;
      case 'uploaded':
        statusText = 'Preparing for OCR...';
        colorClass = 'bg-indigo-500';
        break;
      case 'processing_ocr':
        statusText = 'Running OCR...';
        colorClass = 'bg-violet-500';
        break;
      case 'processing_ai':
        statusText = 'AI Analysis...';
        colorClass = 'bg-purple-500';
        break;
      case 'failed_ocr':
        statusText = 'OCR Failed';
        icon = <AlertTriangle className="h-4 w-4 mr-2" />;
        colorClass = 'bg-red-500';
        break;
      case 'failed_ai':
        statusText = 'AI Analysis Failed';
        icon = <AlertTriangle className="h-4 w-4 mr-2" />;
        colorClass = 'bg-red-500';
        break;
    }

    // Check if there's a processing error message
    const hasErrorDetails = receipt.processing_error && receipt.processing_error.length > 0;
    const isResourceLimitError = hasErrorDetails &&
      (receipt.processing_error.includes("WORKER_LIMIT") ||
       receipt.processing_error.includes("compute resources") ||
       receipt.processing_error.includes("too complex to process"));

    return (
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-white ${colorClass} flex items-center`}>
            {icon}
            {statusText}
          </Badge>
          {(currentStatus === 'failed_ocr' || currentStatus === 'failed_ai') && (
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => fixProcessingStatus(receipt.id)}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Mark as fixed
            </Button>
          )}

          {(currentStatus === 'failed_ocr' || currentStatus === 'failed_ai') && (
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => reprocessMutation.mutate()}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Try Again
            </Button>
          )}
        </div>

        {/* Show error details if available */}
        {hasErrorDetails && (
          <div className={`text-sm px-3 py-2 rounded-md ${isResourceLimitError ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
            {isResourceLimitError ? (
              <>
                <p className="font-medium">Resource Limit Exceeded</p>
                <p>The receipt image is too complex or large to process with the current resources.</p>
                <p className="mt-1">Try one of these solutions:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>Use a smaller or clearer image (we now support up to 5MB)</li>
                  <li>Try the OCR+AI method if AI Vision encounters issues</li>
                  <li>Manually enter the receipt details</li>
                </ul>
              </>
            ) : (
              <p>{receipt.processing_error}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Add delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!receipt.id) throw new Error("No receipt ID provided");

      // Delete the image from storage first
      if (receipt.image_url) {
        const fileName = receipt.image_url.split('/').pop();
        if (fileName) {
          const { error: storageError } = await supabase.storage
            .from('receipt_images')
            .remove([fileName]);

          if (storageError) {
            console.error("Error deleting image from storage:", storageError);
            throw storageError;
          }
        }
      }

      // Then delete the receipt record
      const { error: dbError } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receipt.id);

      if (dbError) {
        console.error("Error deleting receipt record:", dbError);
        throw dbError;
      }
    },
    onSuccess: () => {
      toast.success("Receipt deleted successfully");
      if (onDelete) onDelete(receipt.id); // Notify parent
      // Note: Do not close modal or navigate; let parent handle state
    },
    onError: (error) => {
      console.error("Failed to delete receipt:", error);
      toast.error("Failed to delete receipt");
    }
  });

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 h-full min-h-screen md:min-h-0">{/* Optimized for mobile scrolling */}
      {/* Image and controls column */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card p-4 flex flex-col w-full md:w-1/2 h-auto md:h-full min-h-[400px] md:min-h-0 flex-shrink-0"
      >
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-medium">Receipt Image</h3>
            {renderProcessingStatus()}
          </div>
          <div className="flex-1 min-h-0 overflow-auto rounded-lg relative bg-secondary/30">
            {processingStatus && !['complete', 'failed_ocr', 'failed_ai'].includes(processingStatus) && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 pointer-events-none">
                <div className="bg-black/70 rounded-lg p-4 text-white flex flex-col items-center">
                  <Loader2 size={40} className="animate-spin mb-2" />
                  <span className="text-lg font-medium">
                    {processingStatus === 'uploading' && 'Uploading Receipt...'}
                    {processingStatus === 'uploaded' && 'Preparing for OCR...'}
                    {processingStatus === 'processing_ocr' && 'Running OCR...'}
                    {processingStatus === 'processing_ai' && 'AI Analysis...'}
                  </span>
                </div>
              </div>
            )}
            {receipt.image_url && !imageError ? (
              <div className="w-full h-full">
                <TransformWrapper
                  initialScale={1}
                  minScale={0.1}
                  maxScale={8}
                  centerOnInit={true}
                  limitToBounds={false}
                  smooth={true}
                  wheel={{ smoothStep: 0.04 }}
                  pinch={{ step: 5 }}
                >
                  {({ zoomIn, zoomOut, resetTransform, setTransform, instance }) => {
                    // Create a compatible transform state object that our overlay can use
                    const transformState = instance ? {
                      scale: instance.transformState.scale,
                      positionX: instance.transformState.positionX,
                      positionY: instance.transformState.positionY
                    } : undefined;

                    return (
                      <>
                        <div className="absolute top-2 right-2 z-10 flex flex-wrap gap-2">
                          <div className="flex gap-1">
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                              onClick={() => zoomIn()}
                              title="Zoom In"
                            >
                              <ZoomIn size={16} />
                            </Button>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                              onClick={() => zoomOut()}
                              title="Zoom Out"
                            >
                              <ZoomOut size={16} />
                            </Button>
                          </div>

                          <div className="flex gap-1">
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                              onClick={() => {
                                const newRotation = (rotation - 90) % 360;
                                setRotation(newRotation);
                                setTransform(0, 0, 1);
                              }}
                              title="Rotate Left"
                            >
                              <RotateCcw size={16} />
                            </Button>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                              onClick={() => {
                                const newRotation = (rotation + 90) % 360;
                                setRotation(newRotation);
                                setTransform(0, 0, 1);
                              }}
                              title="Rotate Right"
                            >
                              <RotateCw size={16} />
                            </Button>
                          </div>

                          <div className="flex gap-1">
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                              onClick={() => {
                                resetTransform();
                                setRotation(0);
                              }}
                              title="Reset View"
                            >
                              <RotateCw size={16} />
                            </Button>
                          </div>

                          <div className="flex gap-1">
                            <Button
                              variant="secondary"
                              size="icon"
                              className={`h-8 w-8 bg-background/80 backdrop-blur-sm ${showBoundingBoxes ? 'text-primary' : ''}`}
                              onClick={toggleBoundingBoxes}
                              title={showBoundingBoxes ? "Hide Bounding Boxes" : "Show Bounding Boxes"}
                            >
                              {showBoundingBoxes ? <Eye size={16} /> : <Layers size={16} />}
                            </Button>

                            {showBoundingBoxes && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className={`h-8 w-8 bg-background/80 backdrop-blur-sm ${showVisualizationSettings ? 'text-primary' : ''}`}
                                  onClick={toggleVisualizationSettings}
                                  title="Visualization Settings"
                                >
                                  <Settings size={16} />
                                </Button>

                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className={`h-8 w-8 bg-background/80 backdrop-blur-sm ${showDocumentStructure ? 'text-primary' : ''}`}
                                  onClick={toggleDocumentStructure}
                                  title="Document Structure"
                                  disabled={!receipt.document_structure || !receipt.document_structure.blocks || receipt.document_structure.blocks.length === 0}
                                >
                                  <Bug size={16} />
                                </Button>
                              </>
                            )}
                          </div>

                          <div className="flex gap-1">
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = imageSource; // Use the already processed image URL from state
                                link.download = `receipt-${receipt.id}.jpg`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              title="Download Image"
                            >
                              <Download size={16} />
                            </Button>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-red-500/10 hover:text-red-500"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this receipt? This action cannot be undone.')) {
                                  deleteMutation.mutate();
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              title="Delete Receipt"
                            >
                              {deleteMutation.isPending ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </Button>
                          </div>
                        </div>
                        <TransformComponent
                          wrapperClass="w-full h-full"
                          contentClass="w-full h-full"
                        >
                          <div className="relative w-full h-full">
                            <img
                              ref={imageRef}
                              src={imageSource}
                              alt={`Receipt from ${editedReceipt.merchant || 'Unknown Merchant'}`}
                              className="receipt-image w-full h-full object-contain transition-transform"
                              style={{ transform: `rotate(${rotation}deg)` }}
                              onError={() => setImageError(true)}
                              onLoad={(e) => {
                                const img = e.currentTarget;
                                setImageDimensions({
                                  width: img.naturalWidth,
                                  height: img.naturalHeight
                                });
                              }}
                            />
                            {/* Bounding Box Overlay */}
                            {showBoundingBoxes && (
                              <BoundingBoxOverlay
                                fieldGeometry={receipt.field_geometry || {}}
                                lineItems={editedReceipt.lineItems}
                                imageWidth={imageDimensions.width}
                                imageHeight={imageDimensions.height}
                                visible={showBoundingBoxes}
                                highlightedField={highlightedField}
                                confidenceScores={typeof editedConfidence === 'object' ? editedConfidence : undefined}
                                showPolygons={showPolygons}
                                debugMode={debugMode}
                                transformState={transformState}
                                confidenceThreshold={confidenceThreshold}
                                imageRef={imageRef}
                              />
                            )}
                          </div>
                        </TransformComponent>
                      </>
                    );
                  }}
                </TransformWrapper>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground p-4 h-full">
                {imageError ? (
                  <>
                    <AlertTriangle size={64} className="mb-4 text-amber-500" />
                    <p className="text-center mb-2">Failed to load receipt image</p>
                    <p className="text-xs text-center text-muted-foreground mb-4">
                      The image URL may be invalid or the image may no longer exist.
                    </p>
                    <p className="text-xs break-all text-muted-foreground mb-4">
                      URL: {imageSource || "No URL provided"}
                    </p>
                  </>
                ) : (
                  <>
                    <Receipt size={64} className="mb-4 opacity-30" />
                    <p>No receipt image available</p>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="mt-4 flex-grow flex flex-col gap-4 min-h-0">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleReprocessReceipt}
              disabled={isProcessing || !receipt.image_url || (processingStatus && !['failed_ocr', 'failed_ai', 'complete'].includes(processingStatus))}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RotateCw size={16} />
                  Reprocess with OCR
                </>
              )}
            </Button>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart2 size={16} className="text-muted-foreground" />
                <span className="text-sm">Processing Logs</span>
              </div>
              <Switch
                checked={showProcessLogs}
                onCheckedChange={handleToggleProcessLogs}
              />
            </div>

            {showProcessLogs && (
              <ScrollArea className="h-[200px] rounded-md border flex-shrink-0">
                {processLogs.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No processing logs available
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    {processLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-xs">
                        <div className="min-w-[60px] text-muted-foreground">
                          {formatLogTime(log.created_at)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {log.step_name && (
                              <Badge
                                variant="outline"
                                className={`px-1.5 py-0 text-[10px] ${getStepColor(log.step_name)} text-white`}
                              >
                                {log.step_name}
                              </Badge>
                            )}
                            <span>{log.status_message}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}

            {receipt.fullText && (
              <div className="mt-auto">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleToggleShowFullText}
                >
                  {showFullTextData ? "Hide Raw OCR Text" : "Show Raw OCR Text"}
                </Button>

                {showFullTextData && (
                  <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm max-h-[150px] overflow-auto whitespace-pre-wrap">
                      {receipt.fullText}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Receipt details column */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="glass-card p-4 flex flex-col w-full md:w-1/2 h-auto md:h-full min-h-[600px] md:min-h-0 md:overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h3 className="font-medium">Receipt Details</h3>
        </div>

        {editedReceipt.processing_time !== undefined && editedReceipt.processing_time !== null && editedReceipt.processing_time > 0 && (
          <div className="text-sm text-muted-foreground mb-4 flex-shrink-0">
            Processing Time: {editedReceipt.processing_time.toFixed(2)} seconds
          </div>
        )}

        <div className="flex-grow pr-3 min-h-0 overflow-auto">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="merchant">Merchant</Label>
                  <ConfidenceIndicator score={editedConfidence?.merchant} loading={isProcessing} />
                </div>
                <Input
                  id="merchant"
                  value={inputValues.merchant}
                  onChange={(e) => handleInputChange('merchant', e.target.value)}
                  className="bg-background/50"
                  onMouseEnter={() => handleFieldHover('merchant')}
                  onMouseLeave={() => handleFieldHover(null)}
                />
                {renderSuggestion('merchant', 'merchant name')}
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between">
                   <Label htmlFor="category">Category</Label>
                 </div>
                <Select
                  value={inputValues.predicted_category}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger id="category" className="bg-background/50">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {renderSuggestion('predicted_category', 'category')}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="date">Date</Label>
                     <ConfidenceIndicator score={editedConfidence?.date} loading={isProcessing} />
                  </div>
                  <div className="relative">
                    <Input
                      id="date"
                      type="date"
                      value={typeof inputValues.date === 'string' ? inputValues.date.split('T')[0] : ''}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      className="bg-background/50 pl-9"
                      onMouseEnter={() => handleFieldHover('date')}
                      onMouseLeave={() => handleFieldHover(null)}
                    />
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary dark:text-primary" />
                  </div>
                  {renderSuggestion('date', 'date')}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="total">Total Amount</Label>
                     <ConfidenceIndicator score={editedConfidence?.total} loading={isProcessing} />
                  </div>
                  <div className="relative">
                    <Input
                      id="total"
                      type="number"
                      step="0.01"
                      value={inputValues.total || 0}
                      onChange={(e) => handleInputChange('total', parseFloat(e.target.value) || 0)}
                      className="bg-background/50 pl-9"
                      onMouseEnter={() => handleFieldHover('total')}
                      onMouseLeave={() => handleFieldHover(null)}
                    />
                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-blue-200" />
                  </div>
                  {renderSuggestion('total', 'total amount')}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="currency">Currency</Label>
                  </div>
                  <Input
                    id="currency"
                    value={inputValues.currency}
                    onChange={(e) => {
                      // Only allow letters and limit to 3 characters
                      const value = e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 3);
                      handleInputChange('currency', value.toUpperCase());
                    }}
                    className="bg-background/50"
                    maxLength={3}
                    placeholder="MYR"
                  />
                   {renderSuggestion('currency', 'currency')}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                     <ConfidenceIndicator score={editedConfidence?.payment_method} loading={isProcessing} />
                  </div>
                  <div className="relative">
                    <Input
                      id="paymentMethod"
                      value={inputValues.payment_method}
                      onChange={(e) => handleInputChange('payment_method', e.target.value)}
                      className="bg-background/50 pl-9"
                      onMouseEnter={() => handleFieldHover('payment_method')}
                      onMouseLeave={() => handleFieldHover(null)}
                    />
                    <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-blue-200" />
                  </div>
                   {renderSuggestion('payment_method', 'payment method')}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Label>Line Items</Label>
                     <ConfidenceIndicator score={editedConfidence?.line_items} loading={isProcessing} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 h-7"
                      onClick={() => handleFieldHover('line_items')}
                      onMouseLeave={() => handleFieldHover(null)}
                      onBlur={() => handleFieldHover(null)}
                    >
                      <Layers size={14} />
                      Highlight
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 h-7"
                      onClick={handleAddLineItem}
                    >
                      <Plus size={14} />
                      Add Item
                    </Button>
                  </div>
                </div>

                <Card className="bg-background/50 border border-border/50">
                  <div className="p-3 max-h-[250px] overflow-auto">
                    <div className="space-y-2">
                        {editedReceipt.lineItems && editedReceipt.lineItems.length > 0 ? (
                        editedReceipt.lineItems.map((item, index) => (
                            <div
                            key={item.id || `temp-${index}`}
                            className="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
                            >
                            <Input
                                value={item.description || ""}
                                onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                                className="bg-transparent border-0 focus-visible:ring-0 px-0 text-sm flex-1 mr-2"
                                placeholder="Item description"
                            />
                            <div className="flex items-center gap-2">
                                <Input
                                type="number"
                                step="0.01"
                                value={item.amount || 0}
                                onChange={(e) => handleLineItemChange(index, 'amount', parseFloat(e.target.value) || 0)}
                                className="bg-transparent border-0 focus-visible:ring-0 px-0 text-sm text-right w-24"
                                placeholder="Amount"
                                />
                                <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveLineItem(index)}
                                >
                                <Minus size={14} />
                                </Button>
                            </div>
                            </div>
                        ))
                        ) : (
                        <div className="py-6 text-center text-muted-foreground">
                            <Receipt size={24} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No line items detected</p>
                        </div>
                        )}
                    </div>
                  </div>
                </Card>
              </div>

              <div className="pt-4 border-t border-border/50">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency((editedReceipt.total || 0) - (editedReceipt.tax || 0))}</span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Tax:</span>
                     <ConfidenceIndicator score={editedConfidence?.tax} loading={isProcessing} />
                  </div>
                  <div className="relative w-24">
                    <Input
                      type="number"
                      step="0.01"
                      value={inputValues.tax || 0}
                      onChange={(e) => handleInputChange('tax', parseFloat(e.target.value) || 0)}
                      className="bg-transparent border-0 focus-visible:ring-0 px-0 text-sm text-right"
                      placeholder="Tax"
                      onMouseEnter={() => handleFieldHover('tax')}
                      onMouseLeave={() => handleFieldHover(null)}
                    />
                  </div>
                   {renderSuggestion('tax', 'tax amount')}
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-center font-semibold mt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(editedReceipt.total || 0)}</span>
                </div>
              </div>
            </div>
        </div>

        <div className="pt-4 mt-auto flex justify-between flex-shrink-0">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsHistoryModalOpen(true)}
          >
            <History size={16} />
            View History
          </Button>
          <Button
            variant="default"
            onClick={handleSaveChanges}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Saving...
              </>
            ) : "Save Changes"}
          </Button>
        </div>

        {/* Move Similar Receipts to the bottom */}
        <div className="mt-6 mb-4">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full flex justify-between items-center p-2">
                <span>Similar Receipts</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-2">
                <SimilarReceipts
                  receiptId={receipt.id}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </motion.div>

      {/* Visualization Settings Panel */}
      {showVisualizationSettings && showBoundingBoxes && (
        <div className="fixed right-4 top-20 z-50 w-64 shadow-lg">
          <VisualizationSettings
            showBoundingBoxes={showBoundingBoxes}
            setShowBoundingBoxes={setShowBoundingBoxes}
            showPolygons={showPolygons}
            setShowPolygons={setShowPolygons}
            debugMode={debugMode}
            setDebugMode={setDebugMode}
            confidenceThreshold={confidenceThreshold}
            setConfidenceThreshold={setConfidenceThreshold}
          />
        </div>
      )}

      {/* Document Structure Viewer */}
      {showDocumentStructure && showBoundingBoxes && (
        <div className="fixed right-4 top-80 z-50 w-80 h-96 shadow-lg">
          <DocumentStructureViewer
            documentStructure={receipt.document_structure || { blocks: [], page_dimensions: { width: 0, height: 0 } }}
            onSelectBlock={handleSelectBlock}
          />
        </div>
      )}

      <ReceiptHistoryModal
        receiptId={receipt.id}
        processingLogs={processLogs}
        open={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
      />
    </div>
  );
}
