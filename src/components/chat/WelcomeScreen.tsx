import React from 'react';
import { BrainCircuit, Sparkles, Search, Receipt } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface WelcomeScreenProps {
  onExampleClick: (example: string) => void;
}

const exampleQueries = [
  {
    text: "find coffee purchases",
    icon: Search,
    description: "Search for specific items naturally"
  },
  {
    text: "show me receipts from last week",
    icon: Receipt,
    description: "Time-based searches with natural language"
  },
  {
    text: "grocery items over $20",
    icon: Sparkles,
    description: "Combine categories with price filters"
  },
  {
    text: "what did I buy at Walmart?",
    icon: Search,
    description: "Conversational store-based queries"
  },
  {
    text: "expensive purchases this month",
    icon: Receipt,
    description: "Relative terms for amounts and dates"
  },
  {
    text: "help me search",
    icon: Search,
    description: "Get guidance on how to search effectively"
  }
];

export function WelcomeScreen({ onExampleClick }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <BrainCircuit className="h-8 w-8 text-primary" />
            </div>
          </div>
          
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              AI Receipt Assistant
            </h1>
            <p className="text-lg text-muted-foreground">
              Ask me anything about your receipts using natural language
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="space-y-2 text-center">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto">
              <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="font-medium">Smart Search</div>
            <div className="text-muted-foreground text-xs sm:text-sm">
              Find receipts and items using natural language queries
            </div>
          </div>

          <div className="space-y-2 text-center">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mx-auto">
              <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="font-medium">AI Understanding</div>
            <div className="text-muted-foreground text-xs sm:text-sm">
              Semantic search that understands context and meaning
            </div>
          </div>

          <div className="space-y-2 text-center">
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mx-auto">
              <Receipt className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="font-medium">Detailed Results</div>
            <div className="text-muted-foreground text-xs sm:text-sm">
              Get comprehensive information about receipts and line items
            </div>
          </div>
        </div>

        {/* Example Queries */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Try asking questions like:</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {exampleQueries.map((example, index) => {
              const IconComponent = example.icon;
              return (
                <Card 
                  key={index}
                  className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] border-dashed"
                  onClick={() => onExampleClick(example.text)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <IconComponent className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm mb-1">
                          "{example.text}"
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {example.description}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm">
          <div className="font-medium mb-2">💡 Tips for better results:</div>
          <ul className="text-left space-y-1 text-muted-foreground">
            <li>• Be specific about time periods (e.g., "last month", "this year")</li>
            <li>• Include amounts or price ranges when relevant</li>
            <li>• Use natural language - ask as you would ask a person</li>
            <li>• Try different phrasings if you don't get the expected results</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
