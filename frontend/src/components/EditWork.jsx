import React, { useState } from 'react';
import { toast } from 'react-toastify';

function EditWork({ onSubmit, onCancel, initialTitle, initialDescription }) {
  const [title, setTitle] = useState(initialTitle || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.warning('Workspace title is required.');
      return;
    }

    try {
      setSaving(true);
      await onSubmit(title.trim(), description.trim());
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

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
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '16px',
          width: '600px',
          maxWidth: '90%',
          boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Edit Workspace</h2>

        <input
          type="text"
          placeholder="Workspace title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            marginTop: '10px',
            width: '100%',
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid #ccc',
            fontSize: '1rem',
          }}
          disabled={saving}
        />

        <textarea
          placeholder="Workspace description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          style={{
            marginTop: '15px',
            width: '100%',
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid #ccc',
            fontSize: '0.95rem',
            resize: 'vertical',
          }}
          disabled={saving}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '20px',
            gap: '10px',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: '1px solid #ccc',
              backgroundColor: '#f0f0f0',
              cursor: 'pointer',
            }}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#4caf50',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditWork;
