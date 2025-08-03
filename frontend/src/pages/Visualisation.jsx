import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import FileReader from '../components/FileReader';

function Visualisation() {
  const { uploadId } = useParams();
  const navigate = useNavigate();

  const [selectedGraph, setSelectedGraph] = useState('');
  const [topN, setTopN] = useState('');
  const [graphImageUrl, setGraphImageUrl] = useState(null);
  const [prevUrl, setPrevUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const showInput = selectedGraph === 'heatmap' || selectedGraph === 'barplot';
  const backendBaseURL = 'http://localhost:5000';

  useEffect(() => {
    if (prevUrl && prevUrl !== graphImageUrl) {
      URL.revokeObjectURL(prevUrl);
      setPrevUrl(null);
    }
    if (graphImageUrl) {
      setPrevUrl(graphImageUrl);
    }
  }, [graphImageUrl, prevUrl]);

  const fetchGraph = async () => {
    if (!selectedGraph) return;

    let endpoint = '';
    let params = {};

    if (selectedGraph === 'antigen_map') {
      endpoint = `${backendBaseURL}/antigen_map/${uploadId}`;
      params = { win_size: 32, step_size: 4 };
    } else if (selectedGraph === 'heatmap') {
      endpoint = `${backendBaseURL}/species_counts/${uploadId}`;
      params = { top_n_species: topN || 20 };
    } else if (selectedGraph === 'barplot') {
      endpoint = `${backendBaseURL}/species_reactivity_stacked_barplot/${uploadId}`;
      params = { top_n_species: topN || 10 };
    }

    try {
      setLoading(true);
      const response = await axios.get(endpoint, {
        params,
        responseType: 'blob', // important to receive image as blob
      });
      const url = URL.createObjectURL(response.data);
      setGraphImageUrl(url);
    } catch (error) {
      alert('Error fetching graph: ' + (error.response?.data || error.message));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (showInput) {
      if (!topN || isNaN(topN) || topN <= 0) {
        alert('Please enter a valid positive integer.');
        return;
      }
    }

    fetchGraph();
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this upload? This action cannot be undone.")) {
      return;
    }

    try {
      await axios.delete(`http://localhost:5000/upload/${uploadId}`);
      alert("Upload deleted successfully.");
      navigate('/dashboard'); // Redirect after delete
    } catch (error) {
      alert('Failed to delete upload: ' + (error.response?.data?.error || error.message));
      console.error(error);
    }
  };

  return (
    <div
      style={{
        paddingTop: '100px',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: '1000px', padding: '0 20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          {/* Back button */}
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              borderRadius: '4px',
              border: '1px solid #4caf50',
              backgroundColor: '#4caf50',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            ← Back to Dashboard
          </button>

          {/* Delete button */}
          <button
            onClick={handleDelete}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              borderRadius: '4px',
              border: '1px solid #f44336',
              backgroundColor: '#f44336',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            Delete Upload
          </button>
        </div>

        <h2>CSV Preview for Upload ID: {uploadId}</h2>
        <FileReader uploadId={uploadId} />

        {/* Graph selection buttons */}
        <div style={{ marginTop: '30px', marginBottom: '10px' }}>
          {['antigen_map', 'heatmap', 'barplot'].map((type) => (
            <button
              key={type}
              onClick={() => {
                setSelectedGraph(type);
                setGraphImageUrl(null);
              }}
              style={{
                marginRight: '10px',
                backgroundColor: selectedGraph === type ? '#4caf50' : '',
                color: selectedGraph === type ? 'white' : '',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #4caf50',
                cursor: 'pointer',
              }}
            >
              {type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>

        {/* Input form for heatmap and barplot */}
        {selectedGraph && (
          <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
            {showInput && (
              <label>
                Enter number of top species:&nbsp;
                <input
                  type="number"
                  value={topN}
                  onChange={(e) => setTopN(e.target.value)}
                  min="1"
                  required
                  style={{ width: '80px' }}
                />
              </label>
            )}
            <button type="submit" style={{ marginLeft: '10px' }}>
              Generate
            </button>
          </form>
        )}

        <div
          style={{
            border: '2px solid #ddd',
            borderRadius: '5px',
            height: '450px',
            width: '100%',
            overflow: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#fafafa',
            marginBottom: '40px',
          }}
        >
          {loading ? (
            <span style={{ color: '#4caf50', fontSize: '18px' }}>Loading...</span>
          ) : graphImageUrl ? (
            <img
              src={graphImageUrl}
              alt={`${selectedGraph} visualization`}
              style={{ maxHeight: '100%', maxWidth: '100%' }}
            />
          ) : (
            <span style={{ color: '#888' }}>
              {selectedGraph
                ? 'Click Generate to view the graph.'
                : 'Select a graph type to begin.'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default Visualisation;
