import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import './Portfolio.css';

export default function PortfolioPage() {
  const { userId }       = useParams();
  const { user: me }     = useAuth();
  const isOwner          = String(me?.id) === String(userId);

  const [portfolio, setPortfolio] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(false);

  // Edit form state
  const [bio,         setBio]         = useState('');
  const [githubUrl,   setGithubUrl]   = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [skills,      setSkills]      = useState([]);
  const [skillInput,  setSkillInput]  = useState('');

  // Project form state
  const [showAddProject, setShowAddProject] = useState(false);
  const [projTitle,      setProjTitle]      = useState('');
  const [projDesc,       setProjDesc]       = useState('');
  const [projUrl,        setProjUrl]        = useState('');
  const [projTech,       setProjTech]       = useState('');
  const [saving,         setSaving]         = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/portfolio/${userId}`)
      .then(res => {
        const d = res.data.data;
        setPortfolio(d);
        setBio(d.bio || '');
        setGithubUrl(d.github_url || '');
        setLinkedinUrl(d.linkedin_url || '');
        setSkills(d.skills || []);
      })
      .catch(() => toast.error('Could not load portfolio'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [userId]);

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.put(`/portfolio/${userId}`, { bio, github_url: githubUrl, linkedin_url: linkedinUrl, skills });
      toast.success('Profile saved!');
      setEditing(false);
      load();
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Skills ────────────────────────────────────────────────────────────────
  const handleSkillKeyDown = (e) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      if (!skills.includes(skillInput.trim())) {
        setSkills([...skills, skillInput.trim()]);
      }
      setSkillInput('');
    }
  };
  const removeSkill = (s) => setSkills(skills.filter(x => x !== s));

  // ── Add project ───────────────────────────────────────────────────────────
  const handleAddProject = async () => {
    if (!projTitle.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      await api.post(`/portfolio/${userId}/projects`, {
        title:      projTitle.trim(),
        description: projDesc.trim(),
        url:        projUrl.trim(),
        tech_stack: projTech.split(',').map(t => t.trim()).filter(Boolean),
      });
      toast.success('Project added!');
      setProjTitle(''); setProjDesc(''); setProjUrl(''); setProjTech('');
      setShowAddProject(false);
      load();
    } catch {
      toast.error('Failed to add project');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete project ────────────────────────────────────────────────────────
  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      await api.delete(`/portfolio/${userId}/projects/${projectId}`);
      toast.success('Project removed');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  if (loading) return <div className="pf-loading">Loading portfolio…</div>;
  if (!portfolio) return <div className="pf-loading">Portfolio not found.</div>;

  return (
    <div className="pf-page">

      {/* ── Header ── */}
      <div className="pf-header">
        <div className="pf-avatar">{portfolio.full_name?.[0]?.toUpperCase()}</div>
        <div className="pf-header-info">
          <h1>{portfolio.full_name}</h1>
          <span className="pf-role">{portfolio.role}</span>
          <div className="pf-links">
            {portfolio.github_url   && <a href={portfolio.github_url}   target="_blank" rel="noreferrer">GitHub</a>}
            {portfolio.linkedin_url && <a href={portfolio.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}
          </div>
        </div>
        {isOwner && !editing && (
          <button className="btn btn-primary pf-edit-btn" onClick={() => setEditing(true)}>
            ✏️ Edit Profile
          </button>
        )}
      </div>

      {/* ── Edit form ── */}
      {editing && (
        <div className="pf-card">
          <h2>Edit Profile</h2>
          <div className="pf-field">
            <label>Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell us about yourself…" />
          </div>
          <div className="pf-field">
            <label>GitHub URL</label>
            <input value={githubUrl} onChange={e => setGithubUrl(e.target.value)} placeholder="https://github.com/yourname" />
          </div>
          <div className="pf-field">
            <label>LinkedIn URL</label>
            <input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/yourname" />
          </div>
          <div className="pf-field">
            <label>Skills <span className="pf-hint">(press Enter to add)</span></label>
            <div className="pf-skills-input-row">
              <input
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                placeholder="e.g. Python"
              />
            </div>
            <div className="pf-tags">
              {skills.map(s => (
                <span key={s} className="pf-tag">
                  {s}
                  <button onClick={() => removeSkill(s)}>×</button>
                </span>
              ))}
            </div>
          </div>
          <div className="pf-actions">
            <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Bio & Skills (view mode) ── */}
      {!editing && (
        <div className="pf-card">
          {portfolio.bio && <p className="pf-bio">{portfolio.bio}</p>}
          {portfolio.skills?.length > 0 && (
            <div className="pf-tags">
              {portfolio.skills.map(s => <span key={s} className="pf-tag pf-tag-view">{s}</span>)}
            </div>
          )}
          {!portfolio.bio && !portfolio.skills?.length && (
            <p className="pf-empty-hint">No bio or skills added yet.</p>
          )}
        </div>
      )}

      {/* ── Projects ── */}
      <div className="pf-card">
        <div className="pf-section-header">
          <h2>Projects</h2>
          {isOwner && (
            <button className="btn btn-primary" onClick={() => setShowAddProject(!showAddProject)}>
              + Add Project
            </button>
          )}
        </div>

        {showAddProject && (
          <div className="pf-add-project">
            <div className="pf-field">
              <label>Title *</label>
              <input value={projTitle} onChange={e => setProjTitle(e.target.value)} placeholder="Project name" />
            </div>
            <div className="pf-field">
              <label>Description</label>
              <textarea value={projDesc} onChange={e => setProjDesc(e.target.value)} rows={2} placeholder="What does it do?" />
            </div>
            <div className="pf-field">
              <label>URL</label>
              <input value={projUrl} onChange={e => setProjUrl(e.target.value)} placeholder="https://github.com/…" />
            </div>
            <div className="pf-field">
              <label>Tech stack <span className="pf-hint">(comma separated)</span></label>
              <input value={projTech} onChange={e => setProjTech(e.target.value)} placeholder="React, Flask, PostgreSQL" />
            </div>
            <div className="pf-actions">
              <button className="btn btn-primary" onClick={handleAddProject} disabled={saving}>
                {saving ? 'Adding…' : 'Add'}
              </button>
              <button className="btn" onClick={() => setShowAddProject(false)}>Cancel</button>
            </div>
          </div>
        )}

        {portfolio.projects?.length === 0 && !showAddProject && (
          <p className="pf-empty-hint">No projects yet.</p>
        )}

        <div className="pf-projects">
          {portfolio.projects?.map(proj => (
            <div key={proj.id} className="pf-project-card">
              <div className="pf-project-header">
                <h3>
                  {proj.url
                    ? <a href={proj.url} target="_blank" rel="noreferrer">{proj.title}</a>
                    : proj.title
                  }
                </h3>
                {isOwner && (
                  <button className="pf-delete-btn" onClick={() => handleDeleteProject(proj.id)}>🗑</button>
                )}
              </div>
              {proj.description && <p className="pf-project-desc">{proj.description}</p>}
              {proj.tech_stack?.length > 0 && (
                <div className="pf-tags">
                  {proj.tech_stack.map(t => <span key={t} className="pf-tag pf-tag-tech">{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}