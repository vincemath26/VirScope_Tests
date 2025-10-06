import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function Create({ onClose, onCreate }) {
  const [file, setFile] = useState(null);
  const [customName, setCustomName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const backendURL = process.env.REACT_APP_BACKEND_URL;

  const handleFileChange = (e) => setFile(e.target.files[0]);
  const handleCustomNameChange = (e) => setCustomName(e.target.value);

  const handleUpload = async () => {
    if (!file) {
      toast.warning('Please select a file to upload.');
      return;
    }

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    if (customName) formData.append('custom_name', customName);

    try {
      setUploading(true);
      setProgress(0);

      const response = await axios.post(`${backendURL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percent);
        },
      });

      const uploadId = response.data.upload_id;

      onCreate({
        upload_id: uploadId,
        name: customName || file.name,
        date_created: new Date().toISOString(),
        date_modified: new Date().toISOString(),
      });

      toast.success('File uploaded successfully!');
      setFile(null);
      setCustomName('');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(
        'Upload failed: ' + (err.response?.data?.error || err.message)
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '16px',
          width: '600px',
          maxWidth: '90%',
          boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>New Upload</h2>

        <label
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            marginTop: '10px',
            backgroundColor: '#4caf50',
            color: 'white',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          {file ? file.name : 'Choose File'}
          <input
            type="file"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>

        <input
          type="text"
          placeholder="Custom name (optional)"
          value={customName}
          onChange={handleCustomNameChange}
          style={{
            marginTop: '15px',
            width: '100%',
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid #ccc',
            fontSize: '0.95rem',
          }}
        />

        {uploading && (
          <div
            style={{
              marginTop: '15px',
              width: '100%',
              backgroundColor: '#eee',
              borderRadius: '5px',
              height: '10px',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: '#4caf50',
                borderRadius: '5px',
                transition: 'width 0.2s',
              }}
            />
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '20px',
            gap: '10px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: '1px solid #ccc',
              backgroundColor: '#f0f0f0',
              cursor: 'pointer',
            }}
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#4caf50',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
            disabled={uploading}
          >
            {uploading ? `Uploading ${progress}%` : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Create;
