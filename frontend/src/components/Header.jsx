import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Header() {
  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 1rem',
    backgroundColor: '#d3d3d3',
    color: '#ffffff',
    position: 'fixed',
    width: '100%',
    height: '5%',
    top: 0,
    left: 0,
    zIndex: 1000
  };

  const headerTitle = {
    textAlign: 'center',
    color: '#ffffff',
    fontFamily: 'Poppins, sans-serif',
    margin: 0
  };

  const button = {
    color: '#000000',
    fontSize: '1rem',
    height: '70%',
    width: '6rem',
    borderStyle: 'solid',
    borderColor: '#73D798',
    borderWidth: '3px',
    borderRadius: '20px',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    margin: '2rem',
    transition: 'all 0.3s ease'
  };

  const buttonHover = {
    ...button,
    backgroundColor: '#73D798',
    color: '#ffffff'
  };

  const buttonClick = {
    ...button,
    transform: 'scale(0.95)'
  };

  const [isClicked, setIsClicked] = useState(null);
  const [isHoveredLogout, setIsHoveredLogout] = useState(false);

  const buttonStyle = (buttonType) => {
    if (isClicked === buttonType) {
      return buttonClick;
    }

    if (buttonType === 'logout' && isHoveredLogout) {
      return buttonHover;
    }

    return button;
  };

  const navigate = useNavigate();

  // Adding search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const handleSearch = () => {
    const userId = localStorage.getItem("user_id");
    const token = localStorage.getItem("token");

    if (!userId || !searchQuery.trim()) return;

    axios
      .get(`http://localhost:5000/search/${userId}?q=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        setSearchResults(response.data);
        // Optionally: navigate to a "Search Results" page, or update dashboard
        console.log("Search results:", response.data);
      })
      .catch((error) => {
        console.error("Search error:", error);
      });
  };

  // Check if the user is logged in by checking for a token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/'); // Redirect to the homepage if no token is found
    }
  }, [navigate]);

  const handleLogout = (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');

    if (!token) {
      alert('You are not logged in.');
      return;
    }

    setIsClicked('logout');

    const config = {
      headers: {
        Authorization: `Bearer ${token}`, // Send token for backend authentication
      },
    };

    // Corrected URL
    axios
      .post('http://localhost:5000/logout', {}, config)
      .then((response) => {
        if (response) {
          localStorage.removeItem('token'); // Remove the token from localStorage
          sessionStorage.clear(); // Clear session storage, if used
          navigate('/'); // Redirect to homepage after logging out
        }
      })
      .catch((error) => {
        console.error(error);
        alert('Oops, there was an error logging out. Please try again!');
      });
  };

  return (
    <header style={headerStyle}>
      <h1 style={headerTitle}>VirScope</h1>
      <div style={{ display: "flex", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ padding: "0.5rem", borderRadius: "5px", marginRight: "0.5rem" }}
        />
        <button style={button} onClick={handleSearch}>
          Search
        </button>
      </div>
      <button
        style={buttonStyle('logout')}
        onMouseEnter={() => setIsHoveredLogout('logout')}
        onMouseLeave={() => setIsHoveredLogout(null)}
        onClick={(e) => handleLogout(e)}
      >
        Logout
      </button>
    </header>
  );
}

export default Header;
