import React, { useState } from 'react';
import { useAdvancedTranslation } from '@/hooks/useAdvancedTranslation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

/**
 * Demo component showcasing Phase 5 advanced translation features:
 * - Pluralization support
 * - Context-aware translations
 * - Role-based content
 * - Malaysian business terminology
 */
export function AdvancedTranslationDemo() {
  const { t, tPlural, tContext, tRole, tCurrency, userRole, language } = useAdvancedTranslation();
  const { setLanguage } = useLanguage();
  const [receiptCount, setReceiptCount] = useState(0);
  const [userCount, setUserCount] = useState(1);

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Advanced Translation Features Demo</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant={language === 'en' ? 'default' : 'outline'}
              onClick={() => setLanguage('en')}
            >
              English
            </Button>
            <Button 
              variant={language === 'ms' ? 'default' : 'outline'}
              onClick={() => setLanguage('ms')}
            >
              Bahasa Malaysia
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Pluralization Demo */}
          <div>
            <h3 className="text-lg font-semibold mb-3">1. Pluralization Support</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <Button onClick={() => setReceiptCount(Math.max(0, receiptCount - 1))}>-</Button>
                <span className="w-20 text-center">{receiptCount}</span>
                <Button onClick={() => setReceiptCount(receiptCount + 1)}>+</Button>
              </div>
              <div className="space-y-1">
                <p><strong>Receipt Count:</strong> {tPlural('common:plurals.receipt', receiptCount)}</p>
                <p><strong>Dashboard Stats:</strong> {tPlural('dashboard:stats.receiptCount', receiptCount)}</p>
                <p><strong>Line Items:</strong> {tPlural('receipts:plurals.lineItem', receiptCount * 3)}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Context-Aware Demo */}
          <div>
            <h3 className="text-lg font-semibold mb-3">2. Context-Aware Translations</h3>
            <div className="space-y-2">
              <p><strong>Current Role:</strong> <Badge>{userRole}</Badge></p>
              <div className="space-y-1">
                <p><strong>Welcome Message:</strong> {tContext('common:contextual.welcome', { userRole })}</p>
                <p><strong>Dashboard Title:</strong> {tContext('dashboard:contextual.title', { userRole })}</p>
                <p><strong>Access Level:</strong> {tContext('common:contextual.access', { userRole })}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Role-Based Demo */}
          <div>
            <h3 className="text-lg font-semibold mb-3">3. Role-Based Content</h3>
            <div className="grid grid-cols-2 gap-4">
              {(['admin', 'user', 'team_member', 'guest'] as const).map(role => (
                <div key={role} className="p-3 border rounded">
                  <Badge variant="outline" className="mb-2">{role}</Badge>
                  <div className="space-y-1 text-sm">
                    <p><strong>Save Button:</strong> {tRole('common:buttons.save', role)}</p>
                    <p><strong>Dashboard:</strong> {tRole('dashboard:contextual.title', role)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Malaysian Business Context */}
          <div>
            <h3 className="text-lg font-semibold mb-3">4. Malaysian Business Context</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Currency & Formatting</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Currency:</strong> {t('common:malaysian.businessTerms.ringgit')}</p>
                  <p><strong>Amount:</strong> {tCurrency(1234.56, 'MYR')}</p>
                  <p><strong>Format:</strong> {t('receipts:malaysian.currency.format', { amount: '99.90' })}</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Tax Types</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>GST:</strong> {t('receipts:malaysian.taxTypes.gst')}</p>
                  <p><strong>SST:</strong> {t('receipts:malaysian.taxTypes.sst')}</p>
                  <p><strong>Service Tax:</strong> {t('receipts:malaysian.taxTypes.serviceTax')}</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Business Types */}
          <div>
            <h3 className="text-lg font-semibold mb-3">5. Malaysian Business Types</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                'restaurant', 'retail', 'supermarket', 
                'pharmacy', 'petrolStation', 'hotel',
                'transport', 'medical'
              ].map(type => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {t(`receipts:malaysian.businessTypes.${type}`)}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Error Messages Context */}
          <div>
            <h3 className="text-lg font-semibold mb-3">6. Context-Aware Error Messages</h3>
            <div className="space-y-2">
              <div className="space-y-1 text-sm">
                <p><strong>General Unauthorized:</strong> {t('errors:contextual.unauthorized')}</p>
                <p><strong>Admin Unauthorized:</strong> {t('errors:contextual.unauthorized_admin')}</p>
                <p><strong>User Validation:</strong> {t('errors:contextual.validation_user')}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p><strong>Malaysian Business Error:</strong> {t('errors:malaysian.businessErrors.invalidGstNumber')}</p>
                <p><strong>Processing Error:</strong> {t('errors:malaysian.processingErrors.gstCalculationError')}</p>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
