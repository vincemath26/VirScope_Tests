import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import FileReader from '../components/FileReader';
import DeleteWarning from '../components/DeleteWarning';
import { toast } from 'react-toastify';
import Form from '../components/Form';
import GraphSection from '../components/GraphSection';

function Visualisation() {
  const { uploadId } = useParams();
  const navigate = useNavigate();
  const [fileName, setFileName] = useState('');
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [showPdfForm, setShowPdfForm] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [activeTab, setActiveTab] = useState('csv');

  const backendBaseURL = 'http://localhost:5000';

  useEffect(() => {
    const fetchFilename = async () => {
      try {
        const response = await axios.get(`${backendBaseURL}/upload/${uploadId}`);
        setFileName(response.data.name);
      } catch (err) {
        console.error(err);
      }
    };
    fetchFilename();
  }, [uploadId]);

  const handlePdfSubmit = async (payload) => {
    setShowPdfForm(false);
    setPdfStatus("Generating PDF...");
    try {
      const response = await axios.post(
        `${backendBaseURL}/generate_pdf/${uploadId}`,
        payload,
        { responseType: 'blob' }
      );

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `upload_${uploadId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setPdfStatus("PDF ready!");
    } catch (err) {
      console.error(err);
      setPdfStatus("Error generating PDF.");
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${backendBaseURL}/upload/${uploadId}`);
      toast.success('Upload deleted successfully');
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      toast.error('Error deleting upload: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div style={{ paddingTop: '80px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '1200px', padding: '0 20px' }}>

        {/* Top Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ backgroundColor: '#4caf50', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Back
          </button>

          <button
            onClick={() => {
              // reset status when opening the form
              setPdfStatus('');
              setShowPdfForm(true);
            }}
            style={{
              backgroundColor: '#4caf50',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Generate PDF
          </button>

          <button
            onClick={() => setShowDeleteWarning(true)}
            style={{ backgroundColor: '#f44336', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Delete
          </button>
        </div>

        {/* PDF Form */}
        {showPdfForm && (
          <Form onSubmit={handlePdfSubmit} onCancel={() => setShowPdfForm(false)} />
        )}

        {/* Show Status only after submission */}
        {pdfStatus && (
          <div style={{ marginTop: '10px', marginBottom: '20px' }}>
            <div>Status: {pdfStatus}</div>
            {pdfUrl && (
              <div>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  Download PDF
                </a>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #ccc', marginBottom: '20px' }}>
          <div
            onClick={() => setActiveTab('csv')}
            style={{
              padding: '10px 20px',
              cursor: 'pointer',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              backgroundColor: activeTab === 'csv' ? 'white' : '#f0f0f0',
              border: activeTab === 'csv' ? '2px solid #4caf50' : '2px solid transparent',
              borderBottom: activeTab === 'csv' ? 'none' : '2px solid #ccc',
              fontWeight: activeTab === 'csv' ? 'bold' : 'normal'
            }}
          >
            CSV Preview
          </div>
          <div
            onClick={() => setActiveTab('graph')}
            style={{
              padding: '10px 20px',
              cursor: 'pointer',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              backgroundColor: activeTab === 'graph' ? 'white' : '#f0f0f0',
              border: activeTab === 'graph' ? '2px solid #4caf50' : '2px solid transparent',
              borderBottom: activeTab === 'graph' ? 'none' : '2px solid #ccc',
              fontWeight: activeTab === 'graph' ? 'bold' : 'normal'
            }}
          >
            Graphs
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'csv' && (
          <>
            <h2>CSV Preview of {fileName || 'Upload'}</h2>
            <FileReader uploadId={uploadId} />
          </>
        )}
        {activeTab === 'graph' && <GraphSection uploadId={uploadId} />}

        {/* Delete Warning */}
        <DeleteWarning
          open={showDeleteWarning}
          title="Confirm Delete"
          message="Are you sure you want to delete this upload? This action cannot be undone."
          onConfirm={() => { handleDelete(); setShowDeleteWarning(false); }}
          onCancel={() => setShowDeleteWarning(false)}
        />

      </div>
    </div>
  );
}

export default Visualisation;
