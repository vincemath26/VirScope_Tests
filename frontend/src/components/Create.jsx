import { useState } from 'react';
import axios from 'axios';

function Create({ onClose, onCreate }) {
  const popupContainer = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    padding: '2rem',
    width: '60%',
    height: '50%',
    textAlign: 'center',
    zIndex: 1000,
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
  };

  const text = { fontFamily: 'Poppins, sans-serif', textAlign: 'center' };
  const popupTitle = { color: '#73d798', fontSize: '2.5rem' };
  const line = { width: '100%', border: '0', borderTop: '2px solid #000', margin: '1rem 0' };

  const inputContainer = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: '1rem'
  };

  const formLabels = {
    fontSize: '1.2rem',
    color: '#333',
    marginRight: '1rem',
    width: '20%',
    textAlign: 'right'
  };

  const textField = {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: '150px',
    padding: '0.8rem',
    fontSize: '1.2rem',
    borderRadius: '5px',
    border: '1px solid #ccc'
  };

  const fileInput = { flex: 1, fontSize: '1rem' };

  const button = {
    color: '#000',
    fontSize: '1.2rem',
    height: '45px',
    width: '30%',
    borderStyle: 'solid',
    borderColor: '#73d798',
    borderWidth: '3px',
    borderRadius: '20px',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
    margin: '0.5rem',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  };

  const buttonHover = { ...button, backgroundColor: '#73d798', color: '#fff' };
  const buttonClick = { ...button, transform: 'scale(0.95)' };

  const [formData, setFormData] = useState({ file: null, customName: '' });
  const [isClicked, setIsClicked] = useState(null);
  const [isHoveredClosed, setIsHoveredClosed] = useState(false);
  const [isHoveredSubmit, setIsHoveredSubmit] = useState(false);

  const handleFileChange = (e) => setFormData({ ...formData, file: e.target.files[0] });
  const handleCustomNameChange = (e) => setFormData({ ...formData, customName: e.target.value });

  const buttonStyle = (buttonType) => {
    if (isClicked === buttonType) return buttonClick;
    if (buttonType === 'close' && isHoveredClosed) return buttonHover;
    if (buttonType === 'submit' && isHoveredSubmit) return buttonHover;
    return button;
  };

  const handleButtonClick = (buttonType) => {
    setIsClicked(buttonType);
    setTimeout(() => {
      setIsClicked(null);
      if (buttonType === 'close') onClose();
    }, 200);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('user_id');

    if (!formData.file || !userId) {
      alert("Please select a CSV file to upload.");
      return;
    }

    const uploadData = new FormData();
    uploadData.append('file', formData.file);
    uploadData.append('user_id', userId);
    if (formData.customName.trim()) uploadData.append('custom_name', formData.customName.trim());

    axios.post('http://localhost:5000/upload', uploadData, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
    })
    .then(response => {
      onCreate({
        upload_id: response.data.upload_id,
        name: formData.customName.trim() || formData.file.name,
        date_created: new Date().toISOString(),
        date_modified: new Date().toISOString()
      });
      onClose();
    })
    .catch(error => {
      console.error("Error uploading file: ", error);
      alert("Failed to upload file.");
    });
  };

  return (
    <div style={popupContainer}>
      <h1 style={{ ...text, ...popupTitle }}>Upload a new VirScan CSV</h1>
      <hr style={line} />
      <form onSubmit={handleSubmit}>
        <div style={inputContainer}>
          <label style={{ ...formLabels, ...text }}>File Name:</label>
          <input
            style={textField}
            type="text"
            placeholder="Optional: rename your file"
            value={formData.customName}
            onChange={handleCustomNameChange}
          />
        </div>
        <div style={inputContainer}>
          <label style={{ ...formLabels, ...text }}>CSV File:</label>
          <input
            style={fileInput}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
          />
        </div>
        <button
          type="submit"
          style={buttonStyle('submit')}
          onMouseEnter={() => setIsHoveredSubmit(true)}
          onMouseLeave={() => setIsHoveredSubmit(false)}
          onClick={() => handleButtonClick('submit')}
        >
          Upload
        </button>
      </form>
      <button
        style={buttonStyle('close')}
        onMouseEnter={() => setIsHoveredClosed(true)}
        onMouseLeave={() => setIsHoveredClosed(false)}
        onClick={() => handleButtonClick('close')}
      >
        Cancel
      </button>
    </div>
  );
}

export default Create;
