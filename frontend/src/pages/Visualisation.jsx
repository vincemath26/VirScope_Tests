import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import FileReader from '../components/FileReader';
import DeleteWarning from '../components/DeleteWarning'; // import at top

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
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);

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
        responseType: 'blob',
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

  const handleDownload = () => {
    if (!graphImageUrl) return;
    const link = document.createElement('a');
    link.href = graphImageUrl;
    link.download = `${selectedGraph}_${uploadId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`http://localhost:5000/upload/${uploadId}`);
      toast.success("Upload deleted successfully!");
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to delete upload: ' + (error.response?.data?.error || error.message));
      console.error(error);
    } finally {
      setShowDeleteWarning(false);
    }
  };

  const graphDescriptions = {
    antigen_map: {
      title: 'Antigen Map',
      description: `
        Please note that the methodology to develop this antigen map was taken from
        Dr. Legana Fingerhut's R code. This antigen map helps visualise the differences
        in reactivity (shown as RPK values) across peptide sequences that were aligned
        to viral proteins using BLAST. We used a moving sum to aggregate the values
        as to highlight the local regions of the polyprotein of the virus. Positive values 
        represent cases which mean patients with Type 1 Diabetes (T1D) and negative values 
        represent controls which mean matched non-T1D individuals. 

        A peak may be an indication of a strong immune response, meaning more antibody 
        recognition of viral protein segments which therefore exposes this viral history 
        and when combined with the polyprotein plot above, showcases viral regions that 
        may be involved in triggering or sustaining autoimmune reaction.
      `.replace(/\n\s+/g, ' ').trim()
    },
    heatmap: {
      title: 'Species Reactivity Heatmap',
      description: `
        This exploratory heatmap helps you visualise a species-level overview of the
        read counts across all the samples provided within your dataset as to allow 
        for a comparison of abundances (represented by rpk values) for the top N species.
      `.replace(/\n\s+/g, ' ').trim()
    },
    barplot: {
      title: 'Species Reactivity Stacked Barplot',
      description: `
        This exploratory barplot is similar to the heatmap exploratory graph in which
        helps you visualise a species-level overview of the read counts across all the
        samples provided within your dataset as to allow for a comparison of "contribution"
        of each top N species across all samples.
      `.replace(/\n\s+/g, ' ').trim()
    },
  };

  return (
    // General div to ensure structure; keep everything
    // straight in the middle.
    <div
      style={{
        paddingTop: '100px',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      {/* Renders the buttons to delete data or go back to the dashboard */}
      <div style={{ width: '100%', maxWidth: '1000px', padding: '0 20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
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

          <button
            onClick={() => setShowDeleteWarning(true)}
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
        
        <DeleteWarning
          open={showDeleteWarning}
          onCancel={() => setShowDeleteWarning(false)}
          onConfirm={handleDelete}
          title="Delete Upload"
          message="Are you sure you want to delete this upload? This action cannot be undone."
        />

        {/* Use File Reader component to read and display csv */}
        <h2>CSV Preview for Upload ID: {uploadId}</h2>
        <FileReader uploadId={uploadId} />

        {/* Renders the graph preset buttons */}
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

        {/* Renders the graph generation and download buttons */}
        {selectedGraph && (
          <form onSubmit={handleSubmit} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
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
            <button
              type="submit"
              style={{
                marginLeft: '10px',
                padding: '6px 12px',
                cursor: 'pointer',
                backgroundColor: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
              }}
            >
              Generate
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!graphImageUrl}
              style={{
                marginLeft: '10px',
                padding: '6px 12px',
                cursor: graphImageUrl ? 'pointer' : 'not-allowed',
                backgroundColor: graphImageUrl ? '#2196f3' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
              }}
            >
              Save PNG
            </button>
          </form>
        )}

        {/* Renders the graph area */}
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

        {/* Renders the graph descriptions */}
        {selectedGraph && graphDescriptions[selectedGraph] && (
          <div 
            style={{ 
              marginTop: '20px',
              marginBottom: '40px',
              width: '100%',
              color: '#555',
              lineHeight: '1.6',
              whiteSpace: 'pre-line',
            }}
          >
            <h3 style={{ marginBottom: '8px', color: '#333' }}>
              {graphDescriptions[selectedGraph].title}
            </h3>
            <p style={{ color: '#555', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
              {graphDescriptions[selectedGraph].description.trim()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Visualisation;
