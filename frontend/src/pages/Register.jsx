import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import RegisterWarning from '../components/RegisterWarning';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

// Backend URL
const backendBaseURL = process.env.REACT_APP_BACKEND_URL;

function Register() {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
  });
  const [showWarning, setShowWarning] = useState(false);
  const [isClicked, setIsClicked] = useState(null);
  const [isHoveredLogin, setIsHoveredLogin] = useState(false);
  const [isHoveredSubmit, setIsHoveredSubmit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  // Set axios Authorization header if token exists on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);

  // =========================
  // Styles
  // =========================
  const pageLayout = {
    margin: 0,
    display: 'flex',
    flexDirection: 'row',
    height: '100vh',
    fontFamily: 'Poppins, sans-serif',
    flexWrap: 'wrap',
  };

  // ================= LEFT COLUMN (UNCHANGED) =================
  const leftColumn = {
    backgroundColor: '#73d798',
    flex: '1 1 400px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    padding: '2rem',
    boxSizing: 'border-box',
  };

  const line = { width: '80%', border: '0', borderTop: '2px solid #ffffff', margin: '1rem 0' };
  const text = { margin: 0, padding: '0.5rem' };
  const welcomeTitle = { color: '#ffffff', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', padding: '1rem' };
  const welcomeCaption = { color: '#ffffff', fontSize: 'clamp(0.9rem, 2vw, 1.2rem)', lineHeight: '1.5rem' };
  const button = {
    color: '#000000',
    fontSize: '1.2rem',
    padding: '0.8rem 2rem',
    borderStyle: 'solid',
    borderColor: '#73d798',
    borderWidth: '2px',
    borderRadius: '20px',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    margin: '1rem',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  };
  const buttonHover = { ...button, backgroundColor: '#73d798', color: '#ffffff' };
  const buttonHoverWhite = { ...button, backgroundColor: '#d3d3d3', color: '#ffffff' };
  const buttonClick = { ...button, transform: 'scale(0.95)' };

  const buttonStyle = (type) => {
    if (isClicked === type) return buttonClick;
    if (type === 'login' && isHoveredLogin) return buttonHoverWhite;
    if (type === 'submit' && isHoveredSubmit) return buttonHover;
    return button;
  };

  // ================= RIGHT COLUMN (UPDATED TO LOGIN STYLE) =================
  const rightColumn = {
    backgroundColor: '#ffffff',
    flex: '1 1 400px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '2rem',
    boxSizing: 'border-box',
  };

  const formContainer = { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'stretch', width: '100%', maxWidth: '400px' };

  const inputWrapper = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '1rem',
    border: '2px solid #73d798',
    borderRadius: '10px',
    overflow: 'hidden',
  };

  const input = { flex: 1, padding: '0.8rem', fontSize: '1rem', border: 'none', outline: 'none' };

  const toggleButton = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 0.8rem',
    color: '#73d798',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.4rem',
    flexShrink: 0,
  };

  const submitButton = {
    fontSize: '1.2rem',
    padding: '0.8rem 2rem',
    borderRadius: '10px',
    border: '2px solid #73d798',
    backgroundColor: '#73d798',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginTop: '1rem',
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleButtonClick = (type) => { setIsClicked(type); setTimeout(() => setIsClicked(null), 200); };
  const handleCloseWarning = () => setShowWarning(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    axios.post(`${backendBaseURL}/register`, formData)
      .then((response) => {
        const { token, user_id } = response.data;
        if (!token || !user_id) { alert('Registration response missing token or user_id'); return; }
        localStorage.setItem('token', token);
        localStorage.setItem('user_id', user_id);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        navigate('/dashboard');
      })
      .catch((error) => {
        if (error.response && error.response.status === 400) setShowWarning(true);
        else if (error.response) alert('Registration failed! ' + error.response.data.message);
        else if (error.request) alert('An error occurred, please try again ' + error.request);
        else alert('An error occurred, please try again: ' + error.message);
      });
  };

  return (
    <div style={pageLayout}>
      {/* LEFT COLUMN: UNCHANGED */}
      <div style={leftColumn}>
        <h1 style={{ ...text, ...welcomeTitle }}>Want to register an account?</h1>
        <hr style={line} />
        <p style={{ ...text, ...welcomeCaption }}>
          Don't have an account? Register now by giving us your email and username! Make sure to set a password you'll always remember!
        </p>
        <hr style={line} />
        <h1 style={{ ...text, ...welcomeTitle, fontSize: 'clamp(1.2rem, 3vw, 1.8rem)' }}>Have an account?</h1>
        <button
          style={buttonStyle('login')}
          onMouseEnter={() => setIsHoveredLogin(true)}
          onMouseLeave={() => setIsHoveredLogin(false)}
          onClick={() => handleButtonClick('login')}
        >
          <Link to='/login' style={{ textDecoration: 'none', color: 'inherit' }}>Login</Link>
        </button>
      </div>

      {/* RIGHT COLUMN: LOGIN STYLE */}
      <div style={rightColumn}>
        <form style={formContainer} onSubmit={handleSubmit}>
          <h1 style={{ color: '#73d798', fontSize: '2.5rem', marginBottom: '1.5rem' }}>Register</h1>

          <div style={inputWrapper}>
            <input
              type="text"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleInputChange}
              style={input}
            />
          </div>

          <div style={inputWrapper}>
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleInputChange}
              style={input}
            />
          </div>

          <div style={inputWrapper}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleInputChange}
              style={input}
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              style={toggleButton}
              tabIndex={-1}
            >
              {showPassword ? <VisibilityOff /> : <Visibility />}
            </button>
          </div>

          <button type="submit" style={submitButton}>Submit</button>
        </form>
      </div>

      {showWarning && <RegisterWarning onClose={handleCloseWarning} />}
    </div>
  );
}

export default Register;
