import { useState, useEffect } from "react";
import { Users, Crown, Shield, Eye, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUserTeamMemberships } from "@/services/profileService";
import { Link } from "react-router-dom";

interface TeamMembershipsProps {
  userId: string;
}

interface TeamMembership {
  id: string;
  role: string;
  joined_at: string;
  teams: {
    id: string;
    name: string;
    description?: string;
    status: string;
  };
}

const roleIcons = {
  owner: <Crown className="h-3 w-3" />,
  admin: <Shield className="h-3 w-3" />,
  member: <Users className="h-3 w-3" />,
  viewer: <Eye className="h-3 w-3" />
};

const roleColors = {
  owner: "bg-purple-100 text-purple-800 border-purple-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200", 
  member: "bg-green-100 text-green-800 border-green-200",
  viewer: "bg-gray-100 text-gray-800 border-gray-200"
};

export function TeamMemberships({ userId }: TeamMembershipsProps) {
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMemberships = async () => {
      try {
        const data = await getUserTeamMemberships(userId);
        setMemberships(data);
      } catch (error) {
        console.error("Error fetching team memberships:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemberships();
  }, [userId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Memberships</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-2/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Team Memberships</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to="/teams" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Manage Teams
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {memberships.length === 0 ? (
          <div className="text-center py-6">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">You're not a member of any teams yet.</p>
            <Button asChild variant="outline">
              <Link to="/teams">
                Explore Teams
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {memberships.map((membership) => (
              <div
                key={membership.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{membership.teams.name}</h4>
                    <Badge 
                      variant="outline" 
                      className={`gap-1 text-xs ${roleColors[membership.role as keyof typeof roleColors] || roleColors.member}`}
                    >
                      {roleIcons[membership.role as keyof typeof roleIcons]}
                      {membership.role.charAt(0).toUpperCase() + membership.role.slice(1)}
                    </Badge>
                  </div>
                  {membership.teams.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {membership.teams.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(membership.joined_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={membership.teams.status === 'active' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {membership.teams.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
