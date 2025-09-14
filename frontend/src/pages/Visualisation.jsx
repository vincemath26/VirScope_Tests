import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import FileReader from '../components/FileReader';
import DeleteWarning from '../components/DeleteWarning';
import { toast } from 'react-toastify';
import Plot from 'react-plotly.js';
import Form from '../components/Form';

function Visualisation() {
  const { uploadId } = useParams();
  const navigate = useNavigate();
  const [selectedGraph, setSelectedGraph] = useState('');
  const [topN, setTopN] = useState('');
  const [interactiveData, setInteractiveData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const backendBaseURL = 'http://localhost:5000';
  const showInput = selectedGraph === 'heatmap' || selectedGraph === 'barplot';
  const [graphText, setGraphText] = useState('')

  // --- Fetch filename for CSV preview title ---
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

  // --- When selecting a graph type ---
  const handleGraphSelect = (type) => {
    setSelectedGraph(type);
    setInteractiveData(null); // Clear previous graph
    setTopN(''); // Reset topN input
    fetchGraphText(type); // fetch existing text for this graph
  };

  // --- Fetch Graph Data ---
  const fetchGraph = async () => {
    if (!selectedGraph) return;

    if (showInput && (!topN || isNaN(topN) || topN <= 0)) {
      toast.warning('Please enter a valid positive integer.');
      return;
    }

    setLoading(true);
    try {
      let response;
      if (selectedGraph === 'heatmap') {
        response = await axios.get(`${backendBaseURL}/species_counts/json/${uploadId}`, {
          params: { top_n_species: topN || 20 },
        });
      } else if (selectedGraph === 'barplot') {
        response = await axios.get(`${backendBaseURL}/species_reactivity_stacked_barplot/json/${uploadId}`, {
          params: { top_n_species: topN || 10 },
        });
      } else if (selectedGraph === 'antigen_map') {
        // Fetch both polyprotein and moving sum data from backend
        response = await axios.get(`${backendBaseURL}/antigen_map/json/${uploadId}`, {
          params: { win_size: 32, step_size: 4 },
        });
      }

      setInteractiveData(response.data);
    } catch (err) {
      console.error(err);
      toast.error('Error fetching graph: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Graph text
  const fetchGraphText = async (graphType) => {
    try {
      const response = await axios.get(`${backendBaseURL}/upload/${uploadId}/graph_text/${graphType}`);
      setGraphText(response.data.text || '');
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch saved text.');
    }
  };

  const saveGraphText = async () => {
    try {
      await axios.post(`${backendBaseURL}/upload/${uploadId}/graph_text/${selectedGraph}`, { text: graphText });
      toast.success('Text saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save text.');
    }
  };

  const [showPdfForm, setShowPdfForm] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfUrl, setPdfUrl] = useState("");

  const handlePdfSubmit = async (payload) => {
    setShowPdfForm(false);
    setPdfStatus("Generating PDF...");
    setPdfProgress(0);

    try {
      const response = await axios.post(
        `${backendBaseURL}/generate_pdf/${uploadId}`,
        payload,
        { responseType: 'blob' } // important!
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
      setPdfProgress(1);
    } catch (err) {
      console.error(err);
      setPdfStatus("Error generating PDF.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchGraph();
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

  const renderPlot = () => {
    if (!interactiveData) return <span style={{ color: '#888' }}>Click Generate to load graph.</span>;

    if (selectedGraph === 'heatmap') {
      if (!interactiveData.values?.length) return <span>No heatmap data available</span>;
      return (
        <Plot
          id="heatmap-plot"
          data={[{
            z: interactiveData.values,
            x: interactiveData.samples,
            y: interactiveData.species,
            type: 'heatmap',
            colorscale: 'Magma',
            hoverongaps: false,
            showscale: true,
            colorbar: { title: 'RPK' },
          }]}
          layout={{
            width: Math.min(1000, window.innerWidth - 40),
            height: Math.max(450, interactiveData.species.length * 30),
            title: 'Species-Level Peptide Expression Heatmap',
            xaxis: { title: 'Sample ID', tickangle: -45 },
            yaxis: { title: 'Species', automargin: true },
            margin: { l: 120, r: 50, t: 80, b: 150 },
            dragmode: 'zoom',
          }}
        />
      );
    }

    if (selectedGraph === 'barplot') {
      if (!interactiveData.values?.length) return <span>No barplot data available</span>;
      return (
        <Plot
          id="barplot-plot"
          data={interactiveData.species.map((species, i) => ({
            x: interactiveData.samples,
            y: interactiveData.values.map(row => row[i]),
            type: 'bar',
            name: species,
          }))}
          layout={{
            barmode: 'stack',
            width: Math.min(1000, window.innerWidth - 40),
            height: 500,
            title: 'Stacked Bar Plot of Species Reactivity',
            xaxis: { title: 'Sample ID', tickangle: -45 },
            yaxis: { title: 'Total RPK', automargin: true },
            margin: { l: 120, r: 50, t: 80, b: 150 },
          }}
        />
      );
    }

    if (selectedGraph === 'antigen_map') {
      if (!interactiveData.moving_sum?.length) return <span>No antigen map data available</span>;

      const proteinColours = {
        "VP4": "#428984", "VP2": "#6FC0EE", "VP3": "#26DED8E6", "VP1": "#C578E6",
        "2A": "#F6F4D6", "2B": "#D9E8E5", "2C": "#EBF5D8", "3AB": "#EDD9BA",
        "3C": "#EBD2D0", "3D": "#FFB19A"
      };

      const polyproteinShapes = interactiveData.ev_domains?.map(domain => ({
        type: 'rect',
        x0: domain.start,
        x1: domain.end,
        y0: 0,
        y1: 0.2, // shrink rectangle height even more
        fillcolor: proteinColours[domain.ev_proteins] || "#CCCCCC",
        line: { color: 'black', width: 0.5 },
        xref: 'x',
        yref: 'y'
      }));

      const polyproteinAnnotations = interactiveData.ev_domains?.map(domain => ({
        x: (domain.start + domain.end) / 2,
        y: 0.1, // center of rectangle
        text: domain.ev_proteins,
        showarrow: false,
        font: { color: 'black', size: 10, family: 'Verdana', bold: true },
        xanchor: 'center',
        yanchor: 'middle',
        xref: 'x',
        yref: 'y'
      }));

      // --- Moving sum traces (bottom track) ---
      const caseTrace = {
        x: interactiveData.window_start,
        y: interactiveData.moving_sum.map(v => Math.max(0, v)),
        type: 'scatter',
        mode: 'lines',
        fill: 'tozeroy',
        fillcolor: '#d73027',
        line: { color: '#d73027' },
        name: 'Case',
        xaxis: 'x2',
        yaxis: 'y2'
      };

      const controlTrace = {
        x: interactiveData.window_start,
        y: interactiveData.moving_sum.map(v => Math.min(0, v)),
        type: 'scatter',
        mode: 'lines',
        fill: 'tozeroy',
        fillcolor: '#4575b4',
        line: { color: '#4575b4' },
        name: 'Control',
        xaxis: 'x2',
        yaxis: 'y2'
      };

      const layout = {
        grid: { rows: 2, columns: 1, row_heights: [0.08, 0.92], shared_xaxes: true, vertical_spacing: 0.02 },
        width: Math.min(1200, window.innerWidth - 40),
        height: 600,
        margin: { l: 120, r: 50, t: 50, b: 100 }, // reduced top margin
        yaxis: { visible: false, range: [0, 1], showticklabels: false }, // top polyprotein track
        yaxis2: { title: 'Moving Sum' }, // bottom antigen map
        xaxis: { showticklabels: false }, // hide top x-axis
        xaxis2: { title: 'Position in sequence (aa)', side: 'bottom' }, // bottom x-axis
        shapes: polyproteinShapes,
        annotations: polyproteinAnnotations,
        showlegend: true
      };

      return <Plot
        id="antigen-map-plot"
        data={[caseTrace, controlTrace]}
        layout={layout}
        config={{ responsive: true }}
      />;
    }

    return <span style={{ color: '#888' }}>No graph selected.</span>;
  };

  return (
    <div style={{ paddingTop: '80px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '1200px', padding: '0 20px' }}>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              backgroundColor: '#4caf50',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Back
          </button>

          <button
            onClick={() => setShowPdfForm(true)}
            style={{
              backgroundColor: '#4caf50',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Generate PDF
          </button>

          <button
            onClick={() => setShowDeleteWarning(true)}
            style={{
              backgroundColor: '#f44336',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>

        {showPdfForm && (
          <Form
            onSubmit={handlePdfSubmit}
            onCancel={() => setShowPdfForm(false)}
          />
        )}

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

        <h2>CSV Preview of {fileName || 'Upload'}</h2>
        <FileReader uploadId={uploadId} />

        {/* Graph Buttons */}
        <div style={{ marginTop: '30px', marginBottom: '10px' }}>
          {['heatmap', 'barplot', 'antigen_map'].map(type => (
            <button
              key={type}
              onClick={() => handleGraphSelect(type)}
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
              {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>

        {/* Generate Form */}
        {selectedGraph && (
          <form
            onSubmit={handleSubmit}
            style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            {showInput && (
              <label>
                Enter number of top species:&nbsp;
                <input
                  type="number"
                  value={topN}
                  onChange={e => setTopN(e.target.value)}
                  min="1"
                  required
                  style={{ width: '80px' }}
                />
              </label>
            )}
            <button
              type="submit"
              style={{
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
          </form>
        )}

        {/* Graph Display */}
        <div
          style={{
            border: '2px solid #ddd',
            borderRadius: '5px',
            minHeight: '450px',
            width: '100%',
            overflow: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#fafafa',
            marginBottom: '20px',
          }}
        >
          {loading ? <span style={{ color: '#4caf50', fontSize: '18px' }}>Loading...</span> : renderPlot()}
        </div>

        {/* Graph Textbox and Save (only show if a graph is selected) */}
        {selectedGraph && (
          <>
            <textarea
              value={graphText}
              onChange={(e) => setGraphText(e.target.value)}
              placeholder="Prepare your text here..."
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ccc',
                resize: 'vertical',
                marginBottom: '10px',
              }}
            />
            <button
              onClick={saveGraphText}
              disabled={loading}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                backgroundColor: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                marginBottom: '20px',
              }}
            >
              Save Text
            </button>
          </>
        )}

        {/* Delete Warning */}
        <DeleteWarning
          open={showDeleteWarning}
          title="Confirm Delete"
          message="Are you sure you want to delete this upload? This action cannot be undone."
          onConfirm={() => {
            handleDelete();
            setShowDeleteWarning(false);
          }}
          onCancel={() => setShowDeleteWarning(false)}
        />

      </div>
    </div>
  );
}

export default Visualisation;
