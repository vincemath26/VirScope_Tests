import { useState } from 'react';
import { Link } from 'react-router-dom';

function Landing() {
  const [isClicked, setIsClicked] = useState(null);
  const [isHovered, setIsHovered] = useState(null);

  const pageLayout = {
    margin: 0,
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: '100vh',
    fontFamily: 'Poppins, sans-serif',
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
    color: '#ffffff',
  };

  const welcomeTitle = {
    fontSize: 'clamp(2rem, 5vw, 4rem)',
    padding: '1rem',
  };

  const welcomeCaption = {
    fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
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
  const buttonClick = { ...button, transform: 'scale(0.95)' };

  const buttonStyle = (type) => {
    if (isClicked === type) return buttonClick;
    if (isHovered === type) return buttonHover;
    return button;
  };

  const link = {
    textDecoration: 'none',
    color: 'inherit',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  };

  const handleButtonClick = (type) => {
    setIsClicked(type);
    setTimeout(() => setIsClicked(null), 200);
  };

  return (
    <div style={pageLayout}>
      <div style={leftColumn}>
        <h1 style={{ ...text, ...welcomeTitle }}>Welcome to VirScope!</h1>
        <hr style={line} />
        <p style={{ ...text, ...welcomeCaption }}>
          VirScope is the best place to analyse your data! Have an account? Login using your credentials!
          Don&apos;t have one? No problem, register now!
        </p>
      </div>

      <div style={rightColumn}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '300px' }}>
          {['login', 'register'].map((type) => (
            <button
              key={type}
              style={buttonStyle(type)}
              onMouseEnter={() => setIsHovered(type)}
              onMouseLeave={() => setIsHovered(null)}
              onClick={() => handleButtonClick(type)}
            >
              <Link to={`/${type}`} style={{ ...link }}>{type.charAt(0).toUpperCase() + type.slice(1)}</Link>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Landing;
