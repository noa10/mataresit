
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Brain, Receipt, ScanEye, Database } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function InfoCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          How It Works
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <div className="space-y-2">
          <div className="font-medium flex items-center gap-2">
            <ScanEye className="h-4 w-4 text-primary" />
            OCR + AI
          </div>
          <p className="text-muted-foreground">
            This method first extracts text from your receipt using Optical Character Recognition (OCR), 
            then uses AI to analyze and structure that text. Best for receipts with clear text.
          </p>
        </div>
        
        <Separator />
        
        <div className="space-y-2">
          <div className="font-medium flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            AI Vision
          </div>
          <p className="text-muted-foreground">
            This method sends the image directly to an AI model that can "see" the full receipt. 
            Often better for receipts with complex layouts or poor print quality.
          </p>
        </div>
        
        <Separator />
        
        <div className="space-y-2">
          <div className="font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Model Selection
          </div>
          <p className="text-muted-foreground">
            Different AI models offer varying trade-offs between speed and accuracy. 
            Gemini Flash models are faster, while Pro models are more accurate but slower.
          </p>
        </div>
        
        <Separator />
        
        <div className="space-y-2">
          <div className="font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Comparison Mode
          </div>
          <p className="text-muted-foreground">
            When enabled, both methods will process your receipt and highlight differences to help you verify accuracy.
            This takes longer but can improve reliability.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
