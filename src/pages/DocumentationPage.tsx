import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDocumentationTranslation } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Rocket,
  Wrench,
  Cpu,
  BarChart,
  HelpCircle,
  Book,
  Upload,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function DocumentationPage() {
  const { t } = useDocumentationTranslation();

  const sections = [
    { id: t('sections.overview.id'), title: t('sections.overview.title'), icon: BookOpen },
    { id: t('sections.gettingStarted.id'), title: t('sections.gettingStarted.title'), icon: Rocket },
    { id: t('sections.coreFeatures.id'), title: t('sections.coreFeatures.title'), icon: Wrench },
    { id: t('sections.troubleshooting.id'), title: t('sections.troubleshooting.title'), icon: HelpCircle },
    { id: t('sections.glossary.id'), title: t('sections.glossary.title'), icon: Book },
  ];

  useEffect(() => {
    document.title = t('meta.title');
  }, [t]);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{t('hero.title')}</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {t('hero.subtitle')}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        {/* Sticky Sidebar Navigation */}
        <aside className="lg:col-span-1 lg:sticky lg:top-24 h-max">
          <h3 className="text-lg font-semibold mb-4">{t('navigation.onThisPage')}</h3>
          <ul className="space-y-2">
            {sections.map(section => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm"
                >
                  <section.icon className="h-4 w-4" />
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-3 space-y-16">
          {/* Section 1: Overview */}
          <section id={t('sections.overview.id')} className="scroll-mt-24">
            <h2 className="text-3xl font-bold border-b pb-2 mb-6">{t('sections.overview.heading')}</h2>
            <div className="space-y-4 text-muted-foreground">
              <h3 className="text-2xl font-semibold text-foreground">{t('sections.overview.whatIs.title')}</h3>
              <p>
                {t('sections.overview.whatIs.description')}
              </p>
              <h3 className="text-2xl font-semibold text-foreground mt-6">{t('sections.overview.keyFeatures.title')}</h3>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>{t('sections.overview.keyFeatures.features.automatedExtraction.title')}</strong>: {t('sections.overview.keyFeatures.features.automatedExtraction.description')}</li>
                <li><strong>{t('sections.overview.keyFeatures.features.aiPowered.title')}</strong>: {t('sections.overview.keyFeatures.features.aiPowered.description')}</li>
                <li><strong>{t('sections.overview.keyFeatures.features.confidenceScoring.title')}</strong>: {t('sections.overview.keyFeatures.features.confidenceScoring.description')}</li>
                <li><strong>{t('sections.overview.keyFeatures.features.realTimeProcessing.title')}</strong>: {t('sections.overview.keyFeatures.features.realTimeProcessing.description')}</li>
                <li><strong>{t('sections.overview.keyFeatures.features.semanticSearch.title')}</strong>: {t('sections.overview.keyFeatures.features.semanticSearch.description')}</li>
                <li><strong>{t('sections.overview.keyFeatures.features.batchProcessing.title')}</strong>: {t('sections.overview.keyFeatures.features.batchProcessing.description')}</li>
                <li><strong>{t('sections.overview.keyFeatures.features.analysisReporting.title')}</strong>: {t('sections.overview.keyFeatures.features.analysisReporting.description')}</li>
                <li><strong>{t('sections.overview.keyFeatures.features.flexibleAI.title')}</strong>: {t('sections.overview.keyFeatures.features.flexibleAI.description')}</li>
              </ul>
            </div>
          </section>

          {/* Section 2: Getting Started */}
          <section id={t('sections.gettingStarted.id')} className="scroll-mt-24">
            <h2 className="text-3xl font-bold border-b pb-2 mb-6">{t('sections.gettingStarted.heading')}</h2>
            <div className="space-y-4 text-muted-foreground">
              <h3 className="text-2xl font-semibold text-foreground">{t('sections.gettingStarted.firstUpload.title')}</h3>
              <ol className="list-decimal list-inside space-y-2">
                <li><strong>{t('sections.gettingStarted.firstUpload.steps.navigate').split(':')[0]}</strong>: {t('sections.gettingStarted.firstUpload.steps.navigate').split(':')[1]}</li>
                <li><strong>{t('sections.gettingStarted.firstUpload.steps.openModal').split(':')[0]}</strong>: {t('sections.gettingStarted.firstUpload.steps.openModal').split(':')[1]}</li>
                <li><strong>{t('sections.gettingStarted.firstUpload.steps.selectFile').split(':')[0]}</strong>: {t('sections.gettingStarted.firstUpload.steps.selectFile').split(':')[1]}</li>
                <li><strong>{t('sections.gettingStarted.firstUpload.steps.processing').split(':')[0]}</strong>: {t('sections.gettingStarted.firstUpload.steps.processing').split(':')[1]}</li>
                <li><strong>{t('sections.gettingStarted.firstUpload.steps.reviewSave').split(':')[0]}</strong>: {t('sections.gettingStarted.firstUpload.steps.reviewSave').split(':')[1]}</li>
              </ol>
              <h3 className="text-2xl font-semibold text-foreground mt-6">{t('sections.gettingStarted.understandingDashboard.title')}</h3>
              <p>{t('sections.gettingStarted.understandingDashboard.description')}</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>{t('sections.gettingStarted.understandingDashboard.features.receiptCards').split(':')[0]}</strong>: {t('sections.gettingStarted.understandingDashboard.features.receiptCards').split(':')[1]}</li>
                <li><strong>{t('sections.gettingStarted.understandingDashboard.features.statusIndicators').split(':')[0]}</strong>: {t('sections.gettingStarted.understandingDashboard.features.statusIndicators').split(':')[1]}</li>
                <li><strong>{t('sections.gettingStarted.understandingDashboard.features.filteringSort').split(':')[0]}</strong>: {t('sections.gettingStarted.understandingDashboard.features.filteringSort').split(':')[1]}</li>
                <li><strong>{t('sections.gettingStarted.understandingDashboard.features.viewMode').split(':')[0]}</strong>: {t('sections.gettingStarted.understandingDashboard.features.viewMode').split(':')[1]}</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Core Features */}
          <section id={t('sections.coreFeatures.id')} className="scroll-mt-24">
            <h2 className="text-3xl font-bold border-b pb-2 mb-6">{t('sections.coreFeatures.heading')}</h2>
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.coreFeatures.uploading.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{t('sections.coreFeatures.uploading.description')}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.coreFeatures.aiSuggestions.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{t('sections.coreFeatures.aiSuggestions.description')}</p>
                  <ul className="list-none space-y-2">
                    <li><span className="text-green-500 font-semibold">■ {t('sections.coreFeatures.aiSuggestions.confidenceLevels.high')}</span></li>
                    <li><span className="text-yellow-500 font-semibold">■ {t('sections.coreFeatures.aiSuggestions.confidenceLevels.medium')}</span></li>
                    <li><span className="text-red-500 font-semibold">■ {t('sections.coreFeatures.aiSuggestions.confidenceLevels.low')}</span></li>
                  </ul>
                  <p className="text-muted-foreground mt-2">{t('sections.coreFeatures.aiSuggestions.editingNote')}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.coreFeatures.aiProcessing.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{t('sections.coreFeatures.aiProcessing.description')}</p>
                  <ul className="list-disc list-inside space-y-2 mt-2">
                    <li><strong>{t('sections.coreFeatures.aiProcessing.methods.aiVision').split(':')[0]}</strong>: {t('sections.coreFeatures.aiProcessing.methods.aiVision').split(':')[1]}</li>
                    <li><strong>{t('sections.coreFeatures.aiProcessing.methods.compare').split(':')[0]}</strong>: {t('sections.coreFeatures.aiProcessing.methods.compare').split(':')[1]}</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.coreFeatures.aiSearch.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{t('sections.coreFeatures.aiSearch.description')}</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Section 4: Troubleshooting */}
          <section id={t('sections.troubleshooting.id')} className="scroll-mt-24">
            <h2 className="text-3xl font-bold border-b pb-2 mb-6">{t('sections.troubleshooting.heading')}</h2>
            <div className="space-y-4 text-muted-foreground">
              <h3 className="text-xl font-semibold text-foreground">{t('sections.troubleshooting.questions.processingStuck.question')}</h3>
              <p>{t('sections.troubleshooting.questions.processingStuck.answer')}</p>

              <h3 className="text-xl font-semibold text-foreground mt-4">{t('sections.troubleshooting.questions.searchResults.question')}</h3>
              <p>{t('sections.troubleshooting.questions.searchResults.answer')}</p>

              <h3 className="text-xl font-semibold text-foreground mt-4">{t('sections.troubleshooting.questions.subscription.question')}</h3>
              <p>{t('sections.troubleshooting.questions.subscription.answer')}</p>
            </div>
          </section>

          {/* Section 5: Glossary */}
          <section id={t('sections.glossary.id')} className="scroll-mt-24">
            <h2 className="text-3xl font-bold border-b pb-2 mb-6">{t('sections.glossary.heading')}</h2>
            <div className="space-y-4 text-muted-foreground">
              <p><strong>{t('sections.glossary.terms.ocr').split(':')[0]}:</strong> {t('sections.glossary.terms.ocr').split(':')[1]}</p>
              <p><strong>{t('sections.glossary.terms.aiVision').split(':')[0]}:</strong> {t('sections.glossary.terms.aiVision').split(':')[1]}</p>
              <p><strong>{t('sections.glossary.terms.embedding').split(':')[0]}:</strong> {t('sections.glossary.terms.embedding').split(':')[1]}</p>
              <p><strong>{t('sections.glossary.terms.semanticSearch').split(':')[0]}:</strong> {t('sections.glossary.terms.semanticSearch').split(':')[1]}</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
