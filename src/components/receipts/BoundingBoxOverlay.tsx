import React, { useState, useEffect, useRef, RefObject } from 'react';
import { motion } from 'framer-motion';

interface BoundingBox {
  Left: number;
  Top: number;
  Width: number;
  Height: number;
}

interface PolygonPoint {
  X: number;
  Y: number;
}

interface Polygon {
  points: Array<PolygonPoint>;
}

interface GeometryData {
  boundingBox?: BoundingBox;
  polygon?: Polygon;
}

interface FieldGeometry {
  merchant?: GeometryData;
  date?: GeometryData;
  total?: GeometryData;
  tax?: GeometryData;
  payment_method?: GeometryData;
  [key: string]: GeometryData | undefined;
}

interface LineItemGeometry {
  item?: GeometryData;
  price?: GeometryData;
  combined?: BoundingBox;
}

interface LineItem {
  description: string;
  amount: number;
  geometry?: LineItemGeometry;
}

interface BoundingBoxOverlayProps {
  fieldGeometry?: FieldGeometry | null;
  lineItems?: Array<LineItem> | null;
  imageWidth: number;
  imageHeight: number;
  visible: boolean;
  highlightedField?: string | null;
  confidenceScores?: Record<string, number>;
  showPolygons?: boolean;
  debugMode?: boolean;
  transformState?: {
    scale?: number;
    positionX?: number;
    positionY?: number;
    [key: string]: any;
  };
  confidenceThreshold?: number;
  imageRef?: RefObject<HTMLImageElement>;
}

