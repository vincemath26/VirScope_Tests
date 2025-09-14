import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Create from '../components/Create';
import axios from 'axios';

function Dashboard() {
  const navigate = useNavigate();

  const dashboardContainer = {
    marginTop: '2%',
    padding: '2rem',
    height: 'auto',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
  };

  const upperRow = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '2rem',
  };

  const dashboardTitle = {
    margin: 0,
    padding: '0.5rem',
    fontFamily: 'Poppins, sans-serif',
    color: '#73D798',
    fontSize: '4rem',
    width: '70%',
    textAlign: 'center',
  };

  const line = {
    width: '70%',
    border: '0',
    borderTop: '2px solid #333333',
    margin: '1rem 0',
  };

  const button = {
    color: '#000000',
    fontSize: '2rem',
    height: '50%',
    width: '20%',
    borderStyle: 'solid',
    borderColor: '#73D798',
    borderWidth: '3px',
    borderRadius: '20px',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    margin: '1rem',
    transition: 'all 0.3s ease',
  };

  const buttonHover = {
    ...button,
    backgroundColor: '#73D798',
    color: '#ffffff',
  };

  const buttonClick = {
    ...button,
    transform: 'scale(0.95)',
  };

  const [isClicked, setIsClicked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const buttonStyle = () => {
    if (isClicked) return buttonClick;
    if (isHovered) return buttonHover;
    return button;
  };

  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const openPopup = () => setIsCreateVisible(true);
  const closePopup = () => setIsCreateVisible(false);

  const card = {
    border: '1px solid #dddddd',
    borderRadius: '8px',
    padding: '1rem',
    width: 'calc(15% - 2rem)',
    minWidth: '120px',
    height: '100px',
    textAlign: 'center',
    boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    marginBottom: '1rem',
    cursor: 'pointer',
  };

  const cardHover = {
    transform: 'scale(1.05)',
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
  };

  const cardGrid = {
    display: 'flex',
    gap: '15px',
    flexWrap: 'wrap',
  };

  const fileName = {
    fontWeight: 'bold',
    fontSize: '1rem',
  };

  const fileDate = {
    fontSize: '0.9rem',
    color: '#666',
  };

  const popupContainer = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    padding: '2rem',
    width: '100%',
    height: '100%',
    textAlign: 'center',
    zIndex: 1000,
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
    display: isCreateVisible ? 'block' : 'none',
  };

  const [virscanFiles, setVirscanFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('user_id');

    if (!userId) {
      console.error('No user ID found in localStorage');
      return;
    }

    axios
      .get(`http://localhost:5000/uploads/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response) => {
        setVirscanFiles(response.data);
      })
      .catch((error) => {
        console.error('Error fetching VirScan files:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleNewVirScan = (newFile) => {
    setVirscanFiles((prevFiles) => [...prevFiles, newFile]);
  };

  // NEW: handle search
  const handleSearch = () => {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("user_id");

    if (!userId || !searchQuery.trim()) return;

    axios
      .get(`http://localhost:5000/search/${userId}?q=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        setSearchResults(response.data);
      })
      .catch((error) => {
        console.error("Search error:", error);
      });
  };

  // Decide which list to show
  const filesToDisplay =
    searchResults.length > 0 || searchQuery.trim().length > 0
      ? searchResults
      : virscanFiles;

  return (
    <div style={dashboardContainer}>
      <div style={upperRow}>
        <h1 style={dashboardTitle}>Welcome to VirScan! What do you want to analyse?</h1>
        <hr style={line} />
        <button
          style={buttonStyle()}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={openPopup}
        >
          New Analysis
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ padding: "0.5rem", borderRadius: "5px", marginRight: "0.5rem" }}
        />
        <button onClick={handleSearch}>Search</button>
      </div>

      <div>
        <h2 style={{ fontFamily: 'Poppins, sans-serif', marginBottom: '1rem' }}>
          Your Uploaded Files
        </h2>
        <div style={cardGrid}>
          {isLoading ? (
            <p>Loading VirScan Files...</p>
          ) : filesToDisplay.length > 0 ? (
            filesToDisplay.map((file, index) => (
              <div
                key={file.upload_id}
                style={{
                  ...card,
                  ...(hoveredIndex === index ? cardHover : {}),
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => navigate(`/visualise/${file.upload_id}`)}
              >
                <h3 style={fileName}>{file.name}</h3>
                <p style={fileDate}>{new Date(file.date_created).toLocaleString()}</p>
              </div>
            ))
          ) : (
            <p>No uploaded files found.</p>
          )}
        </div>
      </div>

      <div style={popupContainer}>
        <Create onClose={closePopup} onCreate={handleNewVirScan} />
      </div>
    </div>
  );
}

export default Dashboard;
