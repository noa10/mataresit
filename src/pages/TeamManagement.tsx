import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Loader2, RotateCw, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ledger/EmptyState";
import { Panel } from "@/components/ledger/Panel";
import { StatusChip } from "@/components/ledger/StatusChip";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardTranslation, useLanguage } from "@/contexts/LanguageContext";
import { useTeam } from "@/contexts/TeamContext";
import { useToast } from "@/hooks/use-toast";
import { teamService } from "@/services/teamService";
import type { TeamInvitation, TeamMember, TeamMemberRole } from "@/types/team";
import { cn } from "@/lib/utils";

const ASSIGNABLE_ROLES: TeamMemberRole[] = ["admin", "member", "viewer"];

const initialsFor = (value: string) => {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const roleChipClass = (role: TeamMemberRole) => {
  if (role === "owner") return "bg-ledger-panel text-ledger-on-panel";
  if (role === "admin") return "bg-ledger-accent-soft text-ledger-accent";
  return "bg-ledger-surface-2 text-ledger-ink-2";
};

export default function TeamManagement() {
  const { t } = useDashboardTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    currentTeam,
    teamMembers,
    loading,
    hasPermission,
    updateTeamMemberRole,
    removeTeamMember,
  } = useTeam();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamMemberRole>("member");
  const [isInviting, setIsInviting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [invitationAction, setInvitationAction] = useState<string | null>(null);
  const [invitationToRevoke, setInvitationToRevoke] = useState<TeamInvitation | null>(null);

  const canView = hasPermission("view_members");
  const canInvite = hasPermission("invite_members");
  const canManageRoles = hasPermission("update_member_roles");
  const canRemoveMembers = hasPermission("remove_members");

  const invitationsKey = ["workspace", "team-invitations", currentTeam?.id ?? null] as const;

  const { data: invitations = [] } = useQuery({
    queryKey: invitationsKey,
    queryFn: () => teamService.getTeamInvitations(currentTeam!.id),
    enabled: Boolean(currentTeam?.id && canView),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === "pending"),
    [invitations]
  );

  const roleLabel = (role: TeamMemberRole) => t(`workspace.teams.roles.${role}`);

  const formatMonth = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat(language === "ms" ? "ms-MY" : "en-MY", {
        month: "short",
        year: "numeric",
      }).format(date);
    } catch {
      return "—";
    }
  };

  const formatDay = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat(language === "ms" ? "ms-MY" : "en-MY", {
        day: "numeric",
        month: "short",
      }).format(date);
    } catch {
      return "—";
    }
  };

  const activityTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    try {
      const locale = language === "ms" ? "ms-MY" : "en-MY";
      return new Intl.DateTimeFormat(
        locale,
        sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }
      ).format(date);
    } catch {
      return "";
    }
  };

  const memberName = (member: TeamMember) => {
    const name = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
    return name || member.email || "—";
  };

  const activityItems = useMemo(() => {
    const items: Array<{ id: string; at: string; name: string; text: string }> = [];
    for (const member of teamMembers) {
      items.push({
        id: `member-${member.id}`,
        at: member.joined_at,
        name: memberName(member),
        text: t("workspace.teams.activityTypes.member_joined"),
      });
    }
    for (const invitation of pendingInvitations) {
      items.push({
        id: `invite-${invitation.id}`,
        at: invitation.created_at,
        name: invitation.email,
        text: t("workspace.teams.activityTypes.invited", { role: roleLabel(invitation.role) }),
      });
    }
    return items
      .filter((item) => Boolean(item.at))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMembers, pendingInvitations, t, language]);

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentTeam) return;
    const email = inviteEmail.trim();
    if (!email) return;

    setIsInviting(true);
    try {
      await teamService.inviteTeamMember({
        team_id: currentTeam.id,
        email,
        role: inviteRole,
      });
      toast({
        title: t("workspace.teams.sent"),
        description: t("workspace.teams.sentDescription", {
          email,
          role: roleLabel(inviteRole),
        }),
      });
      setInviteEmail("");
      setInviteRole("member");
      setInviteOpen(false);
      queryClient.invalidateQueries({ queryKey: invitationsKey });
    } catch (error) {
      toast({
        title: t("workspace.teams.failed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (member: TeamMember, role: TeamMemberRole) => {
    if (!currentTeam || role === member.role) return;
    setUpdatingMemberId(member.user_id);
    try {
      await updateTeamMemberRole(currentTeam.id, member.user_id, role);
    } catch {
      // TeamContext already shows the failure toast.
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!currentTeam || !memberToRemove) return;
    setIsRemovingMember(true);
    try {
      await removeTeamMember(currentTeam.id, memberToRemove.user_id);
      toast({
        title: t("workspace.teams.memberRemoved"),
        description: t("workspace.teams.memberRemovedDescription", {
          name: memberName(memberToRemove),
        }),
      });
      setMemberToRemove(null);
    } catch {
      // TeamContext already shows the failure toast.
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleRevokeInvitation = async () => {
    if (!invitationToRevoke) return;
    const invitation = invitationToRevoke;
    setInvitationAction(`${invitation.id}:revoke`);
    try {
      await teamService.cancelInvitation(invitation.id);
      toast({
        title: t("workspace.teams.inviteRevoked"),
        description: t("workspace.teams.inviteRevokedDescription", { email: invitation.email }),
      });
      setInvitationToRevoke(null);
      queryClient.invalidateQueries({ queryKey: invitationsKey });
    } catch (error) {
      toast({
        title: t("workspace.teams.inviteRevokeFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setInvitationAction(null);
    }
  };

  const handleResendInvitation = async (invitation: TeamInvitation) => {
    setInvitationAction(`${invitation.id}:resend`);
    try {
      await teamService.resendInvitationEnhanced(invitation.id, { sendEmail: true });
      toast({
        title: t("workspace.teams.inviteResent"),
        description: t("workspace.teams.inviteResentDescription", { email: invitation.email }),
      });
      queryClient.invalidateQueries({ queryKey: invitationsKey });
    } catch (error) {
      toast({
        title: t("workspace.teams.inviteResendFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setInvitationAction(null);
    }
  };

  const memberCount = teamMembers.length;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7">
      <header className="flex flex-wrap items-end justify-between gap-[18px]">
        <div className="min-w-0">
          <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
            {t("workspace.teams.eyebrow", { name: currentTeam?.name ?? "—" })}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ledger-ink">
            {t("workspace.teams.title")}
          </h1>
          <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ledger-muted">
            {t("workspace.teams.lede")}
          </p>
        </div>

        {canInvite && currentTeam && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="accent" size="app" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              {t("workspace.teams.invite")}
            </Button>
          </div>
        )}
      </header>

      {!currentTeam ? (
        <div className="mt-7">
          <EmptyState
            title={t("workspace.teams.noTeamTitle")}
            description={t("workspace.teams.noTeamLede")}
          />
        </div>
      ) : !canView ? (
        <div className="mt-7">
          <EmptyState
            title={t("workspace.teams.restrictedTitle")}
            description={t("workspace.teams.restrictedLede")}
          />
        </div>
      ) : (
        <div className="mt-7 grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Panel
            title={t("workspace.teams.members")}
            action={
              <span className="font-data text-[0.625rem] text-ledger-muted">
                {t("workspace.teams.membersMeta", {
                  count: memberCount,
                  pending: pendingInvitations.length,
                })}
              </span>
            }
            flush
          >
            {loading.members ? (
              <div className="divide-y divide-ledger-line" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="h-[58px] animate-pulse bg-ledger-surface-2/60" />
                ))}
              </div>
            ) : memberCount === 0 && pendingInvitations.length === 0 ? (
              <div className="p-[18px]">
                <EmptyState
                  title={t("workspace.teams.noMembers")}
                  description={t("workspace.teams.noMembersLede")}
                />
              </div>
            ) : (
              <div>
                <div className="hidden grid-cols-[minmax(0,2fr)_104px_96px_92px_84px] items-center gap-3.5 border-b border-ledger-line bg-ledger-surface-2 px-4 py-2.5 lg:grid">
                  <span className="font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                    {t("workspace.teams.member")}
                  </span>
                  <span className="font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                    {t("workspace.teams.role")}
                  </span>
                  <span className="font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                    {t("workspace.teams.status")}
                  </span>
                  <span className="font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                    {t("workspace.teams.joined")}
                  </span>
                  <span className="sr-only">{t("workspace.teams.actions")}</span>
                </div>

                <div className="divide-y divide-ledger-line">
                  {teamMembers.map((member) => {
                    const name = memberName(member);
                    const editable =
                      canManageRoles && member.role !== "owner" && member.user_id !== user?.id;
                    return (
                      <div
                        key={member.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 lg:grid-cols-[minmax(0,2fr)_104px_96px_92px_84px] lg:gap-3.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-ledger-accent-soft font-data text-[0.625rem] text-ledger-accent"
                          >
                            {initialsFor(name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-ledger-ink">
                              {name}
                            </span>
                            <span className="mt-0.5 block truncate font-data text-[0.625rem] text-ledger-muted">
                              {member.email || "—"}
                            </span>
                          </span>
                        </div>
                        <div className="hidden lg:block">
                          {editable ? (
                            <Select
                              value={member.role}
                              onValueChange={(value) =>
                                handleRoleChange(member, value as TeamMemberRole)
                              }
                              disabled={updatingMemberId === member.user_id}
                            >
                              <SelectTrigger
                                aria-label={t("workspace.teams.role")}
                                className="h-7 w-[104px] rounded-full border-ledger-line-strong bg-transparent px-2.5 font-data text-[0.5625rem] uppercase tracking-[0.1em] text-ledger-ink-2"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ASSIGNABLE_ROLES.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {roleLabel(role)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-1 font-data text-[0.5625rem] uppercase tracking-[0.1em]",
                                roleChipClass(member.role)
                              )}
                            >
                              {roleLabel(member.role)}
                            </span>
                          )}
                        </div>
                        <div className="hidden lg:block">
                          <StatusChip tone="reviewed" label={t("workspace.teams.active")} />
                        </div>
                        <span className="hidden font-data text-[0.6875rem] text-ledger-muted lg:block">
                          {formatMonth(member.joined_at)}
                        </span>
                        <div className="hidden justify-end lg:flex">
                          {canRemoveMembers && member.role !== "owner" && member.user_id !== user?.id && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-ledger-muted hover:bg-ledger-danger/10 hover:text-ledger-danger"
                              onClick={() => setMemberToRemove(member)}
                              aria-label={t("workspace.teams.removeMemberAria", { name })}
                              title={t("workspace.teams.removeMember")}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-1 lg:hidden">
                          <StatusChip tone="reviewed" label={t("workspace.teams.active")} />
                          {canRemoveMembers && member.role !== "owner" && member.user_id !== user?.id && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-ledger-muted hover:bg-ledger-danger/10 hover:text-ledger-danger"
                              onClick={() => setMemberToRemove(member)}
                              aria-label={t("workspace.teams.removeMemberAria", { name })}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 lg:grid-cols-[minmax(0,2fr)_104px_96px_92px_84px] lg:gap-3.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-ledger-amber-soft font-data text-[0.625rem] text-ledger-amber"
                        >
                          {initialsFor(invitation.email)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ledger-ink">
                            {invitation.email}
                          </span>
                          <span className="mt-0.5 block truncate font-data text-[0.625rem] text-ledger-muted">
                            {t("workspace.teams.invitedOn", { date: formatDay(invitation.created_at) })}
                          </span>
                        </span>
                      </div>
                      <div className="hidden lg:block">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 font-data text-[0.5625rem] uppercase tracking-[0.1em]",
                            roleChipClass(invitation.role)
                          )}
                        >
                          {roleLabel(invitation.role)}
                        </span>
                      </div>
                      <div className="hidden lg:block">
                        <StatusChip tone="unreviewed" label={t("workspace.teams.pendingStatus")} />
                      </div>
                      <span className="hidden font-data text-[0.6875rem] text-ledger-muted lg:block">
                        —
                      </span>
                      <div className="hidden items-center justify-end gap-1 lg:flex">
                        {canInvite && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-ledger-muted hover:bg-ledger-surface-2 hover:text-ledger-ink"
                              onClick={() => handleResendInvitation(invitation)}
                              disabled={invitationAction !== null}
                              aria-label={t("workspace.teams.resendInviteAria", { email: invitation.email })}
                              title={t("workspace.teams.resendInvite")}
                            >
                              {invitationAction === `${invitation.id}:resend` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-ledger-muted hover:bg-ledger-danger/10 hover:text-ledger-danger"
                              onClick={() => setInvitationToRevoke(invitation)}
                              disabled={invitationAction !== null}
                              aria-label={t("workspace.teams.revokeInviteAria", { email: invitation.email })}
                              title={t("workspace.teams.revokeInvite")}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-1 lg:hidden">
                        <StatusChip tone="unreviewed" label={t("workspace.teams.pendingStatus")} />
                        {canInvite && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-ledger-muted hover:bg-ledger-surface-2 hover:text-ledger-ink"
                              onClick={() => handleResendInvitation(invitation)}
                              disabled={invitationAction !== null}
                              aria-label={t("workspace.teams.resendInviteAria", { email: invitation.email })}
                            >
                              {invitationAction === `${invitation.id}:resend` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-ledger-muted hover:bg-ledger-danger/10 hover:text-ledger-danger"
                              onClick={() => setInvitationToRevoke(invitation)}
                              disabled={invitationAction !== null}
                              aria-label={t("workspace.teams.revokeInviteAria", { email: invitation.email })}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title={t("workspace.teams.activity")}
            action={
              <span className="font-data text-[0.625rem] text-ledger-muted">
                {t("workspace.teams.activityMeta")}
              </span>
            }
          >
            {activityItems.length === 0 ? (
              <div className="py-6 text-center">
                <Clock3 className="mx-auto h-6 w-6 text-ledger-muted" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-ledger-ink">
                  {t("workspace.teams.noActivity")}
                </p>
                <p className="mt-1 text-xs text-ledger-muted">
                  {t("workspace.teams.noActivityLede")}
                </p>
              </div>
            ) : (
              <ol className="grid gap-3.5">
                {activityItems.map((item) => (
                  <li
                    key={item.id}
                    className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-3.5"
                  >
                    <span className="font-data text-[0.625rem] text-ledger-muted">
                      {activityTime(item.at)}
                    </span>
                    <span className="text-sm leading-relaxed text-ledger-ink-2">
                      <b className="font-semibold text-ledger-ink">{item.name}</b> {item.text}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}

      <AlertDialog
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => {
          if (!open && !isRemovingMember) setMemberToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("workspace.teams.removeMemberTitle", {
                name: memberToRemove ? memberName(memberToRemove) : "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("workspace.teams.removeMemberDescription", {
                team: currentTeam?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingMember}>
              {t("workspace.profile.close")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleRemoveMember();
              }}
              disabled={isRemovingMember}
            >
              {isRemovingMember
                ? t("workspace.teams.removingMember")
                : t("workspace.teams.removeMember")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(invitationToRevoke)}
        onOpenChange={(open) => {
          if (!open && !invitationAction) setInvitationToRevoke(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workspace.teams.revokeInviteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workspace.teams.revokeInviteDescription", {
                email: invitationToRevoke?.email ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(invitationAction)}>
              {t("workspace.profile.close")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleRevokeInvitation();
              }}
              disabled={Boolean(invitationAction)}
            >
              {invitationAction === `${invitationToRevoke?.id}:revoke`
                ? t("workspace.teams.revokingInvite")
                : t("workspace.teams.revokeInvite")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t("workspace.teams.inviteTitle")}</DialogTitle>
            <DialogDescription>
              {t("workspace.teams.inviteDescription", { team: currentTeam?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-invite-email">{t("workspace.teams.email")}</Label>
              <Input
                id="team-invite-email"
                type="email"
                required
                autoComplete="email"
                placeholder={t("workspace.teams.emailPlaceholder")}
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("workspace.teams.role")}</Label>
              <Select
                value={inviteRole}
                onValueChange={(value) => setInviteRole(value as TeamMemberRole)}
              >
                <SelectTrigger aria-label={t("workspace.teams.role")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                {t("workspace.profile.close")}
              </Button>
              <Button type="submit" variant="accent" disabled={isInviting || !inviteEmail.trim()}>
                {isInviting ? t("workspace.teams.sending") : t("workspace.teams.send")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
