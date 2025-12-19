import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import Navbar from '../components/Navbar';

interface ExecutivesProps {
  userEmail: string;
  branchId: string;
  branchName: string;
}

interface Executive {
  id: string;
  name: string;
  phone?: string;
}

export default function Executives({ userEmail, branchId, branchName }: ExecutivesProps) {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '' });

  const fetchExecutives = async () => {
    try {
      const q = query(
        collection(db, 'executives'),
        where('branchId', '==', branchId)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        phone: doc.data().phone
      }));
      setExecutives(data);
    } catch (error) {
      console.error('Error fetching executives:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (branchId) fetchExecutives();
  }, [branchId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await addDoc(collection(db, 'executives'), {
        branchId,
        name: name.trim(),
        phone: phone.trim(),
        createdAt: new Date()
      });
      setName('');
      setPhone('');
      setMessage({ type: 'success', text: 'Executive added!' });
      fetchExecutives();
    } catch (error) {
      console.error('Error adding executive:', error);
      setMessage({ type: 'error', text: 'Failed to add executive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (exec: Executive) => {
    setEditingId(exec.id);
    setEditForm({ name: exec.name, phone: exec.phone || '' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', phone: '' });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editForm.name.trim()) return;
    
    try {
      await updateDoc(doc(db, 'executives', id), {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
      });
      setExecutives(executives.map(e => 
        e.id === id ? { ...e, name: editForm.name.trim(), phone: editForm.phone.trim() } : e
      ));
      setEditingId(null);
      setMessage({ type: 'success', text: 'Executive updated!' });
    } catch (error) {
      console.error('Error updating:', error);
      setMessage({ type: 'error', text: 'Failed to update' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this executive? This will NOT delete their collection entries.')) return;
    try {
      await deleteDoc(doc(db, 'executives', id));
      setExecutives(executives.filter(e => e.id !== id));
      setMessage({ type: 'success', text: 'Executive deleted!' });
    } catch (error) {
      console.error('Error deleting:', error);
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userEmail={userEmail} isAdmin={false} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Manage Executives</h1>
          <p className="text-gray-500">{branchName}</p>
        </div>

        {/* Add Form */}
        <form onSubmit={handleAdd} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Executive</h2>
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Executive Name"
              required
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Executive'}
            </button>
          </div>
        </form>

        {/* List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
              ) : executives.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-500">No executives added yet</td></tr>
              ) : (
                executives.map((exec) => {
                  const isEditing = editingId === exec.id;
                  return (
                    <tr key={exec.id} className={isEditing ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        ) : (
                          exec.name
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        ) : (
                          exec.phone || '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleSaveEdit(exec.id)}
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
                              onClick={() => handleEdit(exec)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(exec.id)}
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
