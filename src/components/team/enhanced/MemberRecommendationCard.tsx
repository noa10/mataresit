import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Sparkles,
  Users,
  TrendingUp,
  MessageCircle,
  UserPlus,
  X,
  Crown,
  Shield,
  User,
  Eye,
  Activity,
  Receipt
} from 'lucide-react';
import { TeamMemberRole, EnhancedMemberSearchResult } from '@/types/team';
import { useTeam } from '@/contexts/TeamContext';
import { enhancedTeamService } from '@/services/enhancedTeamService';
import { preferenceLearningService } from '@/services/preferenceLearningService';

interface MemberRecommendation {
  member: EnhancedMemberSearchResult;
  reason: string;
  score: number;
  category: 'collaboration' | 'activity_pattern' | 'skill_complement' | 'engagement';
  details: string[];
}

interface MemberRecommendationCardProps {
  className?: string;
  maxRecommendations?: number;
  onMemberSelect?: (member: EnhancedMemberSearchResult) => void;
}

export function MemberRecommendationCard({
  className,
  maxRecommendations = 3,
  onMemberSelect
}: MemberRecommendationCardProps) {
  const { currentTeam } = useTeam();
  const [recommendations, setRecommendations] = useState<MemberRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (currentTeam?.id) {
      generateRecommendations();
    }
  }, [currentTeam?.id]);

  const generateRecommendations = async () => {
    if (!currentTeam?.id) return;

    setIsLoading(true);
    try {
      // Get team members with analytics
      const response = await enhancedTeamService.searchMembersAdvanced({
        team_id: currentTeam.id,
        limit: 50,
        sort_by: 'activity_score',
        sort_order: 'desc'
      });

      if (response.success && response.data?.members) {
        const members = response.data.members;
        const recs = await analyzeAndGenerateRecommendations(members);
        setRecommendations(recs.slice(0, maxRecommendations));
      }
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeAndGenerateRecommendations = async (members: EnhancedMemberSearchResult[]): Promise<MemberRecommendation[]> => {
    const recommendations: MemberRecommendation[] = [];

    // Sort members by different criteria for recommendations
    const activeMembers = members.filter(m => m.member_status === 'very_active' || m.member_status === 'active');
    const engagedMembers = members.filter(m => m.receipt_metrics.total_receipts > 10);
    const recentlyJoined = members.filter(m => {
      const joinDate = new Date(m.joined_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return joinDate > thirtyDaysAgo;
    });

    // Recommendation 1: Most Active Collaborator
    if (activeMembers.length > 0) {
      const topActive = activeMembers[0];
      recommendations.push({
        member: topActive,
        reason: 'Most Active Team Member',
        score: topActive.activity_metrics.activity_score || 0,
        category: 'activity_pattern',
        details: [
          `${topActive.activity_metrics.total_activities} total activities`,
          `${topActive.activity_metrics.active_days} active days`,
          `${topActive.receipt_metrics.total_receipts} receipts processed`
        ]
      });
    }

    // Recommendation 2: High Engagement Member
    if (engagedMembers.length > 0) {
      const topEngaged = engagedMembers.sort((a, b) => 
        b.receipt_metrics.total_receipts - a.receipt_metrics.total_receipts
      )[0];
      
      if (!recommendations.find(r => r.member.user_id === topEngaged.user_id)) {
        recommendations.push({
          member: topEngaged,
          reason: 'Highest Receipt Processing',
          score: topEngaged.receipt_metrics.total_receipts,
          category: 'engagement',
          details: [
            `${topEngaged.receipt_metrics.total_receipts} receipts processed`,
            `${topEngaged.receipt_metrics.categories_used} categories used`,
            `$${topEngaged.receipt_metrics.total_amount.toFixed(2)} total amount`
          ]
        });
      }
    }

    // Recommendation 3: New Member to Connect With
    if (recentlyJoined.length > 0) {
      const newMember = recentlyJoined.sort((a, b) => 
        new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
      )[0];
      
      if (!recommendations.find(r => r.member.user_id === newMember.user_id)) {
        recommendations.push({
          member: newMember,
          reason: 'New Team Member',
          score: 100, // High priority for new members
          category: 'collaboration',
          details: [
            `Joined ${new Date(newMember.joined_at).toLocaleDateString()}`,
            `${newMember.role} role`,
            'Great opportunity to connect and onboard'
          ]
        });
      }
    }

    // Recommendation 4: Skill Complement (based on role diversity)
    const roleDistribution = members.reduce((acc, member) => {
      acc[member.role] = (acc[member.role] || 0) + 1;
      return acc;
    }, {} as Record<TeamMemberRole, number>);

    const rareRoles = Object.entries(roleDistribution)
      .filter(([role, count]) => count === 1 && role !== 'owner')
      .map(([role]) => role as TeamMemberRole);

    if (rareRoles.length > 0) {
      const rareRoleMember = members.find(m => rareRoles.includes(m.role));
      if (rareRoleMember && !recommendations.find(r => r.member.user_id === rareRoleMember.user_id)) {
        recommendations.push({
          member: rareRoleMember,
          reason: 'Unique Role Expertise',
          score: 90,
          category: 'skill_complement',
          details: [
            `Only ${rareRoleMember.role} in the team`,
            'Valuable specialized perspective',
            'Key for role-specific decisions'
          ]
        });
      }
    }

    return recommendations.sort((a, b) => b.score - a.score);
  };

  const getRoleIcon = (role: TeamMemberRole) => {
    switch (role) {
      case 'owner': return <Crown className="h-3 w-3" />;
      case 'admin': return <Shield className="h-3 w-3" />;
      case 'member': return <User className="h-3 w-3" />;
      case 'viewer': return <Eye className="h-3 w-3" />;
      default: return <User className="h-3 w-3" />;
    }
  };

  const getCategoryIcon = (category: MemberRecommendation['category']) => {
    switch (category) {
      case 'collaboration': return <Users className="h-4 w-4" />;
      case 'activity_pattern': return <Activity className="h-4 w-4" />;
      case 'skill_complement': return <TrendingUp className="h-4 w-4" />;
      case 'engagement': return <Receipt className="h-4 w-4" />;
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: MemberRecommendation['category']) => {
    switch (category) {
      case 'collaboration': return 'bg-blue-100 text-blue-800';
      case 'activity_pattern': return 'bg-green-100 text-green-800';
      case 'skill_complement': return 'bg-purple-100 text-purple-800';
      case 'engagement': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleMemberClick = async (recommendation: MemberRecommendation) => {
    // Track recommendation interaction
    await preferenceLearningService.trackInteraction(
      'ui_action',
      {
        action: 'member_recommendation_clicked',
        member_id: recommendation.member.user_id,
        recommendation_reason: recommendation.reason,
        recommendation_category: recommendation.category,
        team_id: currentTeam?.id
      }
    );

    if (onMemberSelect) {
      onMemberSelect(recommendation.member);
    }
  };

  const dismissRecommendations = async () => {
    setIsVisible(false);
    
    // Track dismissal
    await preferenceLearningService.trackInteraction(
      'ui_action',
      {
        action: 'member_recommendations_dismissed',
        team_id: currentTeam?.id,
        recommendations_count: recommendations.length
      }
    );
  };

  if (!isVisible || (!isLoading && recommendations.length === 0)) {
    return null;
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Member Recommendations</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={dismissRecommendations}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <CardDescription>
          Team members you might want to connect with or collaborate on projects
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 border rounded-lg animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((recommendation, index) => (
              <div
                key={recommendation.member.user_id}
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => handleMemberClick(recommendation)}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={recommendation.member.avatar_url} />
                  <AvatarFallback>
                    {recommendation.member.first_name?.[0]}{recommendation.member.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm truncate">
                      {recommendation.member.full_name}
                    </h4>
                    <div className="flex items-center gap-1">
                      {getRoleIcon(recommendation.member.role)}
                      <Badge variant="outline" className="text-xs">
                        {recommendation.member.role}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    {getCategoryIcon(recommendation.category)}
                    <span className="text-sm font-medium">{recommendation.reason}</span>
                    <Badge className={cn("text-xs", getCategoryColor(recommendation.category))}>
                      Score: {recommendation.score}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1">
                    {recommendation.details.map((detail, detailIndex) => (
                      <div key={detailIndex} className="text-xs text-muted-foreground flex items-center gap-1">
                        <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
                        {detail}
                      </div>
                    ))}
                  </div>
                </div>
                
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MessageCircle className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        
        {!isLoading && recommendations.length > 0 && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={generateRecommendations}
              className="w-full"
            >
              <Sparkles className="h-3 w-3 mr-2" />
              Refresh Recommendations
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
