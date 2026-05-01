import { startTransition, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const JOB_ROLE_OPTIONS = [
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'QA Engineer',
  'UI/UX Designer',
  'DevOps Engineer',
  'Product Manager',
  'Business Analyst',
  'Support Engineer',
];

const EMPTY_STATS = {
  total_tasks: 0,
  completed_tasks: 0,
  in_progress_tasks: 0,
  overdue_tasks: 0,
};

const EMPTY_MEMBER_FORM = {
  name: '',
  email: '',
  jobRole: JOB_ROLE_OPTIONS[0],
};

const EMPTY_PROJECT_FORM = {
  name: '',
  description: '',
  memberIds: [],
};

const EMPTY_TASK_FORM = {
  title: '',
  description: '',
  projectId: '',
  assignedTo: '',
  dueDate: '',
};

const TASKS_PER_PAGE = 8;
const REFRESH_INTERVAL_MS = 2000;

function formatDate(value, options = {}) {
  if (!value) {
    return 'Not set';
  }

  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

function formatStatus(status) {
  return {
    todo: 'To Do',
    in_progress: 'In Progress',
    completed: 'Completed',
  }[status] || status;
}

function isOverdue(task) {
  return Boolean(task?.due_date) && task.status !== 'completed' && new Date(task.due_date) < new Date();
}

function getStatusTone(status, overdue = false) {
  if (overdue) {
    return 'danger';
  }

  if (status === 'completed') {
    return 'success';
  }

  if (status === 'in_progress') {
    return 'primary';
  }

  return 'neutral';
}

function updateStatsForTaskChange(previousStats, task, nextStatus) {
  const nextStats = { ...previousStats };
  const previousStatus = task.status;

  if (previousStatus === nextStatus) {
    return nextStats;
  }

  if (previousStatus === 'in_progress') {
    nextStats.in_progress_tasks = Math.max(0, nextStats.in_progress_tasks - 1);
  }

  if (previousStatus === 'completed') {
    nextStats.completed_tasks = Math.max(0, nextStats.completed_tasks - 1);
  }

  if (nextStatus === 'in_progress') {
    nextStats.in_progress_tasks += 1;
  }

  if (nextStatus === 'completed') {
    nextStats.completed_tasks += 1;
  }

  if (isOverdue(task) && nextStatus === 'completed') {
    nextStats.overdue_tasks = Math.max(0, nextStats.overdue_tasks - 1);
  }

  return nextStats;
}

function StatusBadge({ status, overdue = false }) {
  return (
    <span className={`status-badge status-badge--${getStatusTone(status, overdue)}`}>
      {overdue ? 'Overdue' : formatStatus(status)}
    </span>
  );
}

function SummaryCard({ label, value, accent, note }) {
  return (
    <article className={`summary-card summary-card--${accent}`}>
      <span className="summary-card__label">{label}</span>
      <strong className="summary-card__value">{value}</strong>
      <span className="summary-card__note">{note}</span>
    </article>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  );
}

async function buildAdminWorkspaceFallback() {
  const [statsResponse, membersResponse, projectsResponse] = await Promise.all([
    api.get('/dashboard/stats'),
    api.get('/members').catch(() => api.get('/admin/users')),
    api.get('/projects'),
  ]);

  const baseProjects = projectsResponse.data || [];

  const projectDetails = await Promise.all(
    baseProjects.map(async (project) => {
      const [membersResult, tasksResult] = await Promise.all([
        api.get(`/projects/${project.id}/members`).catch(() => ({ data: [] })),
        api.get(`/projects/${project.id}/tasks`).catch(() => ({ data: [] })),
      ]);

      return {
        ...project,
        members: membersResult.data || [],
        member_count: (membersResult.data || []).length,
        tasks: tasksResult.data || [],
      };
    })
  );

  return {
    stats: statsResponse.data || EMPTY_STATS,
    members: membersResponse.data || [],
    projects: projectDetails,
    tasks: projectDetails.flatMap((project) => project.tasks || []),
  };
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [feedback, setFeedback] = useState(null);

  const [dashboardStats, setDashboardStats] = useState(EMPTY_STATS);
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [adminTasks, setAdminTasks] = useState([]);
  const [memberStats, setMemberStats] = useState(EMPTY_STATS);
  const [memberTasks, setMemberTasks] = useState([]);

  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER_FORM);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT_FORM);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [projectMemberSelections, setProjectMemberSelections] = useState({});
  const [taskPage, setTaskPage] = useState(1);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    }

    try {
      if (user.role === 'admin') {
        const response = await api.get('/admin/overview').catch(async (error) => {
          if (error.response?.status === 404) {
            const fallbackData = await buildAdminWorkspaceFallback();
            return { data: fallbackData };
          }

          throw error;
        });

        startTransition(() => {
          setDashboardStats(response.data.stats || EMPTY_STATS);
          setMembers(response.data.members || []);
          setProjects(response.data.projects || []);
        });
      } else {
        const response = await api.get('/dashboard/stats');
        startTransition(() => {
          setMemberStats(response.data || EMPTY_STATS);
        });
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Unable to load dashboard data.',
      });
    } finally {
      if (silent) {
        setRefreshing(false);
      }
    }
  }, [user.role]);

  const fetchMembers = useCallback(async () => {
    try {
      const response = await api.get('/members').catch((error) => {
        if (error.response?.status === 404) {
          return api.get('/admin/users');
        }

        throw error;
      });
      startTransition(() => {
        setMembers(response.data || []);
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Unable to load members.',
      });
    }
  }, []);

  const fetchTasks = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    }

    try {
      const response = await api.get('/tasks/my');
      startTransition(() => {
        if (user.role === 'admin') {
          setAdminTasks(response.data || []);
        } else {
          setMemberTasks(response.data || []);
        }
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Unable to load tasks.',
      });
    } finally {
      if (silent) {
        setRefreshing(false);
      }
    }
  }, [user.role]);

  const fetchProjects = useCallback(async () => {
    if (user.role !== 'member') {
      return;
    }

    try {
      const response = await api.get('/projects');
      startTransition(() => {
        setMemberProjects(response.data || []);
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Unable to load assigned projects.',
      });
    }
  }, [user.role]);


  const fetchProjectMembers = useCallback(async (projectId) => {
    if (!projectId) {
      setProjectMembers([]);
      return;
    }

    try {
      const response = await api.get(`/projects/${projectId}/members`);
      startTransition(() => {
        setProjectMembers(response.data || []);
      });
    } catch (error) {
      setProjectMembers([]);
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Unable to load project members.',
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (user.role === 'admin') {
        await Promise.all([fetchDashboard(false), fetchTasks(false), fetchMembers()]);
      } else {
        await Promise.all([fetchDashboard(false), fetchTasks(false), fetchProjects()]);
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    bootstrap();

    const intervalId = window.setInterval(() => {
      if (user.role === 'admin') {
        Promise.all([fetchDashboard(true), fetchTasks(true)]);
      } else {
        Promise.all([fetchDashboard(true), fetchTasks(true), fetchProjects()]);
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [fetchDashboard, fetchMembers, fetchTasks, user.role]);

  const selectedProject = projects.find((project) => project.id === taskForm.projectId);
  const selectedProjectMembers = projectMembers;
  const hasSelectedProjectMember = selectedProjectMembers.some((member) => member.id === taskForm.assignedTo);

  const taskPageCount = Math.max(1, Math.ceil(adminTasks.length / TASKS_PER_PAGE));
  const currentTaskPage = Math.min(taskPage, taskPageCount);
  const paginatedTasks = adminTasks.slice(
    (currentTaskPage - 1) * TASKS_PER_PAGE,
    currentTaskPage * TASKS_PER_PAGE
  );

  const todaysTasks = memberTasks.filter(
    (task) => new Date(task.created_at).toDateString() === new Date().toDateString()
  );
  const backlogTasks = memberTasks.filter(
    (task) => new Date(task.created_at).toDateString() !== new Date().toDateString()
  );

  async function handleCreateMember(event) {
    event.preventDefault();
    setBusyAction('create-member');
    setFeedback(null);

    try {
      const response = await api.post('/admin/create-user', {
        ...memberForm,
        password: 'password123',
      });
      const createdMember = {
        ...response.data.user,
        project_count: 0,
        assigned_task_count: 0,
        completed_task_count: 0,
      };

      setMembers((prev) => [...prev, createdMember]);
      setMemberForm(EMPTY_MEMBER_FORM);
      setFeedback({
        type: 'success',
        text: `${response.data.user.name} added successfully. Default password: ${response.data.defaultPassword}`,
      });
      await fetchMembers();
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Unable to create the member. Use a valid email like hari@company.com.',
      });
    } finally {
      setBusyAction('');
    }
  }

  async function handleCreateProject(event) {
    event.preventDefault();
    setBusyAction('create-project');
    setFeedback(null);

    try {
      const response = await api.post('/projects', {
        name: projectForm.name,
        description: projectForm.description,
        member_ids: projectForm.memberIds,
      });

      setProjects((prev) => [response.data, ...prev]);
      setProjectForm(EMPTY_PROJECT_FORM);
      setFeedback({
        type: 'success',
        text: 'Project created and ready for task assignment.',
      });
      await fetchDashboard(true);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Unable to create the project.',
      });
    } finally {
      setBusyAction('');
    }
  }

  async function handleAddMemberToProject(projectId) {
    const userId = projectMemberSelections[projectId];
    if (!userId) {
      setFeedback({
        type: 'error',
        text: 'Choose a member before adding them to the project.',
      });
      return;
    }

    setBusyAction(`add-member-${projectId}`);
    setFeedback(null);

    try {
      const response = await api.post(`/projects/${projectId}/members`, { user_id: userId });
      const addedMember = response.data.member;

      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId
            ? {
                ...project,
                members: [...(project.members || []), addedMember],
                member_count: (project.member_count || 0) + 1,
              }
            : project
        )
      );
      setProjectMembers((prev) => (prev.some((member) => member.id === addedMember.id) ? prev : [...prev, addedMember]));
      setProjectMemberSelections((current) => ({ ...current, [projectId]: '' }));
      setFeedback({
        type: 'success',
        text: 'Member added to the project team.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Unable to update the project team.',
      });
    } finally {
      setBusyAction('');
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault();
    setBusyAction('create-task');
    setFeedback(null);

    try {
      const response = await api.post(`/projects/${taskForm.projectId}/tasks`, {
        title: taskForm.title,
        description: taskForm.description,
        assigned_to: hasSelectedProjectMember ? taskForm.assignedTo : '',
        due_date: taskForm.dueDate || null,
      });

      setAdminTasks((prev) => [response.data, ...prev]);
      setTaskForm(EMPTY_TASK_FORM);
      setProjectMembers([]);
      setTaskPage(1);
      setFeedback({
        type: 'success',
        text: 'Task assigned successfully and shared with the member.',
      });
      await fetchDashboard(true);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Unable to assign the task.',
      });
    } finally {
      setBusyAction('');
    }
  }

  async function handleDeleteMember(member) {
    const confirmed = window.confirm(`Delete member "${member.name}" and all tasks assigned to them?`);
    if (!confirmed) {
      return;
    }

    setBusyAction(`delete-member-${member.id}`);
    setFeedback(null);

    try {
      await api.delete(`/admin/users/${member.id}`);
      setMembers((prev) => prev.filter((currentMember) => currentMember.id !== member.id));
      setProjects((prev) =>
        prev.map((project) => ({
          ...project,
          members: (project.members || []).filter((projectMember) => projectMember.id !== member.id),
          member_count: Math.max(0, (project.member_count || 0) - ((project.members || []).some((projectMember) => projectMember.id === member.id) ? 1 : 0)),
        }))
      );
      setProjectMembers((prev) => prev.filter((projectMember) => projectMember.id !== member.id));
      setAdminTasks((prev) => prev.filter((task) => task.assignee_id !== member.id));
      setTaskForm((current) => (current.assignedTo === member.id ? { ...current, assignedTo: '' } : current));
      setFeedback({
        type: 'success',
        text: `${member.name} deleted successfully.`,
      });
      await fetchDashboard(true);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Unable to delete the member.',
      });
    } finally {
      setBusyAction('');
    }
  }

  async function handleDeleteProject(project) {
    const confirmed = window.confirm(`Delete project "${project.name}" and all its tasks?`);
    if (!confirmed) {
      return;
    }

    setBusyAction(`delete-project-${project.id}`);
    setFeedback(null);

    try {
      await api.delete(`/projects/${project.id}`);
      setProjects((prev) => prev.filter((currentProject) => currentProject.id !== project.id));
      setAdminTasks((prev) => prev.filter((task) => task.project_id !== project.id));
      setProjectMembers((prev) => (taskForm.projectId === project.id ? [] : prev));
      setTaskForm((current) =>
        current.projectId === project.id
          ? { ...EMPTY_TASK_FORM }
          : current
      );
      setFeedback({
        type: 'success',
        text: `${project.name} deleted successfully.`,
      });
      await fetchDashboard(true);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Unable to delete the project.',
      });
    } finally {
      setBusyAction('');
    }
  }

  async function handleResetWorkspace() {
    const confirmed = window.confirm('Clear all members, projects, project links, and tasks? The admin account will be kept.');
    if (!confirmed) {
      return;
    }

    setBusyAction('reset-workspace');
    setFeedback(null);

    try {
      await api.delete('/admin/reset-workspace');
      setMembers([]);
      setProjects([]);
      setProjectMembers([]);
      setAdminTasks([]);
      setDashboardStats(EMPTY_STATS);
      setMemberStats(EMPTY_STATS);
      setMemberTasks([]);
      setProjectForm(EMPTY_PROJECT_FORM);
      setTaskForm(EMPTY_TASK_FORM);
      setProjectMemberSelections({});
      setTaskPage(1);
      setFeedback({
        type: 'success',
        text: 'Workspace cleared. You now have a fresh start.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Unable to clear the workspace.',
      });
    } finally {
      setBusyAction('');
    }
  }

  function handleProjectSelection(projectId) {
    setProjectMembers([]);
    setTaskForm((current) => ({
      ...current,
      projectId,
      assignedTo: '',
    }));

    if (projectId) {
      fetchProjectMembers(projectId);
    }
  }

  async function handleMemberTaskUpdate(task, nextStatus) {
    const previousTasks = memberTasks;
    const previousStats = memberStats;

    setMemberTasks((current) =>
      current.map((currentTask) =>
        currentTask.id === task.id ? { ...currentTask, status: nextStatus } : currentTask
      )
    );
    setMemberStats((current) => updateStatsForTaskChange(current, task, nextStatus));

    try {
      await api.put(`/tasks/${task.id}/status`, { status: nextStatus });
      await Promise.all([fetchTasks(), fetchDashboard()]);
    } catch (error) {
      setMemberTasks(previousTasks);
      setMemberStats(previousStats);
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Unable to update task status.',
      });
      return;
    }

    setFeedback({
      type: 'success',
      text: nextStatus === 'completed' ? 'Task marked as completed.' : 'Task moved to in progress.',
    });
  }

  function renderMemberTaskCard(task) {
    const overdue = isOverdue(task);

    return (
      <article key={task.id} className="task-card">
        <div className="task-card__header">
          <div>
            <h4>{task.title}</h4>
            <p>{task.description || 'No description provided for this task.'}</p>
          </div>
          <StatusBadge status={task.status} overdue={overdue} />
        </div>

        <div className="task-meta">
          <span>Project: {task.project_name}</span>
          <span>Assigned: {new Date(task.created_at).toLocaleDateString()}</span>
          <span>Due: {task.due_date ? formatDate(task.due_date) : 'Flexible'}</span>
        </div>

        <div className="task-actions">
          {task.status === 'todo' && (
            <button className="btn btn-primary" onClick={() => handleMemberTaskUpdate(task, 'in_progress')}>
              Start Task
            </button>
          )}
          {task.status === 'in_progress' && (
            <button className="btn btn-success" onClick={() => handleMemberTaskUpdate(task, 'completed')}>
              Mark Complete
            </button>
          )}
          {task.status === 'completed' && <span className="task-complete-pill">Completed</span>}
        </div>
      </article>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loader-ring" />
        <p>Loading workspace...</p>
      </div>
    );
  }

  return (
    <div className="workspace-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Company Workflow</p>
          <h1>Task Manager</h1>
        </div>

        <div className="topbar__actions">
          <div className="presence-chip">
            <span className={`presence-dot ${refreshing ? 'presence-dot--active' : ''}`} />
            Auto-refresh every 2 seconds
          </div>
          <div className="welcome-chip">
            <strong>Welcome {user.name || user.email}</strong>
            <span>{user.role === 'admin' ? 'Admin workspace' : user.jobRole || 'Team member'}</span>
          </div>
          {user.role === 'admin' && (
            <button
              className="btn btn-danger"
              onClick={handleResetWorkspace}
              disabled={busyAction === 'reset-workspace'}
            >
              {busyAction === 'reset-workspace' ? 'Clearing...' : 'Clear All Data'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="workspace-main">
        {feedback && (
          <div className={`alert-banner alert-banner--${feedback.type === 'success' ? 'success' : 'error'}`}>
            {feedback.text}
          </div>
        )}

        {user.role === 'admin' ? (
          <>
            <section className="summary-grid">
              <SummaryCard label="Total Tasks" value={dashboardStats.total_tasks} accent="primary" note="All tracked work items" />
              <SummaryCard label="Completed Tasks" value={dashboardStats.completed_tasks} accent="success" note="Finished by the team" />
              <SummaryCard label="In Progress Tasks" value={dashboardStats.in_progress_tasks} accent="info" note="Currently being worked on" />
              <SummaryCard label="Overdue Tasks" value={dashboardStats.overdue_tasks} accent="danger" note="Need follow-up today" />
            </section>

            <section className="dashboard-layout">
              <div className="dashboard-layout__main">
                <article className="panel-card">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">User Management</p>
                      <h2>Create team members</h2>
                    </div>
                  </div>

                  <form className="form-grid" onSubmit={handleCreateMember}>
                    <label>
                      <span>Name</span>
                      <input
                        className="input-field"
                        type="text"
                        value={memberForm.name}
                        onChange={(event) => setMemberForm((current) => ({ ...current, name: event.target.value }))}
                        required
                      />
                    </label>

                    <label>
                      <span>Email</span>
                      <input
                        className="input-field"
                        type="email"
                        value={memberForm.email}
                        onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))}
                        required
                      />
                    </label>

                    <label>
                      <span>Role</span>
                      <select
                        className="input-field"
                        value={memberForm.jobRole}
                        onChange={(event) => setMemberForm((current) => ({ ...current, jobRole: event.target.value }))}
                      >
                        {JOB_ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="form-actions form-actions--full">
                      <button className="btn btn-primary" type="submit" disabled={busyAction === 'create-member'}>
                        {busyAction === 'create-member' ? 'Creating...' : 'Create Member'}
                      </button>
                    </div>
                  </form>

                  {members.length > 0 ? (
                    <div className="member-list">
                      {members.map((member) => (
                        <article key={member.id} className="member-card">
                          <div>
                            <h3>{member.name}</h3>
                            <p>{member.email}</p>
                          </div>
                          <div className="member-card__meta">
                            <span className="tag-chip">{member.job_role}</span>
                            <span>{member.project_count || 0} projects</span>
                            <span>{member.assigned_task_count || 0} assigned</span>
                          </div>
                          <button
                            className="btn btn-danger"
                            type="button"
                            disabled={busyAction === `delete-member-${member.id}`}
                            onClick={() => handleDeleteMember(member)}
                          >
                            {busyAction === `delete-member-${member.id}` ? 'Deleting...' : 'Delete Member'}
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No team members yet" description="Create the first member account to start assigning work." />
                  )}
                </article>

                <article className="panel-card">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Project Management</p>
                      <h2>Create projects and teams</h2>
                    </div>
                    <span className="inline-note">Projects are dated automatically on creation</span>
                  </div>

                  <form className="form-grid" onSubmit={handleCreateProject}>
                    <label>
                      <span>Project name</span>
                      <input
                        className="input-field"
                        type="text"
                        value={projectForm.name}
                        onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))}
                        required
                      />
                    </label>

                    <label className="form-field--full">
                      <span>Description</span>
                      <textarea
                        className="input-field input-field--textarea"
                        value={projectForm.description}
                        onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))}
                      />
                    </label>

                    <div className="form-field--full">
                      <span className="field-label">Add initial team members</span>
                      <div className="checkbox-grid">
                        {members.map((member) => (
                          <label key={member.id} className="checkbox-card">
                            <input
                              type="checkbox"
                              checked={projectForm.memberIds.includes(member.id)}
                              onChange={(event) => {
                                setProjectForm((current) => ({
                                  ...current,
                                  memberIds: event.target.checked
                                    ? [...current.memberIds, member.id]
                                    : current.memberIds.filter((memberId) => memberId !== member.id),
                                }));
                              }}
                            />
                            <span>
                              <strong>{member.name}</strong>
                              <small>{member.job_role}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="form-actions form-actions--full">
                      <button className="btn btn-primary" type="submit" disabled={busyAction === 'create-project'}>
                        {busyAction === 'create-project' ? 'Creating...' : 'Create Project'}
                      </button>
                    </div>
                  </form>

                  {projects.length > 0 ? (
                    <div className="project-list">
                      {projects.map((project) => {
                        const existingIds = new Set((project.members || []).map((member) => member.id));
                        const availableMembers = members.filter((member) => !existingIds.has(member.id));

                        return (
                          <article key={project.id} className="project-card">
                            <div className="project-card__header">
                              <div>
                                <h3>{project.name}</h3>
                                <p>{project.description || 'No project description added yet.'}</p>
                              </div>
                              <div className="project-card__summary">
                                <span>{project.member_count || 0} team members</span>
                                <span>{formatDate(project.created_at)}</span>
                              </div>
                            </div>

                            <div className="tag-list">
                              {(project.members || []).length > 0 ? (
                                project.members.map((member) => (
                                  <span key={`${project.id}-${member.id}`} className="tag-chip">
                                    {member.name}
                                  </span>
                                ))
                              ) : (
                                <span className="inline-note">No members assigned yet</span>
                              )}
                            </div>

                            <div className="inline-form">
                              <select
                                className="input-field"
                                value={projectMemberSelections[project.id] || ''}
                                onChange={(event) =>
                                  setProjectMemberSelections((current) => ({
                                    ...current,
                                    [project.id]: event.target.value,
                                  }))
                                }
                                disabled={availableMembers.length === 0}
                              >
                                <option value="">Add member to project</option>
                                {availableMembers.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.name} - {member.job_role}
                                  </option>
                                ))}
                              </select>
                              <button
                                className="btn btn-secondary"
                                type="button"
                                disabled={busyAction === `add-member-${project.id}` || availableMembers.length === 0}
                                onClick={() => handleAddMemberToProject(project.id)}
                              >
                                {busyAction === `add-member-${project.id}` ? 'Adding...' : 'Add'}
                              </button>
                              <button
                                className="btn btn-danger"
                                type="button"
                                disabled={busyAction === `delete-project-${project.id}`}
                                onClick={() => handleDeleteProject(project)}
                              >
                                {busyAction === `delete-project-${project.id}` ? 'Deleting...' : 'Delete Project'}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState title="No projects yet" description="Create a project so tasks can be assigned to a working team." />
                  )}
                </article>
              </div>

              <aside className="dashboard-layout__side">
                <article className="panel-card">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Task Assignment</p>
                      <h2>Assign daily work</h2>
                    </div>
                  </div>

                  <form className="form-grid" onSubmit={handleCreateTask}>
                    <label>
                      <span>Task title</span>
                      <input
                        className="input-field"
                        type="text"
                        value={taskForm.title}
                        onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                        required
                      />
                    </label>

                    <label className="form-field--full">
                      <span>Description</span>
                      <textarea
                        className="input-field input-field--textarea"
                        value={taskForm.description}
                        onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
                      />
                    </label>

                    <label>
                      <span>Select project</span>
                      <select
                        className="input-field"
                        value={taskForm.projectId}
                        onChange={(event) => handleProjectSelection(event.target.value)}
                        required
                      >
                        <option value="">Choose project</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Assign member</span>
                      <select
                        className="input-field"
                        value={hasSelectedProjectMember ? taskForm.assignedTo : ''}
                        onChange={(event) => setTaskForm((current) => ({ ...current, assignedTo: event.target.value }))}
                        required
                        disabled={!selectedProject || selectedProjectMembers.length === 0}
                      >
                        <option value="">
                          {!selectedProject ? 'Select a project first' : 'Choose member'}
                        </option>
                        {selectedProjectMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name} - {member.job_role}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Due date</span>
                      <input
                        className="input-field"
                        type="date"
                        value={taskForm.dueDate}
                        onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
                      />
                    </label>

                    <div className="form-actions form-actions--full">
                      <button className="btn btn-primary" type="submit" disabled={busyAction === 'create-task'}>
                        {busyAction === 'create-task' ? 'Assigning...' : 'Create Task'}
                      </button>
                    </div>
                  </form>
                </article>

                <article className="panel-card">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Live Monitoring</p>
                      <h2>Track team progress</h2>
                    </div>
                    <span className="inline-note">Statuses refresh automatically</span>
                  </div>

                  {adminTasks.length > 0 ? (
                    <>
                      <div className="table-scroll">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Task</th>
                              <th>Member</th>
                              <th>Assigned</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedTasks.map((task) => (
                              <tr key={task.id}>
                                <td>
                                  <strong>{task.title}</strong>
                                  <span>{task.project_name}</span>
                                </td>
                                <td>{task.assignee_name || 'Unassigned'}</td>
                                <td>{new Date(task.created_at).toLocaleDateString()}</td>
                                <td>
                                  <StatusBadge status={task.status} overdue={isOverdue(task)} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="pagination-bar">
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => setTaskPage((current) => Math.max(1, current - 1))}
                          disabled={currentTaskPage === 1}
                        >
                          Previous
                        </button>
                        <span>
                          Page {currentTaskPage} of {taskPageCount}
                        </span>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => setTaskPage((current) => Math.min(taskPageCount, current + 1))}
                          disabled={currentTaskPage === taskPageCount}
                        >
                          Next
                        </button>
                      </div>
                    </>
                  ) : (
                    <EmptyState title="No tasks assigned yet" description="Tasks created here will appear instantly for members and refresh on this dashboard." />
                  )}
                </article>
              </aside>
            </section>
          </>
        ) : (
          <>
            <section className="summary-grid">
              <SummaryCard label="My Tasks" value={memberStats.total_tasks} accent="primary" note="All tasks assigned to you" />
              <SummaryCard label="Completed" value={memberStats.completed_tasks} accent="success" note="Delivered work items" />
              <SummaryCard label="In Progress" value={memberStats.in_progress_tasks} accent="info" note="Active assignments" />
              <SummaryCard label="Overdue" value={memberStats.overdue_tasks} accent="danger" note="Needs immediate attention" />
            </section>

            <section className="member-layout">
              <article className="panel-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">My Tasks</p>
                    <h2>Assigned today</h2>
                  </div>
                </div>

                <div className="task-stack">
                  {todaysTasks.length > 0 ? (
                    todaysTasks.map(renderMemberTaskCard)
                  ) : (
                    <EmptyState title="No new tasks today" description="New assignments from your admin will show up here automatically." />
                  )}
                </div>
              </article>

              <article className="panel-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Backlog</p>
                    <h2>Earlier assignments</h2>
                  </div>
                </div>

                <div className="task-stack">
                  {backlogTasks.length > 0 ? (
                    backlogTasks.map(renderMemberTaskCard)
                  ) : (
                    <EmptyState title="No backlog tasks" description="You're fully caught up on older assignments." />
                  )}
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
