import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import CreateUpload from './CreateUpload';
import CSVPreview from './CSVPreview';

function Dataset() {
  const [uploads, setUploads] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState(null);

  const backendURL = process.env.REACT_APP_BACKEND_URL;

  const fetchUploads = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${backendURL}/uploads`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUploads(response.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch uploads: ' + (err.response?.data?.error || err.message));
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const handleUploadCreate = (newUpload) => {
    setUploads((prev) => [...prev, newUpload]);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Base Dataset</h1>

      {uploads.length === 0 && (
        <div style={{ margin: '20px 0', fontStyle: 'italic' }}>
          You have not uploaded a base file yet.
        </div>
      )}

      <button
        onClick={() => setShowUploadModal(true)}
        style={{
          padding: '10px 20px',
          borderRadius: '12px',
          border: 'none',
          backgroundColor: '#4caf50', // green button like Visualisation.jsx
          color: 'white',
          fontWeight: 'bold',
          cursor: 'pointer',
          marginBottom: '20px',
        }}
      >
        Upload CSV
      </button>

      {uploads.length > 0 && (
        <div>
          <h2>Your Uploads</h2>
          <ul>
            {uploads.map((upload) => (
              <li key={upload.upload_id} style={{ marginBottom: '10px' }}>
                <span style={{ fontWeight: 'bold' }}>{upload.name}</span>
                <button
                  onClick={() => setSelectedUpload(upload)}
                  style={{
                    marginLeft: '10px',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#2196f3',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Preview CSV
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showUploadModal && (
        <CreateUpload
          onClose={() => setShowUploadModal(false)}
          onCreate={handleUploadCreate}
        />
      )}

      {selectedUpload && (
        <CSVPreview
          upload={selectedUpload}
          onClose={() => setSelectedUpload(null)}
        />
      )}
    </div>
  );
}

export default Dataset;
