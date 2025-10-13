import React, { useState, useEffect } from 'react';
import axios from 'axios';

function CSVPreview({ uploadId }) {
  const [rows, setRows] = useState([]);
  const [fieldnames, setFieldnames] = useState([]);
  const [start, setStart] = useState(0);
  const [limit] = useState(50);
  const [totalRows, setTotalRows] = useState(null);
  const [loading, setLoading] = useState(false);

  const backendBaseURL = process.env.REACT_APP_BACKEND_URL;
  const token = localStorage.getItem('token');
  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

  const fetchRows = async (newStart) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${backendBaseURL}/uploads/csv-preview/${uploadId}?start=${newStart}&limit=${limit}`,
        axiosConfig
      );
      setRows(response.data.rows);
      setFieldnames(response.data.fieldnames || []);
      setStart(response.data.start);
      setTotalRows(response.data.row_count); // row_count is total read in slice
    } catch (err) {
      console.error(err);
      alert('Failed to fetch CSV slice');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uploadId) {
      fetchRows(0);
    }
  }, [uploadId]);

  const handleNext = () => {
    fetchRows(start + limit);
  };

  const handlePrevious = () => {
    fetchRows(Math.max(start - limit, 0));
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <h3>CSV Preview</h3>
      {loading && <p>Loading...</p>}

      {!loading && rows.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
            <thead>
              <tr>
                {fieldnames.map((col) => (
                  <th key={col} style={{ border: '1px solid #ccc', padding: '8px' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  {fieldnames.map((col) => (
                    <td key={col} style={{ border: '1px solid #ccc', padding: '8px' }}>
                      {row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={handlePrevious}
              disabled={start === 0 || loading}
              style={{ padding: '8px 16px', cursor: start === 0 ? 'not-allowed' : 'pointer' }}
            >
              Previous
            </button>

            <span>Showing rows {start + 1} - {start + rows.length}</span>

            <button
              onClick={handleNext}
              disabled={rows.length < limit || loading}
              style={{ padding: '8px 16px', cursor: rows.length < limit ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        </>
      )}

      {!loading && rows.length === 0 && <p>No data to display.</p>}
    </div>
  );
}

export default CSVPreview;
