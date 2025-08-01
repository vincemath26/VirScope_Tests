import { useState } from 'react';

function LoginWarning({ onClose }) {
  // Style for header.
  const popupContainer = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    padding: '2rem',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    zIndex: 1000,
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)'
  }

  const text = {
    fontFamily: 'Poppins, sans-serif',
    textAlign: 'center',
  }

  const line = {
    width: '100%',
    border: '0',
    borderTop: '2px solid #000000',
    margin: '1rem 0'
  }

  const popupTitle = {
    color: '#ff0000',
    fontSize: '3rem'
  }

  const popupContent = {
    color: '#333333',
    fontSize: '1.5rem'
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
    borderColor: '#4169e1',
    borderWidth: '3px',
    borderRadius: '20px',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    margin: '1rem',
    transition: 'all 0.3s ease'
  }

  const buttonHover = {
    ...button,
    backgroundColor: '#4169e1',
    color: '#ffffff'
  }

  const buttonClick = {
    ...button,
    transform: 'scale(0.95)'
  }

  const [isClicked, setIsClicked] = useState(null);
  const [isHoveredClosed, setIsHoveredClosed] = useState(false);

  const buttonStyle = (buttonType) => {
    if (isClicked === buttonType) {
      return buttonClick;
    }

    if (buttonType === 'close' && isHoveredClosed) {
      return buttonHover;
    }

    return button;
  }

  const handleButtonClick = (buttonType) => {
    setIsClicked(buttonType);
    setTimeout(() => {
      setIsClicked(null);
      if (buttonType === 'close') {
        onClose();
      }
    }, 200);
  }

  // Return this popup
  return (
    <div style={popupContainer}>
      <h1 style={{...text, ...popupTitle}}>
        Warning!
      </h1>
      <hr style={line} />
      <p style={{...text, ...popupContent}}>
        You have entered the wrong credentials. Please try again!
      </p>
      <button 
        style={buttonStyle('close')}
        onMouseEnter={() => setIsHoveredClosed(true)}
        onMouseLeave={() => setIsHoveredClosed(false)}
        onClick={() => handleButtonClick('close')}
      >
        Close
      </button>
    </div>
  );
}

export default LoginWarning;
