import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import RegisterWarning from '../components/RegisterWarning';

function Register() {
  const pageLayout = {
    margin: 0,
    display: 'flex',
    height: '100vh'
  };

  const leftColumn = {
    backgroundColor: '#73d798',
    width: '50%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
  };

  const rightColumn = {
    backgroundColor: '#ffffff',
    width: '50%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontFamily: 'Poppins, sans-serif'
  };

  const welcomeTitle = {
    color: '#ffffff',
    fontSize: '5rem',
    padding: '1rem'
  };

  const welcomeCaption = {
    color: '#ffffff',
    fontSize: '2rem',
  };

  const button = {
    color: '#000000',
    fontSize: '2rem',
    height: '10%',
    width: '30%',
    borderStyle: 'solid',
    borderColor: '#73d798',
    borderWidth: '3px',
    borderRadius: '20px',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    margin: '1rem',
    transition: 'all 0.3s ease'
  };

  const buttonHover = {
    ...button,
    backgroundColor: '#73d798',
    color: '#ffffff'
  };

  const buttonHoverWhite = {
    ...button,
    backgroundColor: '#d3d3d3',
    color: '#ffffff'
  };

  const buttonClick = {
    ...button,
    transform: 'scale(0.95)'
  };

  const [isClicked, setIsClicked] = useState(null);
  const [isHoveredLogin, setIsHoveredLogin] = useState(false);
  const [isHoveredSubmit, setIsHoveredSubmit] = useState(false);

  const buttonStyle = (buttonType) => {
    if (isClicked === buttonType) {
      return buttonClick;
    }

    if (buttonType === 'login' && isHoveredLogin) {
      return buttonHoverWhite;
    }

    if (buttonType === 'submit' && isHoveredSubmit) {
      return buttonHover;
    }

    return button;
  };

  const handleButtonClick = (buttonType) => {
    setIsClicked(buttonType);
    setTimeout(() => setIsClicked(null), 200);
  };

  const formContainer = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '80%',
    height: '100%',
  };

  const inputContainer = {
    display: 'flex',
    alignItems: 'center',
    width: '80%',
    marginBottom: '1rem'
  };

  const textField = {
    flex: 1,
    width: '100%',
    padding: '0.8rem',
    fontSize: '1.2rem',
    borderRadius: '5px',
    border: '1px solid #cccccc'
  };

  const formLabels = {
    fontSize: '1.5rem',
    color: '#333333',
    marginRight: '1rem',
    width: '20%'
  };

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);

  const handleCloseWarning = () => {
    setShowWarning(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    axios.post('http://localhost:5000/register', formData)
      .then((response) => {
        const { token, user_id } = response.data;

        if (!token || !user_id) {
          alert('Registration response missing token or user_id');
          return;
        }

        // Save both token and user_id to localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user_id', user_id);

        // Navigate to the dashboard
        navigate('/dashboard');
      })
      .catch((error) => {
        if (error.response) {
          if (error.response.status === 400) {
            setShowWarning(true);
          } else {
            alert('Registration failed! ' + error.response.data.message);
          }
        } else if (error.request) {
          alert('An error occurred, please try again ' + error.request);
        } else {
          alert('An error occurred, please try again: ' + error.message);
        }
      });
  };

  const link = {
    textDecoration: 'none',
    textAlign: 'center',
    color: 'inherit',
    height: '100%',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  return (
    <div style={pageLayout}>
      <div style={leftColumn}>
        <h1 style={{ ...text, ...welcomeTitle }}>
          Want to register an account?
        </h1>
        <hr style={line} />
        <p style={{ ...text, ...welcomeCaption }}>
          Don&apos;t have an account? Register now by just
          giving us your email and username! Make sure to
          set up a password you&apos;ll always remember!
        </p>
        <hr style={line} />
        <h1 style={{ ...text, ...welcomeTitle, fontSize: '2rem' }}>
          Whoopsie, have an account?
        </h1>
        <button
          style={buttonStyle('login')}
          onMouseEnter={() => setIsHoveredLogin(true)}
          onMouseLeave={() => setIsHoveredLogin(false)}
          onClick={() => handleButtonClick('login')}
        >
          <Link to='/login' style={link}>
            Login
          </Link>
        </button>
      </div>

      <div style={rightColumn}>
        <form style={formContainer} onSubmit={handleSubmit}>
          <h1 style={{ ...text, color: '#73d798', fontSize: '3.5rem', margin: '1.5rem' }}>Register</h1>
          <div style={inputContainer}>
            <label style={{ ...formLabels, ...text }}>
              Email:
            </label>
            <input
              style={textField}
              type='text'
              name='email'
              value={formData.email}
              onChange={handleInputChange}
            />
          </div>
          <div style={inputContainer}>
            <label style={{ ...formLabels, ...text }}>
              Password:
            </label>
            <input
              style={textField}
              type='password'
              name='password'
              value={formData.password}
              onChange={handleInputChange}
            />
          </div>
          <div style={inputContainer}>
            <label style={{ ...formLabels, ...text }}>
              Username:
            </label>
            <input
              style={textField}
              type='text'
              name='username' // ✅ Changed from 'name'
              value={formData.username}
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
