import React from 'react';
import { Helmet } from 'react-helmet';
import { SearchDebugger } from '@/components/debug/SearchDebugger';
import { AISearchSimulator } from '@/components/debug/AISearchSimulator';
import { SearchParameterTester } from '@/components/debug/SearchParameterTester';
import { UnifiedSearchTester } from '@/components/debug/UnifiedSearchTester';

export default function DebugSearch() {
  return (
    <>
      <Helmet>
        <title>Search Debug - Mataresit</title>
        <meta name="description" content="Debug search functionality issues" />
      </Helmet>
      
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Search Debug</h1>
          <p className="text-muted-foreground">
            Diagnose and troubleshoot search functionality issues
          </p>
        </div>
        
        <div className="space-y-8">
          <UnifiedSearchTester />
          <SearchDebugger />
          <AISearchSimulator />
          <SearchParameterTester />
        </div>
      </div>
    </>
  );
}
