import React from 'react';

function DeleteWarning({ open, onCancel, onConfirm, title, message }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          textAlign: 'center',
        }}
      >
        <h2 style={{ marginBottom: '1rem' }}>{title || 'Confirm Delete'}</h2>
        <p style={{ marginBottom: '1.5rem' }}>{message || 'Are you sure you want to delete this?'}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '5px',
              border: '1px solid #888',
              backgroundColor: '#f0f0f0',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '5px',
              border: 'none',
              backgroundColor: '#f44336',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteWarning;
