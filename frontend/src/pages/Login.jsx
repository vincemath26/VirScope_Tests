import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LoginWarning from '../components/LoginWarning';
import axios from 'axios';

function Login() {
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
  const [isHoveredRegister, setIsHoveredRegister] = useState(false);
  const [isHoveredSubmit, setIsHoveredSubmit] = useState(false);

  const buttonStyle = (buttonType) => {
    if (isClicked === buttonType) {
      return buttonClick;
    }

    if (buttonType === 'register' && isHoveredRegister) {
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
    username: '',
    password: ''
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

    // Use formData here to get the values
    const { username, password } = formData;

    axios
      .post('http://localhost:5000/login', { username, password })
      .then((response) => {
        console.log("Full response:", response);  // Debugging response

        if (response.data && response.data.token && response.data.user_id) {
          // Save both the token and user_id to localStorage
          localStorage.setItem('token', response.data.token);  // Save token
          localStorage.setItem('user_id', response.data.user_id);  // Save user_id

          navigate('/dashboard');  // Redirect to dashboard
        } else {
          console.error('Missing token or user_id in response:', response.data);
          alert('An error occurred during login. Please try again.');
        }
      })
      .catch((error) => {
        console.error("Error during login:", error);  // Log any error
        alert('An error occurred during login. Please try again.');
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
          Time to get back into the grind!
        </h1>
        <hr style={line} />
        <p style={{ ...text, ...welcomeCaption }}>
          Welcome back to VirScope! We missed you,
          please log in with your correct credentials
          on the right!
        </p>
        <hr style={line} />
        <h1 style={{ ...text, ...welcomeTitle, fontSize: '2rem' }}>
          Whoopsie, don&apos;t have an account?
        </h1>
        <button
          style={buttonStyle('register')}
          onMouseEnter={() => setIsHoveredRegister(true)}
          onMouseLeave={() => setIsHoveredRegister(false)}
          onClick={() => handleButtonClick('register')}
        >
          <Link to='/register' style={link}>
            Register
          </Link>
        </button>
      </div>

      <div style={rightColumn}>
        <form style={formContainer} onSubmit={handleSubmit}>
          <h1 style={{ ...text, color: '#73d798', fontSize: '3.5rem', margin: '1.5rem' }}>Login</h1>
          <div style={inputContainer}>
            <label style={{ ...formLabels, ...text }}>
              Username or Email:
            </label>
            <input
              style={textField}
              type='text'
              name='username'
              value={formData.username}
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
