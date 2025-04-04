
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw, MoveHorizontal, AlertTriangle, Receipt } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImageViewerProps {
  imageUrl: string | undefined;
  altText?: string;
  onError?: () => void;
}

export default function ImageViewer({ imageUrl, altText = "Image", onError }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  
  // Format the image URL if needed (handle Supabase storage URLs)
  const getFormattedImageUrl = (url: string | undefined) => {
    if (!url) return "";
    
    // Handle URLs with storage URL format - ensure public access
    if (url.includes('supabase.co') && !url.includes('/public/')) {
      return url.replace('/object/', '/object/public/');
    }
    
    return url;
  };

  const formattedImageUrl = getFormattedImageUrl(imageUrl);

  // Handle zoom functionality
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 5));
  };
  
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };
  
  // Handle rotation functionality
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };
  
  // Handle image error
  const handleImageError = () => {
    console.error("Error loading image:", formattedImageUrl);
    setImageError(true);
    if (onError) onError();
  };
  
  // Handle reset functionality
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };
  
  // Handle image dragging for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Reset position when zoom changes to 1
  useEffect(() => {
    if (zoom === 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [zoom]);

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden"
    >
      {/* Image Container */}
      <ScrollArea 
        className="h-[500px] flex items-center justify-center bg-secondary/30 rounded-lg relative"
        ref={viewerRef}
      >
        {/* Toolbar - now positioned at the top of the image container */}
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-lg shadow-lg z-10 flex justify-center gap-1 p-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleRotate}
            title="Rotate"
          >
            <RotateCw size={18} />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleReset}
            title="Reset View"
            disabled={zoom === 1 && rotation === 0 && position.x === 0 && position.y === 0}
          >
            <MoveHorizontal size={18} />
          </Button>
        </div>
        
        <div 
          className={`min-h-full min-w-full flex items-center justify-center p-4 ${isDragging ? 'cursor-grabbing' : zoom > 1 ? 'cursor-grab' : 'cursor-default'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {formattedImageUrl && !imageError ? (
            <motion.div
              className="flex items-center justify-center"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease'
              }}
            >
              <img 
                src={formattedImageUrl} 
                alt={altText}
                className="max-w-full max-h-full object-contain shadow-lg select-none"
                draggable={false}
                onError={handleImageError}
              />
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground p-4">
              {imageError ? (
                <>
                  <AlertTriangle size={64} className="mb-4 text-amber-500" />
                  <p className="text-center mb-2">Failed to load image</p>
                  <p className="text-xs text-center text-muted-foreground mb-4">
                    The image URL may be invalid or the image may no longer exist.
                  </p>
                  <p className="text-xs break-all text-muted-foreground mb-4">
                    URL: {imageUrl || "No URL provided"}
                  </p>
                </>
              ) : (
                <>
                  <Receipt size={64} className="mb-4 opacity-30" />
                  <p>No image available</p>
                </>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
