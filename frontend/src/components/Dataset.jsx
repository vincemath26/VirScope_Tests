import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import CreateBase from './CreateBase';
import FileReader from './FileReader';

function Dataset() {
  const backendURL = process.env.REACT_APP_BACKEND_URL;

  const [baseFile, setBaseFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // Check results state
  const [checkResult, setCheckResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false); // spinner/loading state

  // Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // =========================
  // Button styles
  // =========================
  const button = {
    color: '#000',
    height: '40px',
    borderStyle: 'solid',
    borderColor: '#73D798',
    borderWidth: '3px',
    borderRadius: '20px',
    backgroundColor: '#ffffff',
    margin: '0',
    padding: '0 1rem',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const buttonHover = { ...button, backgroundColor: '#73D798', color: '#fff' };

  // =========================
  // Separate hover states
  // =========================
  const [isHoveredReplace, setIsHoveredReplace] = useState(false);
  const [isHoveredCheck, setIsHoveredCheck] = useState(false);
  const [isHoveredPreview, setIsHoveredPreview] = useState(false);

  const replaceButtonStyle = isHoveredReplace ? buttonHover : button;
  const checkButtonStyle = isHoveredCheck ? buttonHover : button;
  const previewButtonStyle = isHoveredPreview ? buttonHover : button;

  // =========================
  // Fetch base file for workspace
  // =========================
  const fetchBaseFile = async () => {
    const wsData = localStorage.getItem('workspace');
    if (!wsData) {
      toast.error('No workspace selected');
      setIsLoading(false);
      return;
    }
    const workspaceId = JSON.parse(wsData).id;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${backendURL}/uploads?workspace_id=${workspaceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const base = res.data.find((u) => u.file_type === 'base');
      setBaseFile(base || null);

      // Store upload ID in localStorage if exists
      if (base) localStorage.setItem('baseUploadId', base.upload_id);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch uploads');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseFile();
  }, []);

  // =========================
  // Handlers
  // =========================
  const openPopup = () => setIsPopupOpen(true);
  const closePopup = () => setIsPopupOpen(false);

  const handleSuccess = (newUploadId) => {
    if (newUploadId) localStorage.setItem('baseUploadId', newUploadId);
    fetchBaseFile();
    closePopup();
    setCheckResult(null); // reset previous check
  };

  const handleCheck = async () => {
    const uploadId = localStorage.getItem('baseUploadId');
    if (!uploadId) {
      toast.error('No base file found');
      return;
    }

    setIsChecking(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${backendURL}/uploads/${uploadId}/check-columns`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCheckResult(res.data);
      toast.success('Check complete');
    } catch (err) {
      console.error(err);
      toast.error('Failed to check CSV columns');
    } finally {
      setIsChecking(false);
    }
  };

  const handlePreview = () => {
    if (!baseFile) {
      toast.error('No base file to preview');
      return;
    }
    setIsPreviewOpen(true);
  };

  const clearCheckResult = () => setCheckResult(null);

  // =========================
  // Render
  // =========================
  return (
    <div style={{ marginTop: '2rem', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
      <h2 style={{ fontFamily: 'Poppins, sans-serif', color: '#73D798' }}>Base File</h2>
      {isLoading ? (
        <p>Loading...</p>
      ) : baseFile ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 15px',
            border: '1px solid #ddd',
            borderRadius: '12px',
            marginTop: '10px',
            backgroundColor: '#f9f9f9',
          }}
        >
          <span>{baseFile.name}</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={openPopup}
              style={replaceButtonStyle}
              onMouseEnter={() => setIsHoveredReplace(true)}
              onMouseLeave={() => setIsHoveredReplace(false)}
            >
              Replace
            </button>
            <button
              onClick={handleCheck}
              style={checkButtonStyle}
              onMouseEnter={() => setIsHoveredCheck(true)}
              onMouseLeave={() => setIsHoveredCheck(false)}
              disabled={isChecking}
            >
              {isChecking ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span
                    className="spinner"
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #fff',
                      borderTop: '2px solid #73D798',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  ></span>
                  Checking...
                </div>
              ) : (
                'Check'
              )}
            </button>
            <button
              onClick={handlePreview}
              style={previewButtonStyle}
              onMouseEnter={() => setIsHoveredPreview(true)}
              onMouseLeave={() => setIsHoveredPreview(false)}
            >
              Preview
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 15px',
            border: '1px solid #ddd',
            borderRadius: '12px',
            marginTop: '10px',
            backgroundColor: '#f9f9f9',
          }}
        >
          <span>Please upload a base file.</span>
          <button
            onClick={openPopup}
            style={replaceButtonStyle}
            onMouseEnter={() => setIsHoveredReplace(true)}
            onMouseLeave={() => setIsHoveredReplace(false)}
          >
            Upload
          </button>
        </div>
      )}

      {isPopupOpen && (
        <CreateBase
          workspaceId={JSON.parse(localStorage.getItem('workspace')).id}
          existingFile={baseFile}
          onClose={closePopup}
          onSuccess={handleSuccess}
        />
      )}

      {/* =========================
          Check results display
      ========================= */}
      {checkResult && (
        <div
          style={{
            marginTop: '1rem',
            padding: '10px 15px',
            border: '1px solid',
            borderColor:
              checkResult.can_generate_antigen_map && checkResult.can_generate_exploratory
                ? 'green'
                : 'red',
            borderRadius: '12px',
            backgroundColor:
              checkResult.can_generate_antigen_map && checkResult.can_generate_exploratory
                ? '#e6f9ea'
                : '#ffe6e6',
            position: 'relative',
          }}
        >
          {/* Close button */}
          <button
            onClick={clearCheckResult}
            style={{
              position: 'absolute',
              top: '5px',
              right: '10px',
              border: 'none',
              background: 'transparent',
              fontWeight: 'bold',
              fontSize: '16px',
              cursor: 'pointer',
              color: '#888',
            }}
          >
            ×
          </button>

          <p>
            Antigen map can {checkResult.can_generate_antigen_map ? '' : 'NOT '}be generated
            {checkResult.missing_columns_antigen_map.length > 0 && (
              <> because of missing columns: {checkResult.missing_columns_antigen_map.join(', ')}</>
            )}
          </p>
          <p>
            Exploratory graphs can {checkResult.can_generate_exploratory ? '' : 'NOT '}be generated
            {checkResult.missing_columns_exploratory.length > 0 && (
              <> because of missing columns: {checkResult.missing_columns_exploratory.join(', ')}</>
            )}
          </p>
        </div>
      )}

      {/* =========================
          CSV Preview display
      ========================= */}
      {isPreviewOpen && baseFile && (
        <FileReader
          uploadId={baseFile.upload_id}
          backendURL={backendURL}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}

      {/* Spinner animation CSS */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

export default Dataset;
