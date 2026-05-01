import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const Projects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  
  // New project state
  const [newProject, setNewProject] = useState({ name: '', description: '' });

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get('/projects');
        setProjects(res.data);
      } catch (error) {
        console.error('Failed to fetch projects', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!newProject.name.trim()) {
      setMessage('Project name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: newProject.name.trim(),
        description: newProject.description.trim(),
      };
      const res = await api.post('/projects', payload);
      setProjects((prev) => [res.data, ...prev]);
      setNewProject({ name: '', description: '' });
      setMessage('Project created successfully.');
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Projects (Teams)</h2>
        <Link to="/" className="btn">Back to Dashboard</Link>
      </div>

      {user.role === 'admin' && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Create New Project</h3>
          {message && (
            <p style={{ marginBottom: '1rem', color: message.includes('successfully') ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {message}
            </p>
          )}
          <form onSubmit={handleCreateProject} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input 
              className="input-field" 
              style={{ marginBottom: 0, flex: 1 }} 
              type="text" 
              value={newProject.name} 
              onChange={e => setNewProject({...newProject, name: e.target.value})} 
              required 
            />
            <input 
              className="input-field" 
              style={{ marginBottom: 0, flex: 2 }} 
              type="text" 
              value={newProject.description} 
              onChange={e => setNewProject({...newProject, description: e.target.value})} 
            />
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p>Loading projects...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {projects.map((project) => (
            <div key={project.id} className="card">
              <h3 style={{ marginBottom: '0.5rem' }}>{project.name}</h3>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', minHeight: '3rem' }}>
                {project.description || 'No description provided.'}
              </p>
              <Link to={`/projects/${project.id}`} className="btn btn-primary" style={{ width: '100%' }}>
                View Board
              </Link>
            </div>
          ))}
          {projects.length === 0 && <p>No projects found.</p>}
        </div>
      )}
    </div>
  );
};

export default Projects;
