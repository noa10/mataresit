import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MessageCircle,
  Send,
  Plus,
  Search,
  MoreHorizontal,
  Users,
  Phone,
  Video,
  Paperclip,
  Smile,
  Reply,
  Edit,
  Trash2,
  Check,
  CheckCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { useTeam } from '@/contexts/TeamContext';
import { collaborationService, Conversation, Message } from '@/services/collaborationService';
import { enhancedTeamService } from '@/services/enhancedTeamService';
import { supabase } from '@/lib/supabase';

interface DirectMessagingProps {
  className?: string;
}

export function DirectMessaging({ className }: DirectMessagingProps) {
  const { currentTeam } = useTeam();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversations and team members
  useEffect(() => {
    if (currentTeam?.id) {
      loadConversations();
      loadTeamMembers();
    }
  }, [currentTeam?.id]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!currentTeam?.id) return;

    const conversationSubscription = collaborationService.subscribeToConversations(
      currentTeam.id,
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setConversations(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setConversations(prev => 
            prev.map(conv => conv.id === payload.new.id ? payload.new : conv)
          );
        }
      }
    );

    return () => {
      conversationSubscription.unsubscribe();
    };
  }, [currentTeam?.id]);

  useEffect(() => {
    if (!selectedConversation) return;

    const messageSubscription = collaborationService.subscribeToMessages(
      selectedConversation.id,
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [...prev, payload.new]);
          // Mark message as read if it's not from current user
          // Note: We need to get the current user ID properly
          const { data: user } = await supabase.auth.getUser();
          if (payload.new.sender_id !== user?.user?.id) {
            collaborationService.markMessageAsRead(payload.new.id);
          }
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => 
            prev.map(msg => msg.id === payload.new.id ? payload.new : msg)
          );
        }
      }
    );

    return () => {
      messageSubscription.unsubscribe();
    };
  }, [selectedConversation]);

  const loadConversations = async () => {
    if (!currentTeam?.id) return;
    
    setIsLoading(true);
    try {
      const response = await collaborationService.getConversations(currentTeam.id);
      if (response.success && response.data) {
        setConversations(response.data);
      } else {
        toast.error('Failed to load conversations');
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    if (!currentTeam?.id) return;
    
    try {
      const response = await enhancedTeamService.getTeamMembers(currentTeam.id);
      if (response.success && response.data) {
        setTeamMembers(response.data);
      }
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    setIsLoading(true);
    try {
      const response = await collaborationService.getMessages(conversationId);
      if (response.success && response.data) {
        setMessages(response.data);
      } else {
        toast.error('Failed to load messages');
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) return;

    setIsSending(true);
    try {
      const response = await collaborationService.sendMessage(
        selectedConversation.id,
        newMessage.trim()
      );
      
      if (response.success) {
        setNewMessage('');
        inputRef.current?.focus();
      } else {
        toast.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const createNewConversation = async (participantIds: string[]) => {
    if (!currentTeam?.id || participantIds.length === 0) return;

    try {
      const response = await collaborationService.createConversation(
        currentTeam.id,
        participantIds,
        participantIds.length > 1 ? 'group' : 'direct'
      );
      
      if (response.success && response.data) {
        setSelectedConversation(response.data);
        setNewConversationOpen(false);
        toast.success('Conversation created');
      } else {
        toast.error('Failed to create conversation');
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create conversation');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM dd, HH:mm');
    }
  };

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.title) return conversation.title;
    
    // For direct conversations, show the other participant's name
    const participants = Array.isArray(conversation.participants) 
      ? conversation.participants 
      : JSON.parse(conversation.participants || '[]');
    
    const otherParticipants = participants.filter(p => p !== currentTeam?.id);
    if (otherParticipants.length === 1) {
      const member = teamMembers.find(m => m.user_id === otherParticipants[0]);
      return member ? `${member.first_name} ${member.last_name}` : 'Unknown User';
    }
    
    return `Group (${participants.length} members)`;
  };

  const filteredConversations = conversations.filter(conv =>
    getConversationTitle(conv).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={cn("flex h-[600px] border rounded-lg overflow-hidden", className)}>
      {/* Conversations Sidebar */}
      <div className="w-80 border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Messages
            </h3>
            <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Conversation</DialogTitle>
                  <DialogDescription>
                    Start a new conversation with team members
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div
                        key={member.user_id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                        onClick={() => createNewConversation([member.user_id])}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar_url} />
                          <AvatarFallback>
                            {member.first_name?.[0]}{member.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {member.first_name} {member.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.email}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {member.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-accent",
                  selectedConversation?.id === conversation.id && "bg-accent"
                )}
                onClick={() => setSelectedConversation(conversation)}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {conversation.conversation_type === 'group' ? (
                      <Users className="h-5 w-5" />
                    ) : (
                      getConversationTitle(conversation)[0]
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm truncate">
                      {getConversationTitle(conversation)}
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    Last message preview...
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {selectedConversation.conversation_type === 'group' ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      getConversationTitle(selectedConversation)[0]
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-medium">{getConversationTitle(selectedConversation)}</h4>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.conversation_type === 'group' ? 'Group conversation' : 'Direct message'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Video className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Users className="h-4 w-4 mr-2" />
                      View Members
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Search className="h-4 w-4 mr-2" />
                      Search Messages
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isOwn = message.sender_id === currentTeam?.id;
                  const showAvatar = !isOwn && (index === 0 || messages[index - 1].sender_id !== message.sender_id);
                  
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3",
                        isOwn ? "justify-end" : "justify-start"
                      )}
                    >
                      {!isOwn && (
                        <Avatar className={cn("h-8 w-8", !showAvatar && "invisible")}>
                          <AvatarFallback>
                            {teamMembers.find(m => m.user_id === message.sender_id)?.first_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div className={cn("max-w-[70%]", isOwn && "text-right")}>
                        <div
                          className={cn(
                            "inline-block p-3 rounded-lg",
                            isOwn 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm">{message.content}</p>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatMessageTime(message.created_at)}
                          </span>
                          {isOwn && (
                            <div className="text-xs text-muted-foreground">
                              {Object.keys(message.read_by || {}).length > 1 ? (
                                <CheckCheck className="h-3 w-3" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    disabled={isSending}
                  />
                </div>
                <Button variant="ghost" size="sm">
                  <Smile className="h-4 w-4" />
                </Button>
                <Button 
                  onClick={sendMessage} 
                  disabled={!newMessage.trim() || isSending}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Select a conversation</h3>
              <p className="text-sm text-muted-foreground">
                Choose a conversation from the sidebar to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
