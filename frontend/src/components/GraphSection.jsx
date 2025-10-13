import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';

import Heatmap from './graphs/Heatmap';
import Barplot from './graphs/Barplot';
import Enterovirus from './graphs/Enterovirus';
import GeneratePDF from './GeneratePDF';

function GraphSection({ uploadId: uploadIdProp }) {
  const backendBaseURL = process.env.REACT_APP_BACKEND_URL;
  const uploadId = uploadIdProp || localStorage.getItem('baseUploadId');

  const [selectedGraph, setSelectedGraph] = useState('');
  const [topN, setTopN] = useState('');
  const [interactiveData, setInteractiveData] = useState(null);
  const [pngData, setPngData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [graphText, setGraphText] = useState('');

  const [graphMode, setGraphMode] = useState('interactive');
  const [customTitle, setCustomTitle] = useState('');
  const [xAxisTitle, setXAxisTitle] = useState('');
  const [yAxisTitle, setYAxisTitle] = useState('');

  const [highlights, setHighlights] = useState([]);
  const [highlightX0, setHighlightX0] = useState('');
  const [highlightX1, setHighlightX1] = useState('');

  const showInput = selectedGraph === 'heatmap' || selectedGraph === 'barplot';

  const handleGraphSelect = (type) => {
    setSelectedGraph(type);
    setInteractiveData(null);
    setPngData(null);
    setTopN('');
    setHighlights([]);
    setHighlightX0('');
    setHighlightX1('');
    setCustomTitle('');
    setXAxisTitle('');
    setYAxisTitle('');
    if (type !== 'generate_pdf') fetchGraphText(type);
  };

  const fetchGraphText = async (graphType) => {
    if (!uploadId) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${backendBaseURL}/upload/${uploadId}/graph_text/${graphType}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setGraphText(response.data.text || '');
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch saved text.');
    }
  };

  const saveGraphText = async () => {
    if (!uploadId) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${backendBaseURL}/upload/${uploadId}/graph_text/${selectedGraph}`,
        { text: graphText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Text saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save text.');
    }
  };

  const fetchGraph = async () => {
    if (!selectedGraph || !uploadId) return;
    if (showInput && (!topN || isNaN(topN) || topN <= 0)) {
      toast.warning('Please enter a valid positive integer.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` }, params: {} };
      if (showInput) config.params.top_n_species = topN || (selectedGraph === 'heatmap' ? 20 : 10);

      const endpoints = {
        heatmap: '/species_counts/json/',
        barplot: '/species_reactivity_stacked_barplot/json/',
        antigen_map: '/antigen_map/json/',
      };

      const params = selectedGraph === 'antigen_map' ? { win_size: 32, step_size: 4 } : config.params;
      const response = await axios.get(`${backendBaseURL}${endpoints[selectedGraph]}${uploadId}`, { ...config, params });

      setInteractiveData(response.data);
      setGraphMode('interactive');
    } catch (err) {
      console.error(err);
      toast.error('Error fetching graph: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchPNGGraph = async () => {
    if (!selectedGraph || !uploadId) return;
    if (showInput && (!topN || isNaN(topN) || topN <= 0)) {
      toast.warning('Please enter a valid positive integer.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { responseType: 'blob', headers: { Authorization: `Bearer ${token}` }, params: {} };
      if (showInput) config.params.top_n_species = topN;

      const endpoints = {
        heatmap: '/species_counts/png/',
        barplot: '/species_reactivity_stacked_barplot/png/',
        antigen_map: '/antigen_map/png/',
      };

      const params = selectedGraph === 'antigen_map' ? { win_size: 32, step_size: 4 } : config.params;
      const response = await axios.get(`${backendBaseURL}${endpoints[selectedGraph]}${uploadId}`, { ...config, params });

      setPngData(URL.createObjectURL(response.data));
      setGraphMode('png');
    } catch (err) {
      console.error(err);
      toast.error('Error fetching PNG graph: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const savePNG = () => {
    if (!pngData) return;
    const link = document.createElement('a');
    link.href = pngData;
    link.download = `${selectedGraph}.png`;
    link.click();
  };

  const handleAddHighlight = () => {
    if (!highlightX0 || !highlightX1) return toast.warning('Please enter both X0 and X1 to add highlight.');
    setHighlights([...highlights, { type: 'rect', x0: parseFloat(highlightX0), x1: parseFloat(highlightX1), y0: 0, y1: 1, fillcolor: 'rgba(255,255,0,0.3)', line: { width: 0 }, xref: 'x', yref: 'paper' }]);
    setHighlightX0('');
    setHighlightX1('');
  };

  const clearHighlights = () => setHighlights([]);

  const renderGraph = () => {
    if (!selectedGraph) return <span style={{ color: '#888' }}>No graph selected.</span>;
    if (selectedGraph === 'generate_pdf') return <GeneratePDF uploadId={uploadId} />;

    if (graphMode === 'png' && pngData) return <img src={pngData} alt="PNG Graph" style={{ maxWidth: '100%' }} />;
    if (!interactiveData) return <span style={{ color: '#888' }}>Click Generate Interactive Graph to load graph.</span>;

    if (selectedGraph === 'heatmap') return <Heatmap interactiveData={interactiveData} customTitle={customTitle} xAxisTitle={xAxisTitle} yAxisTitle={yAxisTitle} />;
    if (selectedGraph === 'barplot') return <Barplot interactiveData={interactiveData} customTitle={customTitle} xAxisTitle={xAxisTitle} yAxisTitle={yAxisTitle} />;
    if (selectedGraph === 'antigen_map') return <Enterovirus interactiveData={interactiveData} customTitle={customTitle} xAxisTitle={xAxisTitle} yAxisTitle={yAxisTitle} highlights={highlights} />;

    return <span style={{ color: '#888' }}>No graph selected.</span>;
  };

  // ----------------- Button labels mapping -----------------
  const buttonLabels = {
    heatmap: 'Heatmap',
    barplot: 'Stacked Barplot',
    antigen_map: 'Antigen Map',
    generate_pdf: 'Generate PDF',
  };

  return (
    <div>
      {/* Graph selection buttons */}
      <div style={{ marginBottom: '15px' }}>
        {Object.keys(buttonLabels).map(type => (
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
            {buttonLabels[type]}
          </button>
        ))}
      </div>

      {/* Options panel */}
      {selectedGraph && selectedGraph !== 'generate_pdf' && (
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {showInput && (
            <label>
              Enter number of top species:&nbsp;
              <input type="number" value={topN} onChange={e => setTopN(e.target.value)} min="1" style={{ width: '80px' }} />
            </label>
          )}
          <label>
            Graph Mode:&nbsp;
            <select value={graphMode} onChange={e => setGraphMode(e.target.value)} style={{ padding: '6px 10px', borderRadius: '4px' }}>
              <option value="interactive">Interactive</option>
              <option value="png">PNG</option>
            </select>
          </label>
          {graphMode === 'interactive' ? (
            <button onClick={fetchGraph} style={{ padding: '6px 12px', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Generate Interactive Graph
            </button>
          ) : (
            <>
              <button onClick={fetchPNGGraph} style={{ padding: '6px 12px', backgroundColor: '#9c27b0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Generate PNG Graph
              </button>
              {pngData && (
                <button onClick={savePNG} style={{ padding: '6px 12px', backgroundColor: '#ff5722', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Save PNG
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Custom titles & highlights */}
      {graphMode === 'interactive' && selectedGraph && selectedGraph !== 'generate_pdf' && (
        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input type="text" placeholder="Custom Title" value={customTitle} onChange={e => setCustomTitle(e.target.value)} style={{ width: '300px', padding: '5px' }} />
          <input type="text" placeholder="X Axis Title" value={xAxisTitle} onChange={e => setXAxisTitle(e.target.value)} style={{ width: '200px', padding: '5px' }} />
          <input type="text" placeholder="Y Axis Title" value={yAxisTitle} onChange={e => setYAxisTitle(e.target.value)} style={{ width: '200px', padding: '5px' }} />

          {selectedGraph === 'antigen_map' && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="number" placeholder="Highlight X0" value={highlightX0} onChange={e => setHighlightX0(e.target.value)} style={{ width: '100px', padding: '5px' }} />
              <input type="number" placeholder="Highlight X1" value={highlightX1} onChange={e => setHighlightX1(e.target.value)} style={{ width: '100px', padding: '5px' }} />
              <button onClick={handleAddHighlight} style={{ backgroundColor: '#ff9800', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Add Highlight</button>
              <button onClick={clearHighlights} style={{ backgroundColor: '#ffc107', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Clear Highlights</button>
            </div>
          )}
        </div>
      )}

      {/* Graph & Text Area */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ border: '2px solid #ddd', borderRadius: '5px', minHeight: '450px', width: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa', marginBottom: '20px' }}>
          {loading ? <span style={{ color: '#4caf50', fontSize: '18px' }}>Loading...</span> : renderGraph()}
        </div>

        {selectedGraph && selectedGraph !== 'generate_pdf' && (
          <>
            <textarea
              value={graphText}
              onChange={e => setGraphText(e.target.value)}
              placeholder="Prepare your text here..."
              style={{ width: '100%', minHeight: '150px', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', resize: 'vertical', marginBottom: '10px' }}
            />
            <button onClick={saveGraphText} disabled={loading} style={{ padding: '6px 12px', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', marginBottom: '20px', cursor: 'pointer' }}>
              Save Text
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default GraphSection;
