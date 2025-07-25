import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Search,
  Filter,
  Bookmark,
  Sparkles,
  Users,
  TrendingUp,
  CheckCircle
} from 'lucide-react';
import { AdvancedMemberSearchInput } from './AdvancedMemberSearchInput';
import { MemberFilterBuilder, MemberFilters } from './MemberFilterBuilder';
import { SavedSearchManager, SavedSearch } from './SavedSearchManager';
import { MemberRecommendationCard } from './MemberRecommendationCard';

export function AdvancedMemberSearchDemo() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<MemberFilters>({
    roles: [],
    statuses: [],
    activityLevels: [],
    joinDateRange: {},
    lastActiveRange: {},
    engagementScoreRange: {},
    receiptCountRange: {},
  });
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleSearch = async (query: string, suggestions?: any[]) => {
    setSearchQuery(query);
    // In a real implementation, this would call the search API
    console.log('Searching for:', query, 'with filters:', filters);
    
    // Mock search results for demo
    setSearchResults([
      {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        status: 'active',
        activity_score: 85
      },
      {
        id: '2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'member',
        status: 'active',
        activity_score: 92
      }
    ]);
  };

  const handleSavedSearchLoad = (savedSearch: SavedSearch) => {
    setSearchQuery(savedSearch.query);
    setFilters(savedSearch.filters);
    handleSearch(savedSearch.query);
  };

  const getActiveFilterCount = () => {
    return (
      filters.roles.length +
      filters.statuses.length +
      filters.activityLevels.length +
      (filters.joinDateRange.start || filters.joinDateRange.end ? 1 : 0) +
      (filters.lastActiveRange.start || filters.lastActiveRange.end ? 1 : 0) +
      (filters.engagementScoreRange.min !== undefined || filters.engagementScoreRange.max !== undefined ? 1 : 0) +
      (filters.receiptCountRange.min !== undefined || filters.receiptCountRange.max !== undefined ? 1 : 0)
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Advanced Member Search & Filtering</h1>
        <p className="text-muted-foreground">
          Comprehensive search functionality with intelligent filtering, saved searches, and member recommendations.
        </p>
      </div>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm">Smart Search</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Real-time autocomplete with member suggestions and search history
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-green-600" />
              <CardTitle className="text-sm">Advanced Filters</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Multi-criteria filtering with visual filter builder interface
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-sm">Saved Searches</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Save and share frequently used searches with team members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-sm">Smart Recommendations</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              AI-powered member recommendations based on activity patterns
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Demo Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Search Interface */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Interface
              </CardTitle>
              <CardDescription>
                Try the advanced search functionality with autocomplete and filtering
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Input */}
              <div className="space-y-4">
                <AdvancedMemberSearchInput
                  onSearch={handleSearch}
                  placeholder="Search team members by name, email, or role..."
                  className="w-full"
                />
                
                <div className="flex items-center gap-4">
                  <MemberFilterBuilder
                    filters={filters}
                    onFiltersChange={setFilters}
                    onReset={() => setFilters({
                      roles: [],
                      statuses: [],
                      activityLevels: [],
                      joinDateRange: {},
                      lastActiveRange: {},
                      engagementScoreRange: {},
                      receiptCountRange: {},
                    })}
                  />
                  
                  <SavedSearchManager
                    currentQuery={searchQuery}
                    currentFilters={filters}
                    onSearchLoad={handleSavedSearchLoad}
                  />
                </div>
              </div>

              {/* Active Filters Display */}
              {getActiveFilterCount() > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Active Filters:</h4>
                  <div className="flex flex-wrap gap-2">
                    {filters.roles.map(role => (
                      <Badge key={role} variant="secondary">{role}</Badge>
                    ))}
                    {filters.statuses.map(status => (
                      <Badge key={status} variant="secondary">{status}</Badge>
                    ))}
                    {filters.activityLevels.map(level => (
                      <Badge key={level} variant="secondary">{level}</Badge>
                    ))}
                    {(filters.joinDateRange.start || filters.joinDateRange.end) && (
                      <Badge variant="secondary">Join Date Range</Badge>
                    )}
                    {(filters.engagementScoreRange.min !== undefined || filters.engagementScoreRange.max !== undefined) && (
                      <Badge variant="secondary">Engagement Score</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <Separator />
                  <h4 className="text-sm font-medium">Search Results ({searchResults.length})</h4>
                  <div className="space-y-2">
                    {searchResults.map((result) => (
                      <div key={result.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Users className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{result.name}</div>
                            <div className="text-xs text-muted-foreground">{result.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{result.role}</Badge>
                          <Badge variant="outline" className="text-green-600">
                            {result.activity_score}% active
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Implementation Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Implementation Status
              </CardTitle>
              <CardDescription>
                Phase 1: Enhanced Search UI Components - Completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">AdvancedMemberSearchInput with autocomplete</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">MemberFilterBuilder with visual interface</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">SavedSearchManager with user preferences</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Enhanced EnhancedMemberTable integration</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">MemberRecommendationCard with AI insights</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recommendations Sidebar */}
        <div className="space-y-6">
          <MemberRecommendationCard
            maxRecommendations={3}
            onMemberSelect={(member) => {
              console.log('Selected member:', member);
              // In a real implementation, this would navigate to member details
            }}
          />

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Next Steps</CardTitle>
              <CardDescription>
                Upcoming phases in the implementation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Phase 2: Database Integration</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Enhanced database schema for saved searches</li>
                  <li>• Performance optimization with caching</li>
                  <li>• Real-time search result updates</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Phase 3: AI Recommendations</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Advanced recommendation algorithms</li>
                  <li>• Team collaboration analysis</li>
                  <li>• Skill complementarity suggestions</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Phase 4: Analytics & Insights</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Search usage analytics</li>
                  <li>• Member discovery insights</li>
                  <li>• Team formation recommendations</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
