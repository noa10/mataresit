import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  FolderOpen,
  Plus,
  Calendar,
  Users,
  Clock,
  Target,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle,
  Circle,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  XCircle,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTeam } from '@/contexts/TeamContext';
import { collaborationService, Project, ProjectTask } from '@/services/collaborationService';
import { enhancedTeamService } from '@/services/enhancedTeamService';

interface ProjectManagementProps {
  className?: string;
}

export function ProjectManagement({ className }: ProjectManagementProps) {
  const { currentTeam } = useTeam();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    status: 'planning' as Project['status'],
    priority: 'medium' as Project['priority'],
    start_date: '',
    due_date: '',
    assigned_to: '',
    budget_allocated: '',
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    status: 'todo' as ProjectTask['status'],
    priority: 'medium' as ProjectTask['priority'],
    assigned_to: '',
    due_date: '',
    estimated_hours: '',
  });

  useEffect(() => {
    if (currentTeam?.id) {
      loadProjects();
      loadTeamMembers();
    }
  }, [currentTeam?.id]);

  useEffect(() => {
    if (selectedProject) {
      loadTasks(selectedProject.id);
    }
  }, [selectedProject]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!currentTeam?.id) return;

    const projectSubscription = collaborationService.subscribeToProjects(
      currentTeam.id,
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setProjects(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setProjects(prev => 
            prev.map(project => project.id === payload.new.id ? payload.new : project)
          );
          if (selectedProject?.id === payload.new.id) {
            setSelectedProject(payload.new);
          }
        } else if (payload.eventType === 'DELETE') {
          setProjects(prev => prev.filter(project => project.id !== payload.old.id));
          if (selectedProject?.id === payload.old.id) {
            setSelectedProject(null);
          }
        }
      }
    );

    return () => {
      projectSubscription.unsubscribe();
    };
  }, [currentTeam?.id, selectedProject]);

  const loadProjects = async () => {
    if (!currentTeam?.id) return;
    
    setIsLoading(true);
    try {
      const response = await collaborationService.getProjects(currentTeam.id);
      if (response.success && response.data) {
        setProjects(response.data);
      } else {
        toast.error('Failed to load projects');
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      toast.error('Failed to load projects');
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

  const loadTasks = async (projectId: string) => {
    try {
      const response = await collaborationService.getProjectTasks(projectId);
      if (response.success && response.data) {
        setTasks(response.data);
      } else {
        toast.error('Failed to load tasks');
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
    }
  };

  const createProject = async () => {
    if (!currentTeam?.id || !projectForm.name.trim()) return;

    try {
      const projectData = {
        ...projectForm,
        budget_allocated: projectForm.budget_allocated ? parseFloat(projectForm.budget_allocated) : undefined,
      };

      const response = await collaborationService.createProject(currentTeam.id, projectData);
      
      if (response.success && response.data) {
        setCreateProjectOpen(false);
        setProjectForm({
          name: '',
          description: '',
          status: 'planning',
          priority: 'medium',
          start_date: '',
          due_date: '',
          assigned_to: '',
          budget_allocated: '',
        });
        toast.success('Project created successfully');
      } else {
        toast.error('Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
    }
  };

  const createTask = async () => {
    if (!selectedProject || !taskForm.title.trim()) return;

    try {
      const taskData = {
        ...taskForm,
        estimated_hours: taskForm.estimated_hours ? parseFloat(taskForm.estimated_hours) : undefined,
      };

      const response = await collaborationService.createTask(selectedProject.id, taskData);
      
      if (response.success && response.data) {
        setCreateTaskOpen(false);
        setTaskForm({
          title: '',
          description: '',
          status: 'todo',
          priority: 'medium',
          assigned_to: '',
          due_date: '',
          estimated_hours: '',
        });
        toast.success('Task created successfully');
      } else {
        toast.error('Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    }
  };

  const getStatusIcon = (status: Project['status'] | ProjectTask['status']) => {
    switch (status) {
      case 'planning': return <Circle className="h-4 w-4 text-gray-500" />;
      case 'active': case 'in_progress': return <PlayCircle className="h-4 w-4 text-blue-500" />;
      case 'on_hold': return <PauseCircle className="h-4 w-4 text-yellow-500" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'todo': return <Circle className="h-4 w-4 text-gray-500" />;
      case 'review': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default: return <Circle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: Project['priority'] | ProjectTask['priority']) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'urgent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProjectProgress = (project: Project) => {
    if (tasks.length === 0) return 0;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    return Math.round((completedTasks / tasks.length) * 100);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Project Management</h2>
          <p className="text-muted-foreground">
            Manage team projects and track progress
          </p>
        </div>
        <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Set up a new project for your team to collaborate on.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name *</Label>
                <Input
                  id="project-name"
                  placeholder="Enter project name"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  placeholder="Project description..."
                  value={projectForm.description}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-status">Status</Label>
                  <Select
                    value={projectForm.status}
                    onValueChange={(value: Project['status']) => 
                      setProjectForm(prev => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-priority">Priority</Label>
                  <Select
                    value={projectForm.priority}
                    onValueChange={(value: Project['priority']) => 
                      setProjectForm(prev => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-start">Start Date</Label>
                  <Input
                    id="project-start"
                    type="date"
                    value={projectForm.start_date}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-due">Due Date</Label>
                  <Input
                    id="project-due"
                    type="date"
                    value={projectForm.due_date}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-assignee">Assign To</Label>
                <Select
                  value={projectForm.assigned_to}
                  onValueChange={(value) => setProjectForm(prev => ({ ...prev, assigned_to: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.first_name} {member.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-budget">Budget</Label>
                <Input
                  id="project-budget"
                  type="number"
                  placeholder="0.00"
                  value={projectForm.budget_allocated}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, budget_allocated: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateProjectOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createProject} disabled={!projectForm.name.trim()}>
                Create Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Projects ({projects.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer hover:bg-accent",
                    selectedProject?.id === project.id && "bg-accent border-primary"
                  )}
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm truncate">{project.name}</h4>
                    <Badge className={cn("text-xs", getPriorityColor(project.priority))}>
                      {project.priority}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(project.status)}
                    <span className="text-xs text-muted-foreground capitalize">
                      {project.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>Progress</span>
                      <span>{project.progress_percentage}%</span>
                    </div>
                    <Progress value={project.progress_percentage} className="h-1" />
                  </div>

                  {project.due_date && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Due {format(new Date(project.due_date), 'MMM dd')}
                    </div>
                  )}
                </div>
              ))}

              {projects.length === 0 && (
                <div className="text-center py-8">
                  <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No projects yet</p>
                  <p className="text-xs text-muted-foreground">Create your first project to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Project Details */}
        <div className="lg:col-span-2">
          {selectedProject ? (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{selectedProject.name}</CardTitle>
                        <CardDescription>{selectedProject.description}</CardDescription>
                      </div>
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
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Project
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Status</p>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(selectedProject.status)}
                          <span className="text-sm capitalize">
                            {selectedProject.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Priority</p>
                        <Badge className={cn("text-xs", getPriorityColor(selectedProject.priority))}>
                          {selectedProject.priority}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Progress</p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{getProjectProgress(selectedProject)}%</span>
                          </div>
                          <Progress value={getProjectProgress(selectedProject)} className="h-2" />
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Budget</p>
                        <div className="text-sm">
                          {selectedProject.budget_allocated ? (
                            <div>
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ${selectedProject.budget_allocated.toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Spent: ${selectedProject.budget_spent.toFixed(2)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tasks" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Tasks ({tasks.length})</h3>
                  <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Task
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Task</DialogTitle>
                        <DialogDescription>
                          Add a new task to {selectedProject.name}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="task-title">Task Title *</Label>
                          <Input
                            id="task-title"
                            placeholder="Enter task title"
                            value={taskForm.title}
                            onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="task-description">Description</Label>
                          <Textarea
                            id="task-description"
                            placeholder="Task description..."
                            value={taskForm.description}
                            onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                            rows={3}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="task-status">Status</Label>
                            <Select
                              value={taskForm.status}
                              onValueChange={(value: ProjectTask['status']) => 
                                setTaskForm(prev => ({ ...prev, status: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="review">Review</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="task-priority">Priority</Label>
                            <Select
                              value={taskForm.priority}
                              onValueChange={(value: ProjectTask['priority']) => 
                                setTaskForm(prev => ({ ...prev, priority: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="task-assignee">Assign To</Label>
                          <Select
                            value={taskForm.assigned_to}
                            onValueChange={(value) => setTaskForm(prev => ({ ...prev, assigned_to: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select team member" />
                            </SelectTrigger>
                            <SelectContent>
                              {teamMembers.map((member) => (
                                <SelectItem key={member.user_id} value={member.user_id}>
                                  {member.first_name} {member.last_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="task-due">Due Date</Label>
                            <Input
                              id="task-due"
                              type="date"
                              value={taskForm.due_date}
                              onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="task-hours">Estimated Hours</Label>
                            <Input
                              id="task-hours"
                              type="number"
                              placeholder="0"
                              value={taskForm.estimated_hours}
                              onChange={(e) => setTaskForm(prev => ({ ...prev, estimated_hours: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateTaskOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={createTask} disabled={!taskForm.title.trim()}>
                          Create Task
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-3">
                  {tasks.map((task) => (
                    <Card key={task.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getStatusIcon(task.status)}
                              <h4 className="font-medium">{task.title}</h4>
                              <Badge className={cn("text-xs", getPriorityColor(task.priority))}>
                                {task.priority}
                              </Badge>
                            </div>
                            
                            {task.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {task.description}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {task.assigned_to && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {teamMembers.find(m => m.user_id === task.assigned_to)?.first_name || 'Unknown'}
                                </div>
                              )}
                              {task.due_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Due {format(new Date(task.due_date), 'MMM dd')}
                                </div>
                              )}
                              {task.estimated_hours && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {task.estimated_hours}h estimated
                                </div>
                              )}
                            </div>
                          </div>
                          
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
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Task
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Task
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {tasks.length === 0 && (
                    <div className="text-center py-8">
                      <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No tasks yet</p>
                      <p className="text-xs text-muted-foreground">Add tasks to track project progress</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="team">
                <Card>
                  <CardHeader>
                    <CardTitle>Project Team</CardTitle>
                    <CardDescription>
                      Manage team members and their roles in this project
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Project team management coming soon...
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="files">
                <Card>
                  <CardHeader>
                    <CardTitle>Project Files</CardTitle>
                    <CardDescription>
                      Share and collaborate on project documents
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      File collaboration features coming soon...
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">Select a project</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose a project from the sidebar to view details and manage tasks
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
