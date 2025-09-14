// src/components/Form.jsx
import React, { useState } from 'react';
import { toast } from 'react-toastify';

function Form({ onSubmit, onCancel }) {
  const [selectedGraphs, setSelectedGraphs] = useState({
    heatmap: false,
    barplot: false,
    antigen_map: false,
  });

  // Small number input for top N
  const [topNValues, setTopNValues] = useState({
    heatmap: '',
    barplot: '',
  });

  const handleCheckboxChange = (graph) => {
    setSelectedGraphs(prev => ({ ...prev, [graph]: !prev[graph] }));
  };

  const handleTopNChange = (graph, value) => {
    setTopNValues(prev => ({ ...prev, [graph]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const selected = [];
    if (selectedGraphs.heatmap) selected.push({ type: "heatmap", topN: topNValues.heatmap ? Number(topNValues.heatmap) : 5 });
    if (selectedGraphs.barplot) selected.push({ type: "barplot", topN: topNValues.barplot ? Number(topNValues.barplot) : 5 });
    if (selectedGraphs.antigen_map) selected.push({ type: "antigen_map" });

    if (!selected.length) {
      toast.warning('Please select at least one graph.');
      return;
    }

    const payload = { graphs: selected };
    onSubmit(payload);
  };

  return (
    <div style={{ padding: '20px', border: '2px solid #ddd', borderRadius: '5px', backgroundColor: '#fafafa', maxWidth: '600px', margin: '20px auto' }}>
      <h3>Select Graphs for PDF</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {/* Heatmap */}
        <label>
          <input type="checkbox" checked={selectedGraphs.heatmap} onChange={() => handleCheckboxChange('heatmap')} />
          &nbsp;Heatmap
        </label>
        {selectedGraphs.heatmap && (
          <input
            type="number"
            min="1"
            placeholder="Top N species (optional)"
            value={topNValues.heatmap}
            onChange={(e) => handleTopNChange('heatmap', e.target.value)}
            style={{ width: '120px', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        )}

        {/* Stacked Bar Plot */}
        <label>
          <input type="checkbox" checked={selectedGraphs.barplot} onChange={() => handleCheckboxChange('barplot')} />
          &nbsp;Stacked Bar Plot
        </label>
        {selectedGraphs.barplot && (
          <input
            type="number"
            min="1"
            placeholder="Top N species (optional)"
            value={topNValues.barplot}
            onChange={(e) => handleTopNChange('barplot', e.target.value)}
            style={{ width: '120px', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        )}

        {/* Antigen Map */}
        <label>
          <input type="checkbox" checked={selectedGraphs.antigen_map} onChange={() => handleCheckboxChange('antigen_map')} />
          &nbsp;Antigen Map
        </label>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button type="submit" style={{ backgroundColor: '#4caf50', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Generate PDF
          </button>
          <button type="button" onClick={onCancel} style={{ backgroundColor: '#f44336', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default Form;
