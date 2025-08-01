import { useState } from 'react';
import { Link } from 'react-router-dom';

function Landing() {
  const pageLayout = {
    margin: 0,
    display: 'flex',
    height: '100vh'
  }
    
  const leftColumn = {
    backgroundColor: '#73d798',
    width: '50%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
  }

  const rightColumn = {
    backgroundColor: '#ffffff',
    width: '50%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  }

  const line = {
    width: '80%',
    border: '0',
    borderTop: '2px solid #ffffff',
    margin: '1rem 0'
  }

  const text = {
    color: '#ffffff',
    margin: 0,
    padding: '0.5rem',
    fontFamily: 'Poppins, sans-serif'
  }

  const welcomeTitle = {
    fontSize: '5rem',
    padding: '1rem'
  }

  const welcomeCaption = {
    fontSize: '2rem',
  }

  // Custom animated button, note that
  // the previous assignments helped create
  // this.
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
  }

  const buttonHover = {
    ...button,
    backgroundColor: '#73d798',
    color: '#ffffff'
  }

  const buttonClick = {
    ...button,
    transform: 'scale(0.95)'
  }

  const [isClicked, setIsClicked] = useState(null);
  const [isHovered, setIsHovered] = useState(null);

  const buttonStyle = (buttonType) => {
    if (isClicked === buttonType) {
      return buttonClick;
    }

    if (isHovered === buttonType) {
      return buttonHover;
    }

    return button;
  }

  const handleButtonClick = (buttonType) => {
    setIsClicked(buttonType);
    setTimeout(() => setIsClicked(null), 200);
  }

  const link = {
    textDecoration: 'none',
    textAlign: 'center',
    color: 'inherit',
    height: '100%',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }

  return (
    <div style={pageLayout}>
      <div style={leftColumn}>
        <h1 style={{...text, ...welcomeTitle}}>
                    Welcome to VirScope!
        </h1>
        <hr style={line} />
        <p style={{...text, ...welcomeCaption}}>
                    VirScope is the best place to analyse your data! 
                    Have an account? Login using your crendentials! Don&apos;t 
                    have one? No problem, register now!
        </p>
      </div>

      <div style={rightColumn}>
        <button 
          style={buttonStyle('login')}
          onMouseEnter={() => setIsHovered('login')}
          onMouseLeave={() => setIsHovered(null)}
          onClick={() => handleButtonClick('login')}
        >
          <Link to='/login' style={link}>
                        Login
          </Link>
        </button>
        <button 
          style={buttonStyle('register')}
          onMouseEnter={() => setIsHovered('register')}
          onMouseLeave={() => setIsHovered(null)}
          onClick={() => handleButtonClick('register')}
        >
          <Link to='/register' style={link}>
                        Register
          </Link>
        </button>
      </div>
    </div>
  )
}

export default Landing;