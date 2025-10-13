import React, { useState } from 'react';

function RenameWork({ initialTitle = '', initialDescription = '', onSubmit, onCancel }) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Title cannot be empty');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(title.trim(), description.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          width: '400px',
          maxWidth: '90%',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px'
        }}
      >
        <h2>Rename Workspace</h2>
        <label>
          Title:
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
            required
          />
        </label>
        <label>
          Description:
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
            rows={3}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#ccc', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#73D798', color: 'white', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Renaming...' : 'Rename'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default RenameWork;
