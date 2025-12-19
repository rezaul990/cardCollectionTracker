import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import Navbar from '../components/Navbar';
import { getAchievementBgColor } from '../components/StatCard';

interface AdminProps {
  userEmail: string;
}

interface EditHistory {
  field: string;
  oldValue: number;
  newValue: number;
  editedAt: Date;
  editedBy: string;
}

interface CollectionRow {
  id: string;
  date: string;
  branchId: string;
  branchName: string;
  executiveId: string;
  executiveName: string;
  targetQty: number;
  achQty: number;
  cashQty: number;
  remarks: string;
  editHistory?: EditHistory[];
}

export default function Admin({ userEmail }: AdminProps) {
  const [branches, setBranches] = useState<Map<string, string>>(new Map());
  const [executives, setExecutives] = useState<Map<string, string>>(new Map());
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ target: '', ach: '', cash: '', remarks: '' });
  const [saving, setSaving] = useState(false);

  const fetchMasterData = async () => {
    try {
      const branchSnapshot = await getDocs(collection(db, 'Branches'));
      const branchMap = new Map<string, string>();
      branchSnapshot.docs.forEach(doc => {
        branchMap.set(doc.id, doc.data().branchName);
      });
      setBranches(branchMap);

      const execSnapshot = await getDocs(collection(db, 'executives'));
      const execMap = new Map<string, string>();
      execSnapshot.docs.forEach(doc => {
        execMap.set(doc.id, doc.data().name);
      });
      setExecutives(execMap);
      return { branchMap, execMap };
    } catch (error) {
      console.error('Error fetching master data:', error);
      return { branchMap: new Map(), execMap: new Map() };
    }
  };

  const fetchCollections = async (branchMap: Map<string, string>, execMap: Map<string, string>) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'dailyCollections'),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          date: d.date,
          branchId: d.branchId,
          branchName: branchMap.get(d.branchId) || 'Unknown',
          executiveId: d.executiveId,
          executiveName: execMap.get(d.executiveId) || 'Unknown',
          targetQty: d.targetQty || 0,
          achQty: d.achQty || 0,
          cashQty: d.cashQty || 0,
          remarks: d.remarks || '',
          editHistory: d.editHistory || [],
        };
      });
      setCollections(data);
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData().then(({ branchMap, execMap }) => {
      if (branchMap.size > 0) {
        fetchCollections(branchMap, execMap);
      }
    });
  }, []);

  useEffect(() => {
    if (branches.size > 0) {
      fetchCollections(branches, executives);
    }
  }, [startDate, endDate]);

  const handleEdit = (row: CollectionRow) => {
    setEditingId(row.id);
    setEditForm({
      target: row.targetQty.toString(),
      ach: row.achQty.toString(),
      cash: row.cashQty.toString(),
      remarks: row.remarks,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ target: '', ach: '', cash: '', remarks: '' });
  };

  const handleSaveEdit = async (row: CollectionRow) => {
    setSaving(true);
    try {
      const newTarget = parseInt(editForm.target) || 0;
      const newAch = parseInt(editForm.ach) || 0;
      const newCash = parseInt(editForm.cash) || 0;

      // Build edit history
      const newHistory: EditHistory[] = [...(row.editHistory || [])];
      
      if (row.targetQty !== newTarget) {
        newHistory.push({
          field: 'Target',
          oldValue: row.targetQty,
          newValue: newTarget,
          editedAt: new Date(),
          editedBy: userEmail + ' (Admin)',
        });
      }
      if (row.achQty !== newAch) {
        newHistory.push({
          field: 'ACH',
          oldValue: row.achQty,
          newValue: newAch,
          editedAt: new Date(),
          editedBy: userEmail + ' (Admin)',
        });
      }
      if (row.cashQty !== newCash) {
        newHistory.push({
          field: 'Cash',
          oldValue: row.cashQty,
          newValue: newCash,
          editedAt: new Date(),
          editedBy: userEmail + ' (Admin)',
        });
      }

      await updateDoc(doc(db, 'dailyCollections', row.id), {
        targetQty: newTarget,
        achQty: newAch,
        cashQty: newCash,
        remarks: editForm.remarks,
        editHistory: newHistory,
        lastUpdated: serverTimestamp(),
      });

      // Update local state
      setCollections(prev => prev.map(c => 
        c.id === row.id 
          ? { ...c, targetQty: newTarget, achQty: newAch, cashQty: newCash, remarks: editForm.remarks, editHistory: newHistory }
          : c
      ));
      setEditingId(null);
    } catch (error) {
      console.error('Error updating:', error);
      alert('Failed to update entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      await deleteDoc(doc(db, 'dailyCollections', id));
      setCollections(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete entry');
    }
  };

  const handleExport = () => {
    const exportData = collections.map(row => {
      const balance = row.targetQty - row.achQty;
      const achievementPercent = row.targetQty > 0 ? (row.achQty / row.targetQty) * 100 : 0;
      return {
        date: row.date,
        branchName: row.branchName,
        executiveName: row.executiveName,
        targetQty: row.targetQty,
        achQty: row.achQty,
        cashQty: row.cashQty,
        balance,
        achievementPercent
      };
    });
    const filename = startDate === endDate ? `Daily_Collection_${startDate}` : `Collection_${startDate}_to_${endDate}`;
    exportToExcel(exportData, filename);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userEmail={userEmail} isAdmin={true} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500">View, edit, and manage all collection data</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              onClick={handleExport}
              disabled={collections.length === 0}
              className="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Download Excel
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Executive</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ACH</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cash</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">%</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-4 text-center text-gray-500">Loading...</td>
                  </tr>
                ) : collections.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-4 text-center text-gray-500">No data available</td>
                  </tr>
                ) : (
                  collections.map((row) => {
                    const balance = row.targetQty - row.achQty;
                    const percent = row.targetQty > 0 ? (row.achQty / row.targetQty) * 100 : 0;
                    const isEditing = editingId === row.id;

                    return (
                      <tr key={row.id} className={isEditing ? 'bg-yellow-50' : ''}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.date}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.branchName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.executiveName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.target}
                              onChange={(e) => setEditForm({ ...editForm, target: e.target.value })}
                              className="w-20 px-2 py-1 border rounded text-sm"
                            />
                          ) : (
                            row.targetQty
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.ach}
                              onChange={(e) => setEditForm({ ...editForm, ach: e.target.value })}
                              className="w-20 px-2 py-1 border rounded text-sm"
                            />
                          ) : (
                            row.achQty
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.cash}
                              onChange={(e) => setEditForm({ ...editForm, cash: e.target.value })}
                              className="w-20 px-2 py-1 border rounded text-sm"
                            />
                          ) : (
                            row.cashQty
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{balance}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAchievementBgColor(percent)}`}>
                            {percent.toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveEdit(row)}
                                disabled={saving}
                                className="text-green-600 hover:text-green-800 font-medium"
                              >
                                {saving ? '...' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="text-gray-600 hover:text-gray-800"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(row)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(row.id)}
                                className="text-red-600 hover:text-red-800"
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
        </div>
      </main>
    </div>
  );
}

function exportToExcel(data: { date: string; branchName: string; executiveName: string; targetQty: number; achQty: number; cashQty: number; balance: number; achievementPercent: number }[], filename: string) {
  import('xlsx').then(XLSX => {
    import('file-saver').then(({ saveAs }) => {
      const worksheetData = data.map(row => ({
        'Date': row.date,
        'Branch': row.branchName,
        'Executive': row.executiveName,
        'Target': row.targetQty,
        'ACH': row.achQty,
        'Cash': row.cashQty,
        'Balance': row.balance,
        'Achievement %': `${row.achievementPercent.toFixed(1)}%`
      }));
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Collections');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${filename}.xlsx`);
    });
  });
}
