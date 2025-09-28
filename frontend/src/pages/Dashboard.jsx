import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Create from '../components/Create';
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
  const [isHoveredUpload, setIsHoveredUpload] = useState(false);
  const [isHoveredSearch, setIsHoveredSearch] = useState(false);

  const buttonStyle = (buttonType) => {
    if (isClicked === buttonType) return buttonClick;
    if (buttonType === 'upload' && isHoveredUpload) return buttonHover;
    if (buttonType === 'search' && isHoveredSearch) return buttonHover;
    return button;
  };

  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const openPopup = () => setIsCreateVisible(true);
  const closePopup = () => setIsCreateVisible(false);

  const [virscanFiles, setVirscanFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState("");

  // =========================
  // Fetch files
  // =========================
  const fetchFiles = (query = "") => {
    const token = localStorage.getItem('token');

    axios.get(`${backendBaseURL}/uploads`, { headers: { Authorization: `Bearer ${token}` } })
      .then(response => {
        let files = response.data;
        if (query.trim()) files = files.filter(file => file.name.toLowerCase().includes(query.toLowerCase()));
        setVirscanFiles(files);
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
    fetchFiles();
  }, []);

  const handleSearch = () => { fetchFiles(searchQuery); };
  const handleNewVirScan = (newFile) => setVirscanFiles(prev => [...prev, newFile]);

  const renameFile = (upload_id) => {
    const token = localStorage.getItem("token");
    if (!newName.trim()) { setEditingId(null); return; }

    axios.post(
      `${backendBaseURL}/upload/${upload_id}/rename`,
      { new_name: newName },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    .then(res => {
      setVirscanFiles(prev => prev.map(f =>
        f.upload_id === upload_id ? { ...f, name: res.data.new_name } : f
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
  const fileName = { fontWeight: 'bold', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' };
  const fileDate = { fontSize: '0.9rem', color: '#666' };
  const cardRow = { display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap', marginBottom: '1rem' };

  const renderRows = () => {
    const rows = [];
    for (let i = 0; i < virscanFiles.length; i += 5) {
      rows.push({ files: virscanFiles.slice(i, i + 5), startIndex: i });
    }

    return rows.map((row, rowIndex) => (
      <div key={rowIndex} style={cardRow}>
        {row.files.map((file, index) => (
          <div
            key={file.upload_id}
            title={file.name}
            style={{ ...card, ...(hoveredIndex === row.startIndex + index ? cardHover : {}) }}
            onMouseEnter={() => setHoveredIndex(row.startIndex + index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => navigate(`/visualise/${file.upload_id}`)}
          >
            {editingId === file.upload_id ? (
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => renameFile(file.upload_id)}
                onKeyDown={(e) => { if(e.key === 'Enter') renameFile(file.upload_id) }}
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
              <h3
                style={fileName}
                onDoubleClick={() => {
                  setEditingId(file.upload_id);
                  setNewName(file.name.replace(/\.[^/.]+$/, ""));
                }}
              >
                {file.name}
              </h3>
            )}
            <p style={fileDate}>{new Date(file.date_created).toLocaleString()}</p>
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
            placeholder="Search files..."
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
            style={buttonStyle('upload')}
            onClick={openPopup}
            onMouseEnter={() => setIsHoveredUpload(true)}
            onMouseLeave={() => setIsHoveredUpload(false)}
          >
            New Analysis
          </button>
        </div>
      </div>

      <div style={{ marginTop: '2rem', width: '100%', maxWidth: '1200px' }}>
        <h2 style={{ fontFamily: 'Poppins, sans-serif', marginBottom: '1rem' }}>Your Uploaded Files</h2>
        {isLoading ? <p>Loading VirScan Files...</p> :
          virscanFiles.length > 0 ? renderRows() : <p>No uploaded files found.</p>
        }
      </div>

      {isCreateVisible && <Create onClose={closePopup} onCreate={handleNewVirScan} />}
    </div>
  );
}

export default Dashboard;
