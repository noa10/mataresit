
import React from "react";
import { FileText } from "lucide-react";

export interface FilePreviewType {
  id: string;
  file: File;
  preview: string;
}

interface FilePreviewProps {
  filePreviews: FilePreviewType[];
  selectedFileIndex: number;
  setSelectedFileIndex: (index: number) => void;
}

export function FilePreview({ filePreviews, selectedFileIndex, setSelectedFileIndex }: FilePreviewProps) {
  if (filePreviews.length === 0) return null;
  const selectedFile = filePreviews[selectedFileIndex];
  
  return (
    <div className="mt-4 w-full">
      <div className="relative aspect-[3/4] max-w-[200px] mx-auto rounded-lg overflow-hidden border border-border">
        {selectedFile.file.type === 'application/pdf' ? (
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            <FileText size={48} className="text-primary/50" />
            <span className="absolute bottom-2 text-xs text-muted-foreground">{selectedFile.file.name}</span>
          </div>
        ) : (
          <img 
            src={selectedFile.preview} 
            alt={selectedFile.file.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>
      
      {filePreviews.length > 1 && (
        <div className="mt-3 flex justify-center gap-2 overflow-x-auto px-2 max-w-full">
          {filePreviews.map((preview, index) => (
            <button
              key={preview.id}
              className={`relative min-w-12 w-12 h-12 border-2 rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
                index === selectedFileIndex ? 'border-primary' : 'border-border'
              }`}
              onClick={() => setSelectedFileIndex(index)}
              aria-label={`Select file ${index + 1}: ${preview.file.name}`}
            >
              {preview.file.type === 'application/pdf' ? (
                <div className="absolute inset-0 bg-muted flex items-center justify-center">
                  <FileText size={16} className="text-primary/70" />
                </div>
              ) : (
                <img 
                  src={preview.preview} 
                  alt={`Thumbnail ${index + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
