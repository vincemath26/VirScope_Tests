import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateWorkspace from '../components/CreateWorkspace';
import axios from 'axios';

function Dashboard() {
  const navigate = useNavigate();

  // Backend URL from environment
  const backendBaseURL = process.env.REACT_APP_BACKEND_URL;

  // =========================
  // Styles
  // =========================
  const dashboardContainer = { 
    marginTop: '2%', 
    padding: '2rem', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center' 
  };

  const upperRow = { 
    display: 'flex', 
    flexDirection: 'column', 
    justifyContent: 'center', 
    alignItems: 'center', 
    width: '100%',
    maxWidth: '1200px',
    marginBottom: '2rem'
  };

  const dashboardTitle = { 
    margin: 0, 
    padding: '0.5rem', 
    fontFamily: 'Poppins, sans-serif', 
    color: '#73D798', 
    fontSize: 'clamp(2rem, 4vw, 4rem)', 
    textAlign: 'center',
    wordWrap: 'break-word'
  };

  const line = { width: '100%', border: '0', borderTop: '2px solid #333333', margin: '1rem 0' };

  const button = {
    color: '#000',
    height: '40px',
    borderStyle: 'solid',
    borderColor: '#73D798',
    borderWidth: '3px',
    borderRadius: '20px',
    backgroundColor: '#ffffff',
    margin: '0',
    padding: '0 1rem',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    flexShrink: 0
  };
  const buttonHover = { ...button, backgroundColor: '#73D798', color: '#fff' };
  const buttonClick = { ...button, transform: 'scale(0.95)' };

  const [isClicked, setIsClicked] = useState(null);
  const [isHoveredCreate, setIsHoveredCreate] = useState(false);
  const [isHoveredSearch, setIsHoveredSearch] = useState(false);

  const buttonStyle = (buttonType) => {
    if (isClicked === buttonType) return buttonClick;
    if (buttonType === 'create' && isHoveredCreate) return buttonHover;
    if (buttonType === 'search' && isHoveredSearch) return buttonHover;
    return button;
  };

  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const openPopup = () => setIsCreateVisible(true);
  const closePopup = () => setIsCreateVisible(false);

  const [workspaces, setWorkspaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState("");

  // =========================
  // Fetch workspaces
  // =========================
  const fetchWorkspaces = (query = "") => {
    const token = localStorage.getItem('token');

    axios.get(`${backendBaseURL}/workspaces`, { headers: { Authorization: `Bearer ${token}` } })
      .then(response => {
        let ws = response.data;
        if (query.trim()) ws = ws.filter(w => w.title.toLowerCase().includes(query.toLowerCase()));
        setWorkspaces(ws);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setIsLoading(true);
    fetchWorkspaces();
  }, []);

  const handleSearch = () => { fetchWorkspaces(searchQuery); };
  const handleNewWorkspace = (newWorkspace) => setWorkspaces(prev => [...prev, newWorkspace]);

  const renameWorkspace = (workspace_id) => {
    const token = localStorage.getItem("token");
    if (!newName.trim()) { setEditingId(null); return; }

    axios.post(
      `${backendBaseURL}/workspace/${workspace_id}/rename`,
      { new_title: newName, new_description: "" },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    .then(res => {
      setWorkspaces(prev => prev.map(w =>
        w.workspace_id === workspace_id ? { ...w, title: res.data.workspace.title } : w
      ));
      setEditingId(null);
    })
    .catch(err => {
      console.error("Rename failed:", err);
      setEditingId(null);
    });
  };

  // =========================
  // Card styles and rendering
  // =========================
  const card = {
    border: '1px solid #ddd',
    borderRadius: '12px',
    padding: '1rem',
    flex: '1 1 150px',
    maxWidth: '200px',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    marginBottom: '1rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  };
  const cardHover = { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' };
  const fileTitle = { fontWeight: 'bold', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' };
  const fileDescription = { fontSize: '0.9rem', color: '#555', marginTop: '0.3rem', width: '100%' };
  const fileDate = { fontSize: '0.8rem', color: '#666', marginTop: '0.2rem' };
  const cardRow = { display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap', marginBottom: '1rem' };

  const renderRows = () => {
    const rows = [];
    for (let i = 0; i < workspaces.length; i += 5) {
      rows.push({ workspaces: workspaces.slice(i, i + 5), startIndex: i });
    }

    return rows.map((row, rowIndex) => (
      <div key={rowIndex} style={cardRow}>
        {row.workspaces.map((ws, index) => (
          <div
            key={ws.workspace_id}
            title={ws.title}
            style={{ ...card, ...(hoveredIndex === row.startIndex + index ? cardHover : {}) }}
            onMouseEnter={() => setHoveredIndex(row.startIndex + index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => {
              localStorage.setItem('workspace', JSON.stringify({ id: ws.workspace_id }));
              navigate(`/workspace/${ws.workspace_id}`);
            }}
          >
            {editingId === ws.workspace_id ? (
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => renameWorkspace(ws.workspace_id)}
                onKeyDown={(e) => { if(e.key === 'Enter') renameWorkspace(ws.workspace_id) }}
                style={{
                  width: '90%',
                  padding: '0.3rem',
                  borderRadius: '10px',
                  border: '2px solid #73D798',
                  fontSize: '0.9rem'
                }}
                autoFocus
              />
            ) : (
              <>
                <h3 style={fileTitle} onDoubleClick={() => { setEditingId(ws.workspace_id); setNewName(ws.title); }}>
                  {ws.title}
                </h3>
                <p style={fileDescription}>{ws.description || ''}</p>
                <p style={fileDate}>{new Date(ws.date_created).toLocaleString()}</p>
              </>
            )}
          </div>
        ))}
      </div>
    ));
  };

  // =========================
  // Responsive search row
  // =========================
  const searchRowStyle = {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    width: '100%',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: '1rem'
  };

  const searchInputStyle = {
    flexGrow: 2,
    minWidth: '150px',
    padding: '0.5rem',
    borderRadius: '20px',
    border: '3px solid #73D798',
    fontSize: '1rem',
    flexBasis: '250px'
  };

  // =========================
  // Render
  // =========================
  return (
    <div style={dashboardContainer}>
      <div style={upperRow}>
        <h1 style={dashboardTitle}>Welcome to VirScan! What do you want to analyse?</h1>
        <hr style={line} />
        <div style={searchRowStyle}>
          <input
            type="text"
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            style={searchInputStyle}
          />
          <button
            style={buttonStyle('search')}
            onClick={handleSearch}
            onMouseEnter={() => setIsHoveredSearch(true)}
            onMouseLeave={() => setIsHoveredSearch(false)}
          >
            Search
          </button>
          <button
            style={buttonStyle('create')}
            onClick={openPopup}
            onMouseEnter={() => setIsHoveredCreate(true)}
            onMouseLeave={() => setIsHoveredCreate(false)}
          >
            New Workspace
          </button>
        </div>
      </div>

      <div style={{ marginTop: '2rem', width: '100%', maxWidth: '1200px' }}>
        <h2 style={{ fontFamily: 'Poppins, sans-serif', marginBottom: '1rem' }}>Your Workspaces</h2>
        {isLoading ? <p>Loading Workspaces...</p> :
          workspaces.length > 0 ? renderRows() : <p>No workspaces found.</p>
        }
      </div>

      {isCreateVisible && <CreateWorkspace onClose={closePopup} onCreate={handleNewWorkspace} />}
    </div>
  );
}

export default Dashboard;
