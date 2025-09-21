import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import RegisterWarning from '../components/RegisterWarning';

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

  const navigate = useNavigate();

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

  const leftColumn = {
    backgroundColor: '#73d798',
    flex: '1 1 400px', // grow, shrink, basis
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
    margin: '1rem 0'
  };

  const text = {
    margin: 0,
    padding: '0.5rem',
  };

  // Left column text scales dynamically based on viewport width
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
    if (type === 'login' && isHoveredLogin) return buttonHoverWhite;
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

  // =========================
  // Handlers
  // =========================
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
    axios.post('http://localhost:5000/register', formData)
      .then((response) => {
        const { token, user_id } = response.data;
        if (!token || !user_id) {
          alert('Registration response missing token or user_id');
          return;
        }
        localStorage.setItem('token', token);
        localStorage.setItem('user_id', user_id);
        navigate('/dashboard');
      })
      .catch((error) => {
        if (error.response && error.response.status === 400) {
          setShowWarning(true);
        } else if (error.response) {
          alert('Registration failed! ' + error.response.data.message);
        } else if (error.request) {
          alert('An error occurred, please try again ' + error.request);
        } else {
          alert('An error occurred, please try again: ' + error.message);
        }
      });
  };

  return (
    <div style={pageLayout}>
      <div style={leftColumn}>
        <h1 style={{ ...text, ...welcomeTitle }}>Want to register an account?</h1>
        <hr style={line} />
        <p style={{ ...text, ...welcomeCaption }}>
          Don't have an account? Register now by giving us your email and username!
          Make sure to set a password you'll always remember!
        </p>
        <hr style={line} />
        <h1 style={{ ...text, ...welcomeTitle, fontSize: 'clamp(1.2rem, 3vw, 1.8rem)' }}>
          Have an account?
        </h1>
        <button
          style={buttonStyle('login')}
          onMouseEnter={() => setIsHoveredLogin(true)}
          onMouseLeave={() => setIsHoveredLogin(false)}
          onClick={() => handleButtonClick('login')}
        >
          <Link to='/login' style={linkStyle}>Login</Link>
        </button>
      </div>

      <div style={rightColumn}>
        <form style={formContainer} onSubmit={handleSubmit}>
          <h1 style={{ ...text, color: '#73d798', fontSize: '2.5rem', margin: '1.5rem 0' }}>
            Register
          </h1>

          <div style={inputContainer}>
            <label style={formLabel}>Email:</label>
            <input
              style={textField}
              type='text'
              name='email'
              value={formData.email}
              onChange={handleInputChange}
            />
          </div>

          <div style={inputContainer}>
            <label style={formLabel}>Username:</label>
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

      {showWarning && <RegisterWarning onClose={handleCloseWarning} />}
    </div>
  );
}

export default Register;
