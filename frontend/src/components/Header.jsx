import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Header() {
  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 1rem',
    backgroundColor: '#d3d3d3',
    color: '#ffffff',
    position: 'fixed',
    width: '100%',
    top: 0,
    left: 0,
    zIndex: 1000,
    height: 'auto', // allow flexible height for smaller screens
    minHeight: '3.5rem', // ensures a good tap area on phones
    boxSizing: 'border-box',
  };

  const headerTitle = {
    textAlign: 'center',
    color: '#ffffff',
    fontFamily: 'Poppins, sans-serif',
    margin: 0,
    fontSize: '1.2rem',
    flex: 1, // ensures title stays centered properly on small screens
  };

  const button = {
    color: '#000000',
    fontSize: '0.9rem', // slightly smaller for phones
    padding: '0.4rem 1rem', // better scaling than fixed height/width
    borderStyle: 'solid',
    borderColor: '#73D798',
    borderWidth: '3px',
    borderRadius: '20px',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    margin: '0.5rem',
    transition: 'all 0.3s ease',
    whiteSpace: 'nowrap', // prevent wrapping of "Logout"
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

  const backendBaseURL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
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
        Authorization: `Bearer ${token}`,
      },
    };

    axios
      .post(`${backendBaseURL}/logout`, {}, config)
      .then((response) => {
        if (response) {
          localStorage.removeItem('token');
          sessionStorage.clear();
          navigate('/');
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
