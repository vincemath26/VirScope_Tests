import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function CreateBase({ workspaceId, existingFile, onSuccess, onClose }) {
  const [file, setFile] = useState(null);
  const [customName, setCustomName] = useState(existingFile ? existingFile.name : '');
  const [uploading, setUploading] = useState(false);

  const backendURL = process.env.REACT_APP_BACKEND_URL;

  const handleUpload = async () => {
    if (!file) {
      toast.warning('Please select a file to upload.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('No token found. Please log in again.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (customName) formData.append('custom_name', customName);

    try {
      setUploading(true);

      if (existingFile) {
        // Replace existing base file
        await axios.post(
          `${backendURL}/upload/${existingFile.upload_id}/replace`,
          formData,
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
        );
        toast.success('Base file replaced successfully!');
      } else {
        // Upload new base file
        formData.append('workspace_id', workspaceId);
        formData.append('file_type', 'base');

        await axios.post(
          `${backendURL}/upload`,
          formData,
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
        );
        toast.success('Base file uploaded successfully!');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err.response?.data || err);
      toast.error('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '16px',
          width: '500px',
          maxWidth: '90%',
          boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>{existingFile ? 'Replace Base File' : 'Upload Base File'}</h2>

        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ marginTop: '15px', width: '100%' }}
          disabled={uploading}
        />

        <input
          type="text"
          placeholder="Custom file name"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          style={{
            marginTop: '15px',
            width: '100%',
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid #ccc',
            fontSize: '1rem',
          }}
          disabled={uploading}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '25px', gap: '10px' }}>
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
            disabled={uploading || !file}
          >
            {uploading ? (existingFile ? 'Replacing...' : 'Uploading...') : existingFile ? 'Replace' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateBase;
