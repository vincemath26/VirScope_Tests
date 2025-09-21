import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LoginWarning from '../components/LoginWarning';
import axios from 'axios';

function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showWarning, setShowWarning] = useState(false);
  const [isClicked, setIsClicked] = useState(null);
  const [isHoveredRegister, setIsHoveredRegister] = useState(false);
  const [isHoveredSubmit, setIsHoveredSubmit] = useState(false);

  const navigate = useNavigate();

  const pageLayout = {
    margin: 0,
    display: 'flex',
    flexDirection: 'row',
    height: '100vh',
    fontFamily: 'Poppins, sans-serif',
    flexWrap: 'wrap',
  };

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

  const line = {
    width: '80%',
    border: '0',
    borderTop: '2px solid #ffffff',
    margin: '1rem 0',
  };

  const text = {
    margin: 0,
    padding: '0.5rem',
  };

  const welcomeTitle = {
    color: '#ffffff',
    fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
    padding: '1rem',
  };

  const welcomeCaption = {
    color: '#ffffff',
    fontSize: 'clamp(0.9rem, 2vw, 1.2rem)',
    lineHeight: '1.5rem',
  };

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
    if (type === 'register' && isHoveredRegister) return buttonHoverWhite;
    if (type === 'submit' && isHoveredSubmit) return buttonHover;
    return button;
  };

  const formContainer = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: '400px',
  };

  const inputContainer = {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '1rem',
    width: '100%',
  };

  const textField = {
    padding: '0.8rem',
    fontSize: '1rem',
    borderRadius: '5px',
    border: '1px solid #cccccc',
    width: '100%',
    boxSizing: 'border-box',
    marginTop: '0.3rem',
  };

  const formLabel = {
    fontSize: '1rem',
    color: '#333333',
  };

  const linkStyle = {
    textDecoration: 'none',
    color: 'inherit',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleButtonClick = (type) => {
    setIsClicked(type);
    setTimeout(() => setIsClicked(null), 200);
  };

  const handleCloseWarning = () => setShowWarning(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const { username, password } = formData;

    axios.post('http://localhost:5000/login', { username, password })
      .then((response) => {
        if (response.data?.token && response.data?.user_id) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user_id', response.data.user_id);
          navigate('/dashboard');
        } else {
          setShowWarning(true);
        }
      })
      .catch(() => {
        setShowWarning(true);
      });
  };

  return (
    <div style={pageLayout}>
      <div style={leftColumn}>
        <h1 style={{ ...text, ...welcomeTitle }}>Time to get back into the grind!</h1>
        <hr style={line} />
        <p style={{ ...text, ...welcomeCaption }}>
          Welcome back to VirScope! We missed you, please log in with your credentials on the right!
        </p>
        <hr style={line} />
        <h1 style={{ ...text, ...welcomeTitle, fontSize: 'clamp(1.2rem, 3vw, 1.8rem)' }}>
          Don&apos;t have an account?
        </h1>
        <button
          style={buttonStyle('register')}
          onMouseEnter={() => setIsHoveredRegister(true)}
          onMouseLeave={() => setIsHoveredRegister(false)}
          onClick={() => handleButtonClick('register')}
        >
          <Link to='/register' style={linkStyle}>Register</Link>
        </button>
      </div>

      <div style={rightColumn}>
        <form style={formContainer} onSubmit={handleSubmit}>
          <h1 style={{ ...text, color: '#73d798', fontSize: '2.5rem', margin: '1.5rem 0' }}>
            Login
          </h1>

          <div style={inputContainer}>
            <label style={formLabel}>Username or Email:</label>
            <input
              style={textField}
              type='text'
              name='username'
              value={formData.username}
              onChange={handleInputChange}
            />
          </div>

          <div style={inputContainer}>
            <label style={formLabel}>Password:</label>
            <input
              style={textField}
              type='password'
              name='password'
              value={formData.password}
              onChange={handleInputChange}
            />
          </div>

          <button
            style={buttonStyle('submit')}
            onMouseEnter={() => setIsHoveredSubmit(true)}
            onMouseLeave={() => setIsHoveredSubmit(false)}
            onClick={() => handleButtonClick('submit')}
            type='submit'
          >
            Submit
          </button>
        </form>
      </div>

      {showWarning && <LoginWarning onClose={handleCloseWarning} />}
    </div>
  );
}

export default Login;
