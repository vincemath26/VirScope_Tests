import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function CreateWorkspace({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const backendURL = process.env.REACT_APP_BACKEND_URL;

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.warning('Workspace title is required.');
      return;
    }

    const token = localStorage.getItem('token');

    try {
      setCreating(true);

      const response = await axios.post(
        `${backendURL}/workspace`,
        { title: title.trim(), description: description.trim() },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const workspace = response.data.workspace;

      onCreate(workspace);

      toast.success('Workspace created successfully!');
      setTitle('');
      setDescription('');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(
        'Creation failed: ' + (err.response?.data?.error || err.message)
      );
    } finally {
      setCreating(false);
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
        <h2 style={{ marginTop: 0 }}>New Workspace</h2>

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
          disabled={creating}
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
          disabled={creating}
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
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: '1px solid #ccc',
              backgroundColor: '#f0f0f0',
              cursor: 'pointer',
            }}
            disabled={creating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#4caf50',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
            disabled={creating}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateWorkspace;
