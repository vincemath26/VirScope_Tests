import { useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

function Security({ setSiteAuth }) {
  const backendBaseURL = process.env.REACT_APP_BACKEND_URL;

  // States
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hover, setHover] = useState(false);

  // Inline styles
  const fullScreen = {
    display: 'flex',
    height: '100vh',
    margin: 0,
  };

  const leftColumn = {
    backgroundColor: '#73d798',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    color: '#ffffff',
  };

  const title = {
    fontSize: '4rem',
    marginBottom: '1rem',
    fontFamily: 'Poppins, sans-serif',
  };

  const inputContainer = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '1rem',
  };

  const input = {
    fontSize: '1.5rem',
    padding: '0.5rem 10px',
    borderRadius: '10px',
    border: '2px solid #ffffff',
    outline: 'none',
    width: '300px',
  };

  const toggleButton = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    marginLeft: '10px',
    color: '#ffffff',
    fontSize: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const button = {
    fontSize: '1.5rem',
    padding: '0.5rem 2rem',
    borderRadius: '10px',
    border: '2px solid #ffffff',
    backgroundColor: '#ffffff',
    color: '#73d798',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  };

  const buttonHover = {
    ...button,
    backgroundColor: '#73d798',
    color: '#ffffff',
  };

  // Check token on mount
  useEffect(() => {
    const token = localStorage.getItem('siteToken');
    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      const now = Date.now() / 1000;

      if (decoded.exp && decoded.exp > now) {
        axios
          .post(`${backendBaseURL}/verify-site-token`, { token })
          .then((res) => {
            if (res.data.valid) setSiteAuth(true);
            else localStorage.removeItem('siteToken');
          })
          .catch(() => localStorage.removeItem('siteToken'));
      } else {
        localStorage.removeItem('siteToken');
      }
    } catch (e) {
      localStorage.removeItem('siteToken');
    }
  }, [setSiteAuth, backendBaseURL]);

  // Handle password submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${backendBaseURL}/check-site-password`, { password });
      localStorage.setItem('siteToken', res.data.token);
      setSiteAuth(true);
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  return (
    <div style={fullScreen}>
      <div style={leftColumn}>
        <h1 style={title}>Enter Site Password</h1>
        <form onSubmit={handleSubmit}>
          <div style={inputContainer}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              style={toggleButton}
              tabIndex={-1}
            >
              {showPassword ? <VisibilityOff /> : <Visibility />}
            </button>
          </div>

          <button
            type="submit"
            style={hover ? buttonHover : button}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            disabled={loading}
          >
            {loading ? 'Checking...' : 'Submit'}
          </button>
        </form>

        {error && <p style={{ marginTop: '1rem', color: '#ffdddd' }}>{error}</p>}
      </div>
    </div>
  );
}

export default Security;
