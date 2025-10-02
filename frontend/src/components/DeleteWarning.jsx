import React from 'react';

export default function DeleteWarning({ open, onConfirm, onCancel, title, message }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '16px',
          width: '450px',   // bigger popup
          maxWidth: '90%',
          boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '15px' }}>{title}</h2>
        <p style={{ marginBottom: '25px' }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: '1px solid #ccc',
              backgroundColor: '#f0f0f0',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#f44336',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
