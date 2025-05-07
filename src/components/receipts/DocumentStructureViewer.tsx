import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { DocumentStructure } from '@/types/receipt';

interface DocumentStructureViewerProps {
  documentStructure: DocumentStructure;
  onSelectBlock?: (blockId: string) => void;
}

const DocumentStructureViewer: React.FC<DocumentStructureViewerProps> = ({
  documentStructure,
  onSelectBlock
}) => {
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  // Toggle block expansion
  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => ({
      ...prev,
      [blockId]: !prev[blockId]
    }));
  };

  // Handle block selection
  const handleSelectBlock = (blockId: string) => {
    if (onSelectBlock) {
      onSelectBlock(blockId);
    }
  };

  // Render a block and its children recursively
  const renderBlock = (block: any, depth = 0) => {
    const blockId = block.id || block.Id || `block-${depth}-${Math.random().toString(36).substring(7)}`;
    const isExpanded = expandedBlocks[blockId] || false;
    const hasChildren = block.children?.length > 0 || block.Relationships?.length > 0;
    
    // Determine block type and confidence
    const blockType = block.type || block.BlockType || 'Unknown';
    const confidence = block.confidence || block.Confidence || 0;
    
    // Get confidence color
    const getConfidenceColor = (confidence: number) => {
      if (confidence >= 80) return 'text-green-500';
      if (confidence >= 60) return 'text-yellow-500';
      if (confidence >= 40) return 'text-orange-500';
      return 'text-red-500';
    };

    return (
      <div key={blockId} className="mb-1" style={{ marginLeft: `${depth * 16}px` }}>
        <div className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded">
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0"
              onClick={() => toggleBlock(blockId)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </Button>
          ) : (
            <div className="w-5" />
          )}
          
          <div 
            className="flex-1 text-xs cursor-pointer hover:underline"
            onClick={() => handleSelectBlock(blockId)}
          >
            <span className="font-medium">{blockType}</span>
            {confidence > 0 && (
              <span className={`ml-2 ${getConfidenceColor(confidence)}`}>
                {confidence.toFixed(1)}%
              </span>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0 opacity-50 hover:opacity-100"
            onClick={() => console.log('Block details:', block)}
            title="View block details in console"
          >
            <Info size={12} />
          </Button>
        </div>
        
        {isExpanded && hasChildren && (
          <div className="mt-1 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
            {/* Render children if any */}
            {block.children?.map((child: any) => renderBlock(child, depth + 1))}
            
            {/* Render relationships if any */}
            {block.Relationships?.map((rel: any) => (
              <div key={`rel-${blockId}-${rel.Type}`} className="text-xs text-muted-foreground pl-4 py-1">
                <span className="font-medium">{rel.Type}:</span>
                <div className="pl-2">
                  {rel.Ids?.map((id: string) => (
                    <div 
                      key={id} 
                      className="cursor-pointer hover:underline"
                      onClick={() => handleSelectBlock(id)}
                    >
                      {id}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="p-3 h-full">
      <div className="text-sm font-medium mb-2 flex justify-between items-center">
        <span>Document Structure</span>
        <span className="text-xs text-muted-foreground">
          {documentStructure.blocks.length} blocks
        </span>
      </div>
      
      <ScrollArea className="h-[calc(100%-2rem)] pr-4">
        <div className="space-y-1">
          {documentStructure.blocks.map(block => renderBlock(block))}
        </div>
        
        {documentStructure.blocks.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-4">
            No document structure data available
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};

export default DocumentStructureViewer;
