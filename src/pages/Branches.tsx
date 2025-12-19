import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import Navbar from '../components/Navbar';

interface BranchesProps {
  userEmail: string;
}

interface Branch {
  id: string;
  branchName: string;
  managerEmail: string;
}

export default function Branches({ userEmail }: BranchesProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchName, setBranchName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ branchName: '', managerEmail: '' });

  const fetchBranches = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'Branches'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        branchName: doc.data().branchName,
        managerEmail: doc.data().managerEmail,
      }));
      setBranches(data);
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim() || !managerEmail.trim()) return;
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await addDoc(collection(db, 'Branches'), {
        branchName: branchName.trim(),
        managerEmail: managerEmail.trim().toLowerCase(),
        createdAt: new Date(),
      });
      setBranchName('');
      setManagerEmail('');
      setMessage({ type: 'success', text: 'Branch created!' });
      fetchBranches();
    } catch (error) {
      console.error('Error adding branch:', error);
      setMessage({ type: 'error', text: 'Failed to create branch' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditingId(branch.id);
    setEditForm({ branchName: branch.branchName, managerEmail: branch.managerEmail });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ branchName: '', managerEmail: '' });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editForm.branchName.trim() || !editForm.managerEmail.trim()) return;

    try {
      await updateDoc(doc(db, 'Branches', id), {
        branchName: editForm.branchName.trim(),
        managerEmail: editForm.managerEmail.trim().toLowerCase(),
      });
      setBranches(branches.map(b =>
        b.id === id ? { ...b, branchName: editForm.branchName.trim(), managerEmail: editForm.managerEmail.trim().toLowerCase() } : b
      ));
      setEditingId(null);
      setMessage({ type: 'success', text: 'Branch updated!' });
    } catch (error) {
      console.error('Error updating:', error);
      setMessage({ type: 'error', text: 'Failed to update' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this branch? This will NOT delete associated executives or collection data.')) return;
    try {
      await deleteDoc(doc(db, 'Branches', id));
      setBranches(branches.filter(b => b.id !== id));
      setMessage({ type: 'success', text: 'Branch deleted!' });
    } catch (error) {
      console.error('Error deleting:', error);
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userEmail={userEmail} isAdmin={true} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Manage Branches</h1>
          <p className="text-gray-500">Create and manage branch locations</p>
        </div>

        {/* Add Form */}
        <form onSubmit={handleAdd} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Branch</h2>
          {message.text && (
            <div className={`mb-4 p-3 rounded-md text-sm ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message.text}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="Branch Name"
              required
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <input
              type="email"
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              placeholder="Manager Email"
              required
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Branch'}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Note: The manager must have a Firebase Auth account with this email to login.
          </p>
        </form>

        {/* List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manager Email</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
              ) : branches.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-500">No branches created yet</td></tr>
              ) : (
                branches.map((branch) => {
                  const isEditing = editingId === branch.id;
                  return (
                    <tr key={branch.id} className={isEditing ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.branchName}
                            onChange={(e) => setEditForm({ ...editForm, branchName: e.target.value })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        ) : (
                          branch.branchName
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {isEditing ? (
                          <input
                            type="email"
                            value={editForm.managerEmail}
                            onChange={(e) => setEditForm({ ...editForm, managerEmail: e.target.value })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        ) : (
                          branch.managerEmail
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleSaveEdit(branch.id)}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-gray-600 hover:text-gray-800 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => handleEdit(branch)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(branch.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
