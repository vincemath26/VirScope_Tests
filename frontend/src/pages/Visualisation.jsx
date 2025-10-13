import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import DeleteWarning from '../components/DeleteWarning';
import EditWork from '../components/EditWork.jsx'; // renamed form
import Dataset from '../components/Dataset.jsx';
import { toast } from 'react-toastify';
import GraphSection from '../components/GraphSection';
import Tutorial from '../components/Tutorial';

function Visualisation() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState({ title: '', description: '' });
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [activeTab, setActiveTab] = useState('tutorial');

  const backendBaseURL = process.env.REACT_APP_BACKEND_URL;
  const token = localStorage.getItem('token');
  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

  // Fetch workspace info
  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const response = await axios.get(`${backendBaseURL}/workspace/${workspaceId}`, axiosConfig);
        setWorkspace(response.data);
      } catch (err) {
        if (err.response?.status === 403) {
          toast.error("You do not have permission to access this workspace.");
        } else if (err.response?.status === 404) {
          toast.error("Workspace not found.");
        } else {
          console.error(err);
        }
        navigate('/dashboard');
      }
    };
    fetchWorkspace();
  }, [workspaceId, navigate]);

  // Delete workspace
  const handleDelete = async () => {
    try {
      await axios.delete(`${backendBaseURL}/workspace/${workspaceId}`, axiosConfig);
      toast.success('Workspace deleted successfully');
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error("You do not have permission to delete this workspace.");
      } else {
        console.error(err);
        toast.error('Error deleting workspace: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  // Edit workspace
  const handleEditWorkspace = async (newTitle, newDescription) => {
    try {
      await axios.post(`${backendBaseURL}/workspace/${workspaceId}/rename`, 
        { new_title: newTitle, new_description: newDescription }, axiosConfig
      );
      toast.success('Workspace edited successfully'); // updated toast
      setWorkspace(prev => ({ ...prev, title: newTitle, description: newDescription }));
      setShowEditForm(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to edit workspace: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div style={{ paddingTop: '80px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '1200px', padding: '0 20px' }}>

        {/* Top Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ backgroundColor: '#73D798', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Back
          </button>

          <button
            onClick={() => setShowEditForm(true)}
            style={{ backgroundColor: '#73D798', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Edit
          </button>

          <button
            onClick={() => setShowDeleteWarning(true)}
            style={{ backgroundColor: '#f44336', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Delete
          </button>
        </div>

        {/* Workspace Title and Description */}
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ margin: 0 }}>{workspace.title || 'Untitled Workspace'}</h1>
          <p style={{ margin: '5px 0 0 0', color: '#555' }}>
            {workspace.description || 'No description provided.'}
          </p>
        </div>

        {/* Edit Form */}
        {showEditForm && (
          <EditWork
            onSubmit={handleEditWorkspace}
            onCancel={() => setShowEditForm(false)}
            initialTitle={workspace.title}
            initialDescription={workspace.description}
          />
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #ccc', marginBottom: '20px' }}>
          <div
            onClick={() => setActiveTab('tutorial')}
            style={{
              padding: '10px 20px',
              cursor: 'pointer',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              backgroundColor: activeTab === 'tutorial' ? 'white' : '#f0f0f0',
              border: activeTab === 'tutorial' ? '2px solid #73D798' : '2px solid transparent',
              borderBottom: activeTab === 'tutorial' ? 'none' : '2px solid #ccc',
              fontWeight: activeTab === 'tutorial' ? 'bold' : 'normal'
            }}
          >
            Tutorial
          </div>
          <div
            onClick={() => setActiveTab('csv')}
            style={{
              padding: '10px 20px',
              cursor: 'pointer',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              backgroundColor: activeTab === 'csv' ? 'white' : '#f0f0f0',
              border: activeTab === 'csv' ? '2px solid #73D798' : '2px solid transparent',
              borderBottom: activeTab === 'csv' ? 'none' : '2px solid #ccc',
              fontWeight: activeTab === 'csv' ? 'bold' : 'normal'
            }}
          >
            Datasets
          </div>
          <div
            onClick={() => setActiveTab('graph')}
            style={{
              padding: '10px 20px',
              cursor: 'pointer',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              backgroundColor: activeTab === 'graph' ? 'white' : '#f0f0f0',
              border: activeTab === 'graph' ? '2px solid #73D798' : '2px solid transparent',
              borderBottom: activeTab === 'graph' ? 'none' : '2px solid #ccc',
              fontWeight: activeTab === 'graph' ? 'bold' : 'normal'
            }}
          >
            Graphs
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'tutorial' && <Tutorial />}
        {activeTab === 'csv' && <Dataset />}
        {activeTab === 'graph' && <GraphSection uploadId={null} />}

        {/* Delete Warning */}
        <DeleteWarning
          open={showDeleteWarning}
          title="Confirm Delete"
          message="Are you sure you want to delete this workspace? This action cannot be undone."
          onConfirm={() => { handleDelete(); setShowDeleteWarning(false); }}
          onCancel={() => setShowDeleteWarning(false)}
        />

      </div>
    </div>
  );
}

export default Visualisation;
