import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Calendar, CreditCard, DollarSign, Plus, Minus, Receipt, Send, RotateCw, RotateCcw, ZoomIn, ZoomOut, History, Loader2, AlertTriangle, BarChart2, Check, Sparkles, Tag, Download, Trash2, Upload } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ReceiptWithDetails, ReceiptLineItem, ProcessingLog, AISuggestions, ProcessingStatus } from "@/types/receipt";
import { updateReceipt, processReceiptWithOCR, logCorrections, fixProcessingStatus } from "@/services/receiptService";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ViewHistoryButton } from "@/components/receipt/ViewHistoryButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReceiptViewerProps {
  receipt: ReceiptWithDetails;
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

export default function ReceiptViewer({ receipt }: ReceiptViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [editedReceipt, setEditedReceipt] = useState(receipt);
  // State for confidence scores using ReceiptConfidence type
  const [editedConfidence, setEditedConfidence] = useState<ReceiptConfidence>(receipt.confidence_scores || defaultConfidence);
  const [imageError, setImageError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFullTextData, setShowFullTextData] = useState(false);
  const [showProcessLogs, setShowProcessLogs] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(true);
  const [processLogs, setProcessLogs] = useState<ProcessingLog[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>(receipt.processing_status || null);
  const queryClient = useQueryClient();
  
  // Define available expense categories
  const expenseCategories = [
    "Groceries", "Dining", "Transportation", "Utilities", 
    "Entertainment", "Travel", "Shopping", "Healthcare", 
    "Education", "Other"
  ];
  
  useEffect(() => {
    setEditedReceipt(receipt);
    // Initialize/Update editedConfidence when receipt changes
    setEditedConfidence(receipt.confidence_scores || defaultConfidence);
    setProcessingStatus(receipt.processing_status || null);
  }, [receipt]);
  
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
      const img = new Image();
      img.src = getFormattedImageUrl(receipt.image_url);
      
      img.onload = () => {
        setImageError(false);
      };
      
      img.onerror = () => {
        console.error("Error loading receipt image:", receipt.image_url);
        setImageError(true);
      };
    }
  }, [receipt.image_url]);
  
  const updateMutation = useMutation({
    // Update mutation only handles the 'receipts' table update
    mutationFn: () => updateReceipt(
      receipt.id,
      {
        merchant: editedReceipt.merchant,
        date: editedReceipt.date,
        total: editedReceipt.total,
        tax: editedReceipt.tax,
        currency: editedReceipt.currency,
        payment_method: editedReceipt.payment_method,
        predicted_category: editedReceipt.predicted_category,
        status: "reviewed",
        // Update confidence scores directly on the receipt object
        confidence_scores: editedConfidence
      },
      editedReceipt.lineItems?.map(item => ({
        description: item.description,
        amount: item.amount
      }))
    ),
    onSuccess: async () => {
      // No need for separate confidence table update - we now store it in the receipt

      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['receipt', receipt.id] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast.success("Receipt updated successfully!");

      // If the receipt was in a failed state, try to mark it as fixed
      if (processingStatus === 'failed_ocr' || processingStatus === 'failed_ai') {
        fixProcessingStatus(receipt.id);
      }
    },
    onError: (error) => {
      console.error("Failed to update receipt:", error);
      toast.error("Failed to update receipt");
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
  
  const formatCurrency = (amount?: number | null) => {
    // Use editedReceipt for currency preference if available
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: editedReceipt.currency || 'MYR',
    }).format(amount || 0); // Handle potential null/undefined amount
  };
  
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };
  
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };
  
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };
  
  const handleInputChange = (field: string, value: string | number) => {
    setEditedReceipt(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Update confidence scores in state when user edits a field
    // Check if the field is a valid field on our ReceiptConfidence type
    if (field in defaultConfidence) {
      setEditedConfidence(prev => ({
        ...prev,
        [field]: 100 // Set confidence to 100%
      }));
      
      // Show visual feedback that the field has been verified
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ')} verified`, {
        duration: 1500,
        position: 'bottom-right',
        icon: '✓'
      });
    }
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
    updateMutation.mutate();
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
  
  const handleSyncToZoho = () => {
    updateReceipt(receipt.id, { status: "synced" })
      .then(() => {
        toast.success("Receipt synced to Zoho successfully!");
        queryClient.invalidateQueries({ queryKey: ['receipt', receipt.id] });
        queryClient.invalidateQueries({ queryKey: ['receipts'] });
      })
      .catch(() => {
        toast.error("Failed to sync with Zoho");
      });
  };
  
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

  // Function to format image URL if needed
  const getFormattedImageUrl = (url: string | undefined) => {
    if (!url) return "";
    
    console.log("Original URL:", url);
    
    // For local development or testing with placeholder
    if (url.startsWith('/')) {
      console.log("Local URL detected, returning as is");
      return url;
    }
    
    try {
      // Check if the URL is already a complete Supabase URL
      if (url.includes('supabase.co') && url.includes('/storage/v1/object/')) {
        // If it already has public/ in the path, return as is
        if (url.includes('/public/')) {
          console.log("Complete Supabase URL with public path detected, returning as is");
          return url;
        }
        // Add 'public/' to the path if it's missing
        const formatted = url.replace('/object/', '/object/public/');
        console.log("Added public/ to Supabase URL:", formatted);
        return formatted;
      }
      
      // Special case: URL contains another Supabase URL inside it
      if (url.includes('receipt_images/https://')) {
        console.log("Detected nested Supabase URL with receipt_images prefix");
        // Extract the actual URL after receipt_images/
        const actualUrl = url.substring(url.indexOf('receipt_images/') + 'receipt_images/'.length);
        console.log("Extracted actual URL:", actualUrl);
        
        // Recursively call this function with the extracted URL
        return getFormattedImageUrl(actualUrl);
      }
      
      // Another special case: URL might have two supabase.co domains (duplicated URL)
      if ((url.match(/supabase\.co/g) || []).length > 1) {
        console.log("Detected multiple Supabase domains in URL");
        // Find where the second URL starts (likely after the first one)
        const secondUrlStart = url.indexOf('https://', url.indexOf('supabase.co') + 1);
        if (secondUrlStart !== -1) {
          const actualUrl = url.substring(secondUrlStart);
          console.log("Extracted second URL:", actualUrl);
          return getFormattedImageUrl(actualUrl);
        }
      }
      
      // Check if the URL is a full URL that doesn't need processing
      if (url.startsWith('http') && !url.includes('receipt_images/')) {
        console.log("Full URL that doesn't need processing detected, returning as is");
        return url;
      }
      
      // Handle relative paths that might be just storage keys
      if (!url.includes('supabase.co')) {
        // Check if this looks like a UUID-based path
        if (url.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/.*$/i)) {
          console.log("Detected UUID-based file path");
          const { data } = supabase.storage
            .from('receipt_images')
            .getPublicUrl(url);
          
          console.log("Generated publicUrl from UUID path:", data?.publicUrl);
          return data?.publicUrl || url;
        }
        
        // Extract just the filename if there's a path
        const fileName = url.includes('/') 
          ? url.substring(url.lastIndexOf('/') + 1) 
          : url.replace('receipt_images/', '');
          
        console.log("Processing as storage key, extracted filename:", fileName);
        
        const { data } = supabase.storage
          .from('receipt_images')
          .getPublicUrl(fileName);
        
        console.log("Generated publicUrl:", data?.publicUrl);
        return data?.publicUrl || url;
      }
      
      console.log("URL didn't match any formatting rules, returning as is");
      return url;
    } catch (error) {
      console.error("Error formatting image URL:", error);
      return url; // Return original URL on error
    }
  };

  // Function to accept an AI suggestion
  const handleAcceptSuggestion = (field: string, value: string | number) => {
    setEditedReceipt(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Also update confidence to 100% when accepting AI suggestion  
    if (field in defaultConfidence) {
      setEditedConfidence(prev => ({
        ...prev,
        [field]: 100
      }));
    }

    toast.success(`Applied AI suggestion for ${field}`);
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
    setEditedReceipt(prev => ({
      ...prev,
      predicted_category: value
    }));
     // Category confidence is not directly part of ConfidenceScore, handle separately if needed
    // setEditedConfidence(prev => ({
    //   ...prev,
    //   predicted_category: 100 // This field might not exist on ConfidenceScore type
    // }));
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
    
    return (
      <div className="mb-4 flex items-center gap-2">
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
      // Redirect to dashboard
      window.location.href = '/';
    },
    onError: (error) => {
      console.error("Failed to delete receipt:", error);
      toast.error("Failed to delete receipt");
    }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card p-4 overflow-hidden flex flex-col" // Use flex column
      >
        <div className="flex justify-between items-start mb-3"> {/* items-start */}
          <h3 className="font-medium">Receipt Image</h3>
           {/* Moved status indicator to here */}
           {renderProcessingStatus()}
        </div>
        
        <div className="overflow-hidden h-[500px] rounded-lg relative bg-secondary/30 flex-shrink-0"> {/* Added flex-shrink-0 */}
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
                {({ zoomIn, zoomOut, resetTransform, setTransform }) => (
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
                          className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = getFormattedImageUrl(receipt.image_url);
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
                      <img
                        src={getFormattedImageUrl(receipt.image_url)}
                        alt={`Receipt from ${editedReceipt.merchant || 'Unknown Merchant'}`}
                        className="receipt-image w-full h-full object-contain transition-transform"
                        style={{ transform: `rotate(${rotation}deg)` }}
                        onError={() => setImageError(true)}
                      />
                    </TransformComponent>
                  </>
                )}
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
                    URL: {getFormattedImageUrl(receipt.image_url) || "No URL provided"}
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
        
        {/* Controls and Logs section */}
        <div className="mt-4 flex-grow flex flex-col gap-4"> {/* Added flex-grow */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleReprocessReceipt}
            // Disable if processing, no image, or already complete/failed (user should save changes first or mark as fixed)
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
            <ScrollArea className="h-[200px] rounded-md border flex-shrink-0"> {/* Added flex-shrink-0 */}
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
            <div className="mt-auto"> {/* Push Raw Text to bottom */}
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleToggleShowFullText}
              >
                {showFullTextData ? "Hide Raw OCR Text" : "Show Raw OCR Text"}
              </Button>

              {showFullTextData && (
                <ScrollArea className="mt-2 p-3 bg-muted/50 rounded-md text-sm max-h-[150px] whitespace-pre-wrap"> {/* Max height */}
                    {receipt.fullText}
                </ScrollArea>
              )}
            </div>
          )}

        </div>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="glass-card p-4 flex flex-col" // Use flex column
      >
        <div className="flex justify-between items-center mb-4 flex-shrink-0"> {/* Added flex-shrink-0 */}
          <h3 className="font-medium">Receipt Details</h3>
          <Button
            onClick={handleSyncToZoho}
            className="gap-2"
            disabled={editedReceipt.status === "synced"} // Use editedReceipt status
          >
            <Send size={16} />
            {editedReceipt.status === "synced" ? "Synced to Zoho" : "Sync to Zoho"}
          </Button>
        </div>

        {/* Display Processing Time */}
        {editedReceipt.processing_time !== undefined && editedReceipt.processing_time !== null && editedReceipt.processing_time > 0 && (
          <div className="text-sm text-muted-foreground mb-4 flex-shrink-0"> {/* Added flex-shrink-0 */}
            Processing Time: {editedReceipt.processing_time.toFixed(2)} seconds
          </div>
        )}

        {/* Scrollable Form Area */}
        <ScrollArea className="flex-grow pr-3"> {/* Added flex-grow */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="merchant">Merchant</Label>
                  {/* Use ConfidenceIndicator with loading state */}
                  <ConfidenceIndicator score={editedConfidence?.merchant} loading={isProcessing} />
                </div>
                <Input
                  id="merchant"
                  value={editedReceipt.merchant || ""}
                  onChange={(e) => handleInputChange('merchant', e.target.value)}
                  className="bg-background/50"
                />
                {renderSuggestion('merchant', 'merchant name')}
              </div>

              {/* Add Category Selector */}
              <div className="space-y-2">
                 <div className="flex justify-between">
                   <Label htmlFor="category">Category</Label>
                    {/* Category confidence might not be tracked in ConfidenceScore table directly */}
                    {/* <ConfidenceIndicator score={editedConfidence?.predicted_category} /> */}
                 </div>
                <Select
                  value={editedReceipt.predicted_category || ""}
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
                {/* Render suggestion for category */}
                {renderSuggestion('predicted_category', 'category')}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="date">Date</Label>
                    {/* Use ConfidenceIndicator with loading state */}
                     <ConfidenceIndicator score={editedConfidence?.date} loading={isProcessing} />
                  </div>
                  <div className="relative">
                    <Input
                      id="date"
                      type="date"
                      // Handle potential non-string date values safely
                      value={typeof editedReceipt.date === 'string' ? editedReceipt.date.split('T')[0] : ''}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      className="bg-background/50 pl-9"
                    />
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-blue-200" />
                  </div>
                  {renderSuggestion('date', 'date')}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="total">Total Amount</Label>
                     {/* Use ConfidenceIndicator with loading state */}
                     <ConfidenceIndicator score={editedConfidence?.total} loading={isProcessing} />
                  </div>
                  <div className="relative">
                    <Input
                      id="total"
                      type="number"
                      step="0.01"
                      value={editedReceipt.total || 0}
                      onChange={(e) => handleInputChange('total', parseFloat(e.target.value) || 0)} // Ensure value is number
                      className="bg-background/50 pl-9"
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
                     {/* Currency confidence might not be tracked in ConfidenceScore table directly */}
                     {/* <ConfidenceIndicator score={editedConfidence?.currency} /> */}
                  </div>
                  <Input
                    id="currency"
                    value={editedReceipt.currency || "MYR"}
                    onChange={(e) => handleInputChange('currency', e.target.value)}
                    className="bg-background/50"
                  />
                   {renderSuggestion('currency', 'currency')}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                     {/* Use ConfidenceIndicator with loading state */}
                     <ConfidenceIndicator score={editedConfidence?.payment_method} loading={isProcessing} />
                  </div>
                  <div className="relative">
                    <Input
                      id="paymentMethod"
                      value={editedReceipt.payment_method || ""}
                      onChange={(e) => handleInputChange('payment_method', e.target.value)}
                      className="bg-background/50 pl-9"
                    />
                    <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-blue-200" />
                  </div>
                   {renderSuggestion('payment_method', 'payment method')}
                </div>
              </div>

              {/* Line Items Section */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Label>Line Items</Label>
                     {/* Use ConfidenceIndicator with loading state */}
                     <ConfidenceIndicator score={editedConfidence?.line_items} loading={isProcessing} />
                  </div>
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

                <Card className="bg-background/50 border border-border/50">
                  <ScrollArea className="p-3 h-[180px]"> {/* Fixed height for consistent scrolling */}
                    <div className="space-y-2">
                        {editedReceipt.lineItems && editedReceipt.lineItems.length > 0 ? (
                        editedReceipt.lineItems.map((item, index) => (
                            <div
                            key={item.id || `temp-${index}`} // Use index as fallback key for unsaved items
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
                                onChange={(e) => handleLineItemChange(index, 'amount', parseFloat(e.target.value) || 0)} // Ensure value is number
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
                  </ScrollArea>
                </Card>
              </div>

              {/* Totals Section */}
              <div className="pt-4 border-t border-border/50">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  {/* Calculate subtotal dynamically */}
                  <span>{formatCurrency((editedReceipt.total || 0) - (editedReceipt.tax || 0))}</span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Tax:</span>
                     {/* Use ConfidenceIndicator with loading state */}
                     <ConfidenceIndicator score={editedConfidence?.tax} loading={isProcessing} />
                  </div>
                  <div className="relative w-24">
                    <Input
                      type="number"
                      step="0.01"
                      value={editedReceipt.tax || 0}
                      onChange={(e) => handleInputChange('tax', parseFloat(e.target.value) || 0)} // Ensure value is number
                      className="bg-transparent border-0 focus-visible:ring-0 px-0 text-sm text-right"
                      placeholder="Tax"
                    />
                  </div>
                   {renderSuggestion('tax', 'tax amount')}
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-center font-semibold mt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(editedReceipt.total || 0)}</span> {/* Ensure total has default value */}
                </div>
              </div>
            </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="pt-4 mt-auto flex justify-between flex-shrink-0"> {/* Added mt-auto and flex-shrink-0 */}
          <Button variant="outline" className="gap-2">
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
      </motion.div>
    </div>
  );
}
