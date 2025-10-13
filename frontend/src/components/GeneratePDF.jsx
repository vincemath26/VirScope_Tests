import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

function GeneratePDF({ uploadId }) {
  const backendBaseURL = process.env.REACT_APP_BACKEND_URL;

  const [includeHeatmap, setIncludeHeatmap] = useState(false);
  const [heatmapTopN, setHeatmapTopN] = useState(20);
  const [includeBarplot, setIncludeBarplot] = useState(false);
  const [barplotTopN, setBarplotTopN] = useState(10);
  const [includeAntigenMap, setIncludeAntigenMap] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const graphs = [];
    if (includeHeatmap) graphs.push({ type: 'heatmap', topN: parseInt(heatmapTopN) });
    if (includeBarplot) graphs.push({ type: 'barplot', topN: parseInt(barplotTopN) });
    if (includeAntigenMap) graphs.push({ type: 'antigen_map', win_size: 32, step_size: 4 });

    if (graphs.length === 0) {
      return toast.warning("Please select at least one graph to include in the PDF.");
    }

    const payload = { graphs };

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${backendBaseURL}/generate_pdf/${uploadId}`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          responseType: 'blob',
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `upload_${uploadId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF generated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        minHeight: '450px',
        padding: '40px',
        border: '2px solid #ddd',
        borderRadius: '5px',
        backgroundColor: '#fafafa',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '18px',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '25px',
          width: '100%',
          maxWidth: '500px',
          alignItems: 'flex-start',
          textAlign: 'left',
        }}
      >
        <h2 style={{ textAlign: 'center', width: '100%', marginBottom: '10px' }}>Generate PDF</h2>

        <p style={{ fontSize: '16px', color: '#555', marginBottom: '20px' }}>
          Please note that the graphs generated for the PDF will look like the PNG versions as these are better quality for reports.
        </p>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input type="checkbox" checked={includeHeatmap} onChange={(e) => setIncludeHeatmap(e.target.checked)} />
          <label style={{ fontSize: '20px', marginLeft: '10px', width: '200px' }}>Include Heatmap</label>
          {includeHeatmap && (
            <input
              type="number"
              value={heatmapTopN}
              min="1"
              onChange={(e) => setHeatmapTopN(e.target.value)}
              style={{ marginLeft: '10px', width: '80px', fontSize: '16px', padding: '4px' }}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input type="checkbox" checked={includeBarplot} onChange={(e) => setIncludeBarplot(e.target.checked)} />
          <label style={{ fontSize: '20px', marginLeft: '10px', width: '200px' }}>Include Stacked Barplot</label>
          {includeBarplot && (
            <input
              type="number"
              value={barplotTopN}
              min="1"
              onChange={(e) => setBarplotTopN(e.target.value)}
              style={{ marginLeft: '10px', width: '80px', fontSize: '16px', padding: '4px' }}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input type="checkbox" checked={includeAntigenMap} onChange={(e) => setIncludeAntigenMap(e.target.checked)} />
          <label style={{ fontSize: '20px', marginLeft: '10px', width: '200px' }}>Include Antigen Map</label>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 18px',
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '18px',
            alignSelf: 'center',
            marginTop: '10px',
          }}
        >
          {loading ? 'Generating PDF...' : 'Generate PDF'}
        </button>
      </form>
    </div>
  );
}

export default GeneratePDF;
