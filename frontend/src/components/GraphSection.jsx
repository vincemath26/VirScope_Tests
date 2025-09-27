import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Plot from 'react-plotly.js';
import { toast } from 'react-toastify';

function GraphSection({ uploadId }) {
  const backendBaseURL = 'http://localhost:5000';

  const [selectedGraph, setSelectedGraph] = useState('');
  const [topN, setTopN] = useState('');
  const [interactiveData, setInteractiveData] = useState(null);
  const [pngData, setPngData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [graphText, setGraphText] = useState('');

  // UI mode
  const [graphMode, setGraphMode] = useState('interactive');

  // Highlighting (only for antigen map)
  const [highlights, setHighlights] = useState([]);
  const [highlightX0, setHighlightX0] = useState('');
  const [highlightX1, setHighlightX1] = useState('');

  const buttonStyle = {
    padding: '6px 12px',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const addHighlightStyle = { ...buttonStyle, backgroundColor: '#ff9800' };
  const clearHighlightStyle = { ...buttonStyle, backgroundColor: '#ffc107' };

  // Custom titles and axis labels
  const [customTitle, setCustomTitle] = useState('');
  const [xAxisTitle, setXAxisTitle] = useState('');
  const [yAxisTitle, setYAxisTitle] = useState('');

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
    fetchGraphText(type);
  };

  const fetchGraph = async () => {
    if (!selectedGraph) return;
    if (showInput && (!topN || isNaN(topN) || topN <= 0)) {
      toast.warning('Please enter a valid positive integer.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let response;
      const config = { headers: { Authorization: `Bearer ${token}` }, params: {} };
      if (showInput) config.params.top_n_species = topN || (selectedGraph === 'heatmap' ? 20 : 10);

      if (selectedGraph === 'heatmap') {
        response = await axios.get(`${backendBaseURL}/species_counts/json/${uploadId}`, config);
      } else if (selectedGraph === 'barplot') {
        response = await axios.get(`${backendBaseURL}/species_reactivity_stacked_barplot/json/${uploadId}`, config);
      } else if (selectedGraph === 'antigen_map') {
        response = await axios.get(`${backendBaseURL}/antigen_map/json/${uploadId}`, { ...config, params: { win_size: 32, step_size: 4 } });
      }
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
    if (!selectedGraph) return;
    if (showInput && (!topN || isNaN(topN) || topN <= 0)) {
      toast.warning('Please enter a valid positive integer.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let response;
      const config = { responseType: 'blob', headers: { Authorization: `Bearer ${token}` }, params: {} };
      if (showInput) config.params.top_n_species = topN;

      if (selectedGraph === 'heatmap') {
        response = await axios.get(`${backendBaseURL}/species_counts/png/${uploadId}`, config);
      } else if (selectedGraph === 'barplot') {
        response = await axios.get(`${backendBaseURL}/species_reactivity_stacked_barplot/png/${uploadId}`, config);
      } else if (selectedGraph === 'antigen_map') {
        response = await axios.get(`${backendBaseURL}/antigen_map/png/${uploadId}`, { ...config, params: { win_size: 32, step_size: 4 } });
      }

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

  const fetchGraphText = async (graphType) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${backendBaseURL}/upload/${uploadId}/graph_text/${graphType}`, { headers: { Authorization: `Bearer ${token}` } });
      setGraphText(response.data.text || '');
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch saved text.');
    }
  };

  const saveGraphText = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${backendBaseURL}/upload/${uploadId}/graph_text/${selectedGraph}`, { text: graphText }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Text saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save text.');
    }
  };

  // --- Add Highlight (only for antigen map) ---
  const handleAddHighlight = () => {
    if (!highlightX0 || !highlightX1) return toast.warning('Please enter both X0 and X1 to add highlight.');
    const newHL = { type: 'rect', x0: parseFloat(highlightX0), x1: parseFloat(highlightX1), y0: 0, y1: 1, fillcolor: 'rgba(255,255,0,0.3)', line: { width: 0 }, xref: 'x', yref: 'paper' };
    setHighlights([...highlights, newHL]);
    setHighlightX0('');
    setHighlightX1('');
  };

  const clearHighlights = () => setHighlights([]);

  const renderPlot = () => {
    if (graphMode === 'png' && pngData) return <img src={pngData} alt="PNG Graph" style={{ maxWidth: '100%' }} />;
    if (!interactiveData) return <span style={{ color: '#888' }}>Click Generate Interactive Graph to load graph.</span>;

    const layoutProps = { width: Math.min(1200, window.innerWidth - 40), height: 750, margin: { l: 120, r: 50, t: 100, b: 120 }, annotations: [] };

    if (selectedGraph === 'heatmap') {
      if (!interactiveData.values?.length) return <span>No heatmap data available</span>;
      return <Plot
        id="heatmap-plot"
        data={[{ z: interactiveData.values, x: interactiveData.samples, y: interactiveData.species, type: 'heatmap', colorscale: 'Magma', hoverongaps: false, showscale: true, colorbar: { title: 'RPK' } }]}
        layout={{ ...layoutProps, title: { text: customTitle || undefined, font: { size: 18 } }, xaxis: { title: { text: xAxisTitle || '', font: { size: 16 } }, automargin: true }, yaxis: { title: { text: yAxisTitle || '', font: { size: 16 } }, automargin: true }, height: Math.max(450, interactiveData.species.length * 30) }}
        config={{ responsive: true }}
      />;
    }

    if (selectedGraph === 'barplot') {
      if (!interactiveData.values?.length) return <span>No barplot data available</span>;
      return <Plot
        id="barplot-plot"
        data={interactiveData.species.map((species, i) => ({ x: interactiveData.samples, y: interactiveData.values.map(row => row[i]), type: 'bar', name: species }))}
        layout={{ ...layoutProps, barmode: 'stack', title: { text: customTitle || undefined, font: { size: 18 } }, xaxis: { title: { text: xAxisTitle || '', font: { size: 16 } }, automargin: true }, yaxis: { title: { text: yAxisTitle || '', font: { size: 16 } }, automargin: true }, height: 500 }}
        config={{ responsive: true }}
      />;
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
        y1: 0.2,
        fillcolor: proteinColours[domain.ev_proteins] || "#CCCCCC",
        line: { color: 'black', width: 0.5 },
        xref: 'x',
        yref: 'y'
      }));

      const polyproteinAnnotations = interactiveData.ev_domains?.map(domain => ({
        x: (domain.start + domain.end) / 2,
        y: 0.1,
        text: domain.ev_proteins,
        showarrow: false,
        font: { size: 12, color: 'black', family: 'Arial' },
        xref: 'x',
        yref: 'y',
        align: 'center'
      }));

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

      const mainTitleAnnotation = customTitle
        ? [{ x: 0.5, y: 1.05, xref: 'paper', yref: 'paper', text: customTitle, showarrow: false, font: { size: 18 }, xanchor: 'center', yanchor: 'bottom' }]
        : [];

      const polyproteinHeight = 80;      
      const antigenMapHeight = 500;     
      const totalHeight = polyproteinHeight + antigenMapHeight + 120;

      const layout = {
        ...layoutProps,
        height: totalHeight,
        yaxis: { visible: false, showticklabels: false, showline: false, zeroline: false, domain: [1 - polyproteinHeight / totalHeight, 1] },
        xaxis: { visible: false, matches: 'x2' },
        yaxis2: { title: { text: yAxisTitle || 'Moving Sum', font: { size: 16 } }, automargin: true, domain: [0, 1 - polyproteinHeight / totalHeight] },
        xaxis2: { title: { text: xAxisTitle || 'Position in sequence (aa)', font: { size: 16 } }, side: 'bottom', automargin: true, showline: true, showticklabels: true, anchor: 'y2', domain: [0, 1] },
        shapes: [...polyproteinShapes, ...highlights],
        annotations: [...mainTitleAnnotation, ...polyproteinAnnotations],
        showlegend: true,
      };

      return <Plot id="antigen-map-plot" data={[caseTrace, controlTrace]} layout={layout} config={{ responsive: true }} />;
    }

    return <span style={{ color: '#888' }}>No graph selected.</span>;
  };

  return (
    <div>
      <div style={{ marginBottom: '15px' }}>
        {['heatmap', 'barplot', 'antigen_map'].map(type => (
          <button key={type} onClick={() => handleGraphSelect(type)}
            style={{ marginRight: '10px', backgroundColor: selectedGraph === type ? '#4caf50' : '', color: selectedGraph === type ? 'white' : '', padding: '8px 12px', borderRadius: '4px', border: '1px solid #4caf50', cursor: 'pointer' }}
          >
            {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {selectedGraph && (
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {showInput && (
            <label>
              Enter number of top species:&nbsp;
              <input type="number" value={topN} onChange={e => setTopN(e.target.value)} min="1" required style={{ width: '80px' }} />
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
            <button onClick={fetchGraph} style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRadius: '4px' }}>
              Generate Interactive Graph
            </button>
          ) : (
            <>
              <button onClick={fetchPNGGraph} style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#9c27b0', color: 'white', border: 'none', borderRadius: '4px' }}>
                Generate PNG Graph
              </button>
              {pngData && <button onClick={savePNG} style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#ff5722', color: 'white', border: 'none', borderRadius: '4px' }}>Save PNG</button>}
            </>
          )}
        </div>
      )}

      {graphMode === 'interactive' && selectedGraph && (
        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label>
            Custom Title:&nbsp;
            <input type="text" value={customTitle} onChange={e => setCustomTitle(e.target.value)} style={{ width: '300px', padding: '5px' }} />
          </label>
          <label>
            X Axis Title:&nbsp;
            <input type="text" value={xAxisTitle} onChange={e => setXAxisTitle(e.target.value)} style={{ width: '200px', padding: '5px' }} />
          </label>
          <label>
            Y Axis Title:&nbsp;
            <input type="text" value={yAxisTitle} onChange={e => setYAxisTitle(e.target.value)} style={{ width: '200px', padding: '5px' }} />
          </label>

          {/* Highlight inputs only for antigen map */}
          {selectedGraph === 'antigen_map' && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="number" placeholder="Highlight X0" value={highlightX0} onChange={e => setHighlightX0(e.target.value)} style={{ width: '100px', padding: '5px' }} />
              <input type="number" placeholder="Highlight X1" value={highlightX1} onChange={e => setHighlightX1(e.target.value)} style={{ width: '100px', padding: '5px' }} />
              <button onClick={handleAddHighlight} style={addHighlightStyle} onMouseEnter={e => e.currentTarget.style.opacity = 0.85} onMouseLeave={e => e.currentTarget.style.opacity = 1} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>Add Highlight</button>
              <button onClick={clearHighlights} style={clearHighlightStyle} onMouseEnter={e => e.currentTarget.style.opacity = 0.85} onMouseLeave={e => e.currentTarget.style.opacity = 1} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>Clear Highlights</button>
            </div>
          )}
        </div>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div style={{ border: '2px solid #ddd', borderRadius: '5px', minHeight: '450px', width: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa', marginBottom: '20px' }}>
        {loading ? <span style={{ color: '#4caf50', fontSize: '18px' }}>Loading...</span> : renderPlot()}
      </div>

      {selectedGraph && (
        <>
          <textarea
            value={graphText}
            onChange={e => setGraphText(e.target.value)}
            placeholder="Prepare your text here..."
            style={{
              width: '100%',
              minHeight: '150px',
              padding: '10px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              resize: 'vertical',
              marginBottom: '10px',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={saveGraphText}
            disabled={loading}
            style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', marginBottom: '20px' }}
          >
            Save Text
          </button>
        </>
      )}
    </div>
    </div>
  );
}

export default GraphSection;
