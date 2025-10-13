import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

function FileReader({ uploadId, onClose }) {
  const backendURL = process.env.REACT_APP_BACKEND_URL;

  const [rows, setRows] = useState([]);
  const [fieldnames, setFieldnames] = useState([]);
  const [start, setStart] = useState(0);
  const [limit] = useState(50);
  const [rowCount, setRowCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRows = async (startIndex = 0) => {
    if (!uploadId) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${backendURL}/uploads/csv-preview/${uploadId}?start=${startIndex}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRows(res.data.rows || []);
      setFieldnames(res.data.fieldnames || []);
      setStart(res.data.start || 0);
      setRowCount(res.data.row_count || 0);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch CSV preview');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(0);
  }, [uploadId]);

  const handleNext = () => {
    if (start + limit < rowCount) fetchRows(start + limit);
  };

  const handlePrevious = () => {
    if (start - limit >= 0) fetchRows(start - limit);
  };

  if (!uploadId) return null;

  return (
    <div
      style={{
        position: 'relative',
        marginTop: '1rem',
        marginBottom: '2rem',
        border: '1px solid #ddd',
        borderRadius: '12px',
        padding: '10px',
        backgroundColor: '#f9f9f9',
        maxHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
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
      )}

      <h3 style={{ marginBottom: '10px' }}>CSV Preview</h3>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '3px solid #73D798',
              borderTop: '3px solid #fff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          ></div>
        </div>
      ) : rows.length === 0 ? (
        <p>No data available</p>
      ) : (
        <>
          {/* Table container with fixed header and visible horizontal scroll */}
          <div
            style={{
              overflow: 'auto',
              flex: 1,
              border: '1px solid #ddd',
              borderRadius: '6px',
              backgroundColor: '#fff',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 'max-content',
              }}
            >
              <thead>
                <tr
                  style={{
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#73D798',
                    color: '#fff',
                    zIndex: 2,
                  }}
                >
                  <th style={{ border: '1px solid #ddd', padding: '6px' }}>#</th>
                  {fieldnames.map((field) => (
                    <th key={field} style={{ border: '1px solid #ddd', padding: '6px' }}>
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={start + idx}
                    style={{
                      backgroundColor: (start + idx) % 2 === 0 ? '#fff' : '#f9f9f9',
                    }}
                  >
                    <td style={{ border: '1px solid #ddd', padding: '6px' }}>{start + idx + 1}</td>
                    {fieldnames.map((field) => (
                      <td key={field} style={{ border: '1px solid #ddd', padding: '6px' }}>
                        {row[field]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '10px',
            }}
          >
            <button
              onClick={handlePrevious}
              disabled={start === 0 || isLoading}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #73D798',
                backgroundColor: start === 0 ? '#eee' : '#73D798',
                color: start === 0 ? '#aaa' : '#fff',
                cursor: start === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>

            <span>
              Showing rows {start + 1} – {Math.min(start + limit, rowCount)} of {rowCount || '...'}
            </span>

            <button
              onClick={handleNext}
              disabled={start + limit >= rowCount || isLoading}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #73D798',
                backgroundColor: start + limit >= rowCount ? '#eee' : '#73D798',
                color: start + limit >= rowCount ? '#aaa' : '#fff',
                cursor: start + limit >= rowCount ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </>
      )}

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

export default FileReader;
