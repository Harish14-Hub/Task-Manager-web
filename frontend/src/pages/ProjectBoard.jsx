import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const ProjectBoard = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);

  // Filter state
  const [sortBy, setSortBy] = useState('created_at'); // 'created_at' or 'due_date'

  // Admin New Task state
  const [newTask, setNewTask] = useState({ title: '', description: '', assigned_to: '', due_date: '' });

  // Add Member State
  const [systemMembers, setSystemMembers] = useState([]);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState('');
  const [addMemberMessage, setAddMemberMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksRes, membersRes, allMembersRes] = await Promise.all([
          api.get(`/projects/${id}/tasks`),
          api.get(`/projects/${id}/members`),
          user.role === 'admin' ? api.get('/admin/users') : Promise.resolve({ data: [] })
        ]);
        setTasks(tasksRes.data);
        setMembers(membersRes.data);
        if (user.role === 'admin') setSystemMembers(allMembersRes.data);
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, user.role]);

  const handleAddMemberToProject = async (e) => {
    e.preventDefault();
    setAddMemberMessage('');
    try {
      await api.post(`/projects/${id}/members`, { user_id: selectedMemberToAdd });
      setAddMemberMessage('Member added to project successfully!');
      
      // Optimistically update members list
      const addedUser = systemMembers.find(m => m.id === selectedMemberToAdd);
      if (addedUser) {
        setMembers(prev => [...prev, addedUser]);
      }
      setSelectedMemberToAdd('');
    } catch (error) {
      setAddMemberMessage(error.response?.data?.message || 'Failed to add member');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/projects/${id}/tasks`, newTask);
      // We might need to refetch tasks to get the assignee_name if JOIN was used, but for now just reload
      const updatedTasks = await api.get(`/projects/${id}/tasks`);
      setTasks(updatedTasks.data);
      setNewTask({ title: '', description: '', assigned_to: '', due_date: '' });
    } catch (error) {
      console.error('Failed to create task', error);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      await api.put(`/tasks/${taskId}/status`, { status: newStatus });
    } catch (error) {
      console.error('Failed to update task status', error);
    }
  };

  // Algorithmic Strategy: Efficient Filtering (O(n)) and Sorting (O(n log n))
  const { todoTasks, inProgressTasks, completedTasks } = useMemo(() => {
    const sortedTasks = [...tasks].sort((a, b) => {
      if (sortBy === 'due_date') {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return {
      todoTasks: sortedTasks.filter(t => t.status === 'todo'),
      inProgressTasks: sortedTasks.filter(t => t.status === 'in_progress'),
      completedTasks: sortedTasks.filter(t => t.status === 'completed'),
    };
  }, [tasks, sortBy]);

  const renderColumn = (title, columnTasks) => (
    <div style={{ flex: 1, minWidth: '300px', backgroundColor: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
      <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid var(--color-primary)', paddingBottom: '0.5rem' }}>
        {title} <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginLeft: '0.5rem' }}>({columnTasks.length})</span>
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {columnTasks.map(task => (
          <div key={task.id} className="card" style={{ padding: '1rem', borderLeft: task.status === 'completed' ? '4px solid var(--color-success)' : '4px solid var(--color-primary)' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>{task.title}</h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>{task.description}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              {task.assignee_name && <span><strong>Assignee:</strong> {task.assignee_name}</span>}
              <span><strong>Assigned:</strong> {new Date(task.created_at).toLocaleDateString()}</span>
              {task.due_date && <span><strong>Due:</strong> {new Date(task.due_date).toLocaleDateString()}</span>}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
              {task.status === 'todo' && (
                <button className="btn btn-primary" style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem' }} onClick={() => updateTaskStatus(task.id, 'in_progress')}>
                  Start Task
                </button>
              )}
              {task.status === 'in_progress' && (
                <button className="btn" style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem', backgroundColor: 'var(--color-success)', color: 'white' }} onClick={() => updateTaskStatus(task.id, 'completed')}>
                  ✓ Complete Task
                </button>
              )}
              {task.status === 'completed' && (
                <div style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem', backgroundColor: '#e2fae8', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', textAlign: 'center', fontWeight: 'bold' }}>
                  ✓ Completed
                </div>
              )}
            </div>
          </div>
        ))}
        {columnTasks.length === 0 && <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No tasks here.</p>}
      </div>
    </div>
  );

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Kanban Board</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select className="input-field" style={{ marginBottom: 0 }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="created_at">Sort by Created Date</option>
            <option value="due_date">Sort by Due Date</option>
          </select>
          <Link to="/projects" className="btn">Back to Projects</Link>
        </div>
      </div>

      {user.role === 'admin' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
          
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Assign New Task</h3>
            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input className="input-field" style={{ marginBottom: 0 }} type="text" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} required />
              <input className="input-field" style={{ marginBottom: 0 }} type="text" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
              <select className="input-field" style={{ marginBottom: 0 }} value={newTask.assigned_to} onChange={e => setNewTask({...newTask, assigned_to: e.target.value})} required>
                <option value="">Select Assignee (Required)</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input className="input-field" style={{ marginBottom: 0 }} type="date" value={newTask.due_date} onChange={e => setNewTask({...newTask, due_date: e.target.value})} />
              <button className="btn btn-primary" type="submit">Add Task</button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Add Member to Project</h3>
            {addMemberMessage && <p style={{ marginBottom: '1rem', color: addMemberMessage.includes('success') ? 'var(--color-success)' : 'var(--color-danger)' }}>{addMemberMessage}</p>}
            <form onSubmit={handleAddMemberToProject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <select className="input-field" style={{ marginBottom: 0 }} value={selectedMemberToAdd} onChange={e => setSelectedMemberToAdd(e.target.value)} required>
                <option value="">Select System Member</option>
                {systemMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
              </select>
              <button className="btn btn-primary" type="submit">Add to Project</button>
            </form>
            
            <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Current Project Members:</h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {members.map(m => (
                <li key={m.id} style={{ padding: '0.25rem 0', borderBottom: '1px solid var(--color-border)' }}>{m.name}</li>
              ))}
              {members.length === 0 && <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No members yet.</p>}
            </ul>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading board...</p>
      ) : (
        <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          {renderColumn('To Do', todoTasks)}
          {renderColumn('In Progress', inProgressTasks)}
          {renderColumn('Completed', completedTasks)}
        </div>
      )}
    </div>
  );
};

export default ProjectBoard;
