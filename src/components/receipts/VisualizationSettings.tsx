import React from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Eye, Layers, Bug, Gauge, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VisualizationSettingsProps {
  showBoundingBoxes: boolean;
  setShowBoundingBoxes: (value: boolean) => void;
  showPolygons: boolean;
  setShowPolygons: (value: boolean) => void;
  debugMode: boolean;
  setDebugMode: (value: boolean) => void;
  confidenceThreshold: number;
  setConfidenceThreshold: (value: number) => void;
}

const VisualizationSettings: React.FC<VisualizationSettingsProps> = ({
  showBoundingBoxes,
  setShowBoundingBoxes,
  showPolygons,
  setShowPolygons,
  debugMode,
  setDebugMode,
  confidenceThreshold,
  setConfidenceThreshold
}) => {
  return (
    <Card className="p-4 space-y-4">
      <h3 className="text-sm font-medium">Visualization Settings</h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-muted-foreground" />
            <Label htmlFor="show-boxes" className="text-sm cursor-pointer">
              Show Bounding Boxes
            </Label>
          </div>
          <Switch
            id="show-boxes"
            checked={showBoundingBoxes}
            onCheckedChange={setShowBoundingBoxes}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-muted-foreground" />
            <Label htmlFor="show-polygons" className="text-sm cursor-pointer">
              Show Outlines
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Shows polygon outlines around detected fields. If polygon data is not available,
                    dashed outlines will be shown based on bounding boxes.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Switch
            id="show-polygons"
            checked={showPolygons}
            onCheckedChange={setShowPolygons}
            disabled={!showBoundingBoxes}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug size={16} className="text-muted-foreground" />
            <Label htmlFor="debug-mode" className="text-sm cursor-pointer">
              Debug Mode
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Shows additional technical information about each detected field,
                    including raw coordinates and confidence scores.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Switch
            id="debug-mode"
            checked={debugMode}
            onCheckedChange={setDebugMode}
            disabled={!showBoundingBoxes}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Gauge size={16} className="text-muted-foreground" />
            <Label htmlFor="confidence-threshold" className="text-sm">
              Confidence Threshold: {confidenceThreshold}%
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Filter out fields with confidence scores below this threshold.
                    Lower values show more fields but may include incorrect detections.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Slider
            id="confidence-threshold"
            min={0}
            max={100}
            step={5}
            value={[confidenceThreshold]}
            onValueChange={(values) => setConfidenceThreshold(values[0])}
            disabled={!showBoundingBoxes}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default VisualizationSettings;