const BoundingBoxOverlay: React.FC<BoundingBoxOverlayProps> = ({
  fieldGeometry,
  lineItems,
  imageWidth,
  imageHeight,
  visible,
  highlightedField,
  confidenceScores,
  showPolygons = true,
  debugMode = false,
  transformState,
  confidenceThreshold = 0,
  imageRef
}) => {
  const [boxes, setBoxes] = useState<Array<{
    id: string;
    box: BoundingBox;
    polygon?: Polygon;
    confidence: number;
    isHighlighted: boolean;
    fieldType: string;
  }>>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || (!fieldGeometry && !lineItems?.length)) {
      setBoxes([]);
      return;
    }
    if (debugMode) {
      console.log("BoundingBoxOverlay - Props:", { imageWidth, imageHeight, visible, fieldGeometry, lineItems, imageRefExists: !!imageRef?.current });
    }
    const newBoxes: Array<{
      id: string;
      box: BoundingBox;
      polygon?: Polygon;
      confidence: number;
      isHighlighted: boolean;
      fieldType: string;
    }> = [];

    if (fieldGeometry) {
      Object.entries(fieldGeometry).forEach(([field, geometry]) => {
        if (geometry?.boundingBox) {
          newBoxes.push({
            id: field,
            box: geometry.boundingBox,
            polygon: geometry.polygon,
            confidence: confidenceScores?.[field] || 50,
            isHighlighted: field === highlightedField,
            fieldType: 'field'
          });
        }
      });
    }

    setBoxes(newBoxes);
  }, [fieldGeometry, lineItems, visible, highlightedField, confidenceScores, debugMode, imageRef, imageWidth, imageHeight]);

  const getConfidenceColor = (confidence: number, opacity: number = 0.7) => {
    if (confidence >= 80) return `rgba(34, 197, 94, ${opacity})`; // green
    if (confidence >= 60) return `rgba(234, 179, 8, ${opacity})`;  // yellow
    if (confidence >= 40) return `rgba(249, 115, 22, ${opacity})`; // orange
    return `rgba(239, 68, 68, ${opacity})`; // red
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return 'High';
    if (confidence >= 60) return 'Medium';
    if (confidence >= 40) return 'Low';
    return 'Very Low';
  };

  const calculateDisplayCoordinates = (
    normalizedX: number, 
    normalizedY: number, 
    normalizedWidth?: number, 
    normalizedHeight?: number
  ) => {
    const imgElement = imageRef?.current;
    if (!imgElement) {
      if (debugMode) console.warn("Image ref not available in calculateDisplayCoordinates");
      return { displayX: 0, displayY: 0, displayWidth: 0, displayHeight: 0 };
    }

    const currentImageClientWidth = imgElement.clientWidth;
    const currentImageClientHeight = imgElement.clientHeight;

    if (currentImageClientWidth === 0 || currentImageClientHeight === 0 || imageWidth === 0 || imageHeight === 0) {
      if (debugMode) console.warn("Zero dimensions in calculateDisplayCoordinates", { currentImageClientWidth, currentImageClientHeight, imageWidth, imageHeight });
      return { displayX: 0, displayY: 0, displayWidth: 0, displayHeight: 0 };
    }

    const naturalAspectRatio = imageWidth / imageHeight;
    const clientAspectRatio = currentImageClientWidth / currentImageClientHeight;

    let visualImageWidth = currentImageClientWidth;
    let visualImageHeight = currentImageClientHeight;
    let imageRenderOffsetX = 0;
    let imageRenderOffsetY = 0;

    if (naturalAspectRatio > clientAspectRatio) { // Letterboxed
      visualImageHeight = currentImageClientWidth / naturalAspectRatio;
      imageRenderOffsetY = (currentImageClientHeight - visualImageHeight) / 2;
    } else if (naturalAspectRatio < clientAspectRatio) { // Pillarboxed
      visualImageWidth = currentImageClientHeight * naturalAspectRatio;
      imageRenderOffsetX = (currentImageClientWidth - visualImageWidth) / 2;
    }

    const boundedX = Math.max(0, Math.min(1, normalizedX));
    const boundedY = Math.max(0, Math.min(1, normalizedY));

    const displayX = (boundedX * visualImageWidth) + imageRenderOffsetX;
    const displayY = (boundedY * visualImageHeight) + imageRenderOffsetY;
    
    const displayWidth = normalizedWidth !== undefined ? normalizedWidth * visualImageWidth : undefined;
    const displayHeight = normalizedHeight !== undefined ? normalizedHeight * visualImageHeight : undefined;
        
    if (debugMode) {
      console.log("calculateDisplayCoordinates (new logic):", {
        normalized: { x: normalizedX, y: normalizedY, w: normalizedWidth, h: normalizedHeight },
        naturalImageDims: { w: imageWidth, h: imageHeight },
        imgElementClientDims: { w: currentImageClientWidth, h: currentImageClientHeight },
        visualImageContentDims: { w: visualImageWidth, h: visualImageHeight, offX: imageRenderOffsetX, offY: imageRenderOffsetY },
        calculatedDisplay: { x: displayX, y: displayY, w: displayWidth, h: displayHeight },
        transformState // Log received transformState for diagnostics
      });
    }
    
    return { displayX, displayY, displayWidth, displayHeight };
  };

  const createPolygonPoints = (polygon: Polygon) => {
    if (!polygon.points || polygon.points.length < 3) {
      if (debugMode) console.warn("Invalid polygon data for createPolygonPoints:", polygon);
      return "";
    }
    return polygon.points
      .map(point => {
        const { displayX, displayY } = calculateDisplayCoordinates(point.X, point.Y);
        return `${displayX},${displayY}`;
      })
      .join(' ');
  };

  if (!visible) return null;

  const filteredBoxes = boxes.filter(box => {
    if (box.isHighlighted) return true;
    if (box.fieldType === 'line_item_synthetic') return true;
    return box.confidence >= confidenceThreshold;
  });

  return (
    <div className="absolute inset-0 pointer-events-none" ref={containerRef}>
      {filteredBoxes.map(({ id, box, polygon, confidence, isHighlighted, fieldType }) => {
        const { 
          displayX, 
          displayY, 
          displayWidth, 
          displayHeight 
        } = calculateDisplayCoordinates(box.Left, box.Top, box.Width, box.Height);

        if (isNaN(displayX) || isNaN(displayY) || displayWidth === undefined || displayHeight === undefined || displayWidth <= 0 || displayHeight <= 0 ) {
          if (debugMode) {
            console.warn(`Skipping box render due to invalid dimensions for ${id}:`, { displayX, displayY, displayWidth, displayHeight });
          }
          return null;
        }

        return (
          <motion.div
            key={id}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              scale: isHighlighted ? [1, 1.05, 1] : 1
            }}
            transition={{
              opacity: { duration: 0.3 },
              scale: { duration: 0.5, repeat: isHighlighted ? Infinity : 0, repeatType: "reverse" }
            }}
            style={{
              position: 'absolute',
              left: `${displayX}px`,
              top: `${displayY}px`,
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
              border: `2px ${fieldType === 'line_item_synthetic' ? 'dashed' : 'solid'} ${getConfidenceColor(confidence)}`,
              backgroundColor: `${getConfidenceColor(confidence, fieldType === 'line_item_synthetic' ? 0.05 : 0.1)}`,
              zIndex: isHighlighted ? 20 : 10,
              boxShadow: isHighlighted ? '0 0 0 2px rgba(255,255,255,0.5)' : 'none'
            }}
          >
            <div
              className="absolute text-xs px-1 rounded text-white whitespace-nowrap overflow-hidden max-w-[150px]"
              style={{
                backgroundColor: getConfidenceColor(confidence),
                top: fieldType.includes('line_item') ? '2px' : '-20px',
                left: '2px',
                fontSize: '10px',
                textOverflow: 'ellipsis'
              }}
            >
              {fieldType === 'line_item_synthetic'
                ? `Line item ${id.split('_')[2] || ''}`
                : `${id.replace(/_/g, ' ')} (${confidence}%)`}
            </div>
            {debugMode && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[8px] p-1 overflow-hidden">
                <div>ID: {id} ({fieldType})</div>
                <div>Conf: {confidence}%</div>
                <div>NormBox: L:{box.Left.toFixed(3)} T:{box.Top.toFixed(3)} W:{box.Width.toFixed(3)} H:{box.Height.toFixed(3)}</div>
                <div>DispBox: X:{displayX.toFixed(0)} Y:{displayY.toFixed(0)} W:{displayWidth.toFixed(0)} H:{displayHeight.toFixed(0)}</div>
              </div>
            )}
          </motion.div>
        );
      })}

      {showPolygons && (
        <svg
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 15 }}
        >
          {filteredBoxes
            .filter(item => item.polygon && item.polygon.points && item.polygon.points.length > 2)
            .map(({ id, polygon, confidence, isHighlighted }) => {
              if (!polygon) return null;
              const pointsString = createPolygonPoints(polygon);
              if (!pointsString) return null;
              return (
                <polygon
                  key={`poly-${id}`}
                  points={pointsString}
                  style={{
                    fill: 'none',
                    stroke: getConfidenceColor(confidence),
                    strokeWidth: isHighlighted ? 3 : 1.5,
                    strokeDasharray: isHighlighted || id.includes('synthetic') ? "5,3" : ""
                  }}
                  className={isHighlighted ? "animate-pulse" : ""}
                />
              );
            })}
          {filteredBoxes.length > 0 && 
           filteredBoxes.filter(item => item.polygon && item.polygon.points && item.polygon.points.length > 2).length === 0 && (
            filteredBoxes.map(({ id, box, confidence, isHighlighted }) => {
              const { displayX, displayY, displayWidth, displayHeight } = 
                calculateDisplayCoordinates(box.Left, box.Top, box.Width, box.Height);
              if (isNaN(displayX) || isNaN(displayY) || !displayWidth || !displayHeight || displayWidth <=0 || displayHeight <= 0) return null;
              const points = `${displayX},${displayY} ${displayX + displayWidth},${displayY} ${displayX + displayWidth},${displayY + displayHeight} ${displayX},${displayY + displayHeight}`;
              return (
                <polygon
                  key={`poly-box-${id}`}
                  points={points}
                  style={{
                    fill: 'none',
                    stroke: getConfidenceColor(confidence),
                    strokeWidth: isHighlighted ? 3 : 1.5,
                    strokeDasharray: "5,3"
                  }}
                  className={isHighlighted ? "animate-pulse" : ""}
                />
              );
            })
          )}
        </svg>
      )}
    </div>
  );
};

export default BoundingBoxOverlay;
