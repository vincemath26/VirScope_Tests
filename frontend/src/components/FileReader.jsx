import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

const MAX_ROWS = 50; // max rows to parse and display

function FileReader({ uploadId }) {
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const backendURL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    if (!uploadId) {
      setError('No upload ID provided');
      setCsvData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setCsvData([]);
    setHeaders([]);

    const token = localStorage.getItem('token');

    fetch(`${backendURL}/uploads/csv/${uploadId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then((response) => {
        if (!response.ok) {
          if (response.status === 403) throw new Error('You do not have permission to view this file.');
          if (response.status === 404) throw new Error('File not found.');
          throw new Error('Network response not ok');
        }
        return response.text();
      })
      .then((csvText) => {
        const tempData = [];
        let tempHeaders = [];

        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          quoteChar: '"',
          step: (results, parser) => {
            if (results.errors.length) {
              setError('CSV parsing error: ' + results.errors.map(e => e.message).join(', '));
              parser.abort();
              setLoading(false);
              return;
            }
            if (tempHeaders.length === 0) {
              tempHeaders = Object.keys(results.data);
              setHeaders(tempHeaders);
            }
            tempData.push(results.data);

            if (tempData.length >= MAX_ROWS) {
              parser.abort();
              setCsvData(tempData);
              setLoading(false);
            }
          },
          complete: () => {
            if (tempData.length < MAX_ROWS) {
              setCsvData(tempData);
              setLoading(false);
            }
          },
          error: (err) => {
            setError('PapaParse error: ' + err.message);
            setLoading(false);
          },
        });
      })
      .catch((err) => {
        setError('Fetch error: ' + err.message);
        setLoading(false);
      });
  }, [uploadId, backendURL]);

  if (!uploadId) {
    return <div>Please select an upload to preview.</div>;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', marginTop: '80px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <div style={{ color: 'red' }}>Failed to parse CSV file: {error}</div>;
  }

  if (!csvData.length) {
    return <div>No data found in the CSV file.</div>;
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'auto', border: '1px solid #ccc' }}>
        <table border="1" cellPadding="5" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {headers.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {csvData.map((row, i) => (
              <tr key={i}>
                {headers.map((col) => (
                  <td key={col}>{row[col]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {csvData.length === MAX_ROWS && (
          <div style={{ marginTop: '5px', fontSize: '0.85em', color: '#555' }}>
            Showing first {MAX_ROWS} rows.
          </div>
        )}
      </div>
    </div>
  );
}

export default FileReader;
