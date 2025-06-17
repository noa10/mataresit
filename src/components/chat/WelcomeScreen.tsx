import React from 'react';
import { BrainCircuit, Sparkles, Search, Receipt } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { useChatTranslation } from '@/contexts/LanguageContext';

interface WelcomeScreenProps {
  onExampleClick: (example: string) => void;
}

// Function to generate example queries with translations
const getExampleQueries = (t: (key: string, options?: any) => string) => [
  {
    text: t('welcome.examples.queries.0'),
    icon: Search,
    description: t('welcome.features.naturalLanguage.description')
  },
  {
    text: t('welcome.examples.queries.1'),
    icon: Receipt,
    description: t('welcome.features.instantResults.description')
  },
  {
    text: t('welcome.examples.queries.2'),
    icon: Sparkles,
    description: t('welcome.features.smartFiltering.description')
  },
  {
    text: t('welcome.examples.queries.3'),
    icon: Search,
    description: t('welcome.features.naturalLanguage.description')
  },
  {
    text: t('welcome.examples.queries.4'),
    icon: Receipt,
    description: t('welcome.features.instantResults.description')
  },
  {
    text: t('welcome.examples.queries.5'),
    icon: Search,
    description: t('welcome.features.smartFiltering.description')
  }
];

export function WelcomeScreen({ onExampleClick }: WelcomeScreenProps) {
  const { t } = useChatTranslation();
  const exampleQueries = getExampleQueries(t);

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
              {t('welcome.title')}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t('welcome.subtitle')}
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="space-y-2 text-center">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto">
              <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="font-medium">{t('welcome.features.naturalLanguage.title')}</div>
            <div className="text-muted-foreground text-xs sm:text-sm">
              {t('welcome.features.naturalLanguage.description')}
            </div>
          </div>

          <div className="space-y-2 text-center">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mx-auto">
              <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="font-medium">{t('welcome.features.smartFiltering.title')}</div>
            <div className="text-muted-foreground text-xs sm:text-sm">
              {t('welcome.features.smartFiltering.description')}
            </div>
          </div>

          <div className="space-y-2 text-center">
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mx-auto">
              <Receipt className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="font-medium">{t('welcome.features.instantResults.title')}</div>
            <div className="text-muted-foreground text-xs sm:text-sm">
              {t('welcome.features.instantResults.description')}
            </div>
          </div>
        </div>

        {/* Example Queries */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('welcome.examples.title')}</h2>
          
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
          <div className="font-medium mb-2">{t('tips.title')}</div>
          <ul className="text-left space-y-1 text-muted-foreground">
            <li>• {t('tips.items.0')}</li>
            <li>• {t('tips.items.1')}</li>
            <li>• {t('tips.items.2')}</li>
            <li>• {t('tips.items.3')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
