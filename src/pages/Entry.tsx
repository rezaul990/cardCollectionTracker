import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import Navbar from '../components/Navbar';

interface EntryProps {
  userEmail: string;
  branchId: string;
  branchName: string;
}

interface Executive {
  id: string;
  name: string;
}

interface EditHistory {
  field: string;
  oldValue: number;
  newValue: number;
  editedAt: Date;
  editedBy: string;
}

interface EntryData {
  docId: string;
  executiveId: string;
  targetQty: number;
  achQty: number;
  cashQty: number;
  remarks: string;
  editHistory?: EditHistory[];
}

export default function Entry({ userEmail, branchId, branchName }: EntryProps) {
  const [date] = useState(new Date().toISOString().split('T')[0]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [entries, setEntries] = useState<Map<string, EntryData>>(new Map());
  const [formData, setFormData] = useState<Map<string, { target: string; ach: string; cash: string; remarks: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState({ type: '', text: '', execId: '' });
  const [showHistory, setShowHistory] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch executives
        const execQuery = query(
          collection(db, 'executives'),
          where('branchId', '==', branchId)
        );
        const execSnapshot = await getDocs(execQuery);
        const execList = execSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
        }));
        setExecutives(execList);

        // Fetch today's entries
        const entryQuery = query(
          collection(db, 'dailyCollections'),
          where('branchId', '==', branchId),
          where('date', '==', date)
        );
        const entrySnapshot = await getDocs(entryQuery);
        const entryMap = new Map<string, EntryData>();
        const formMap = new Map<string, { target: string; ach: string; cash: string; remarks: string }>();

        entrySnapshot.docs.forEach((doc) => {
          const data = doc.data();
          entryMap.set(data.executiveId, {
            docId: doc.id,
            executiveId: data.executiveId,
            targetQty: data.targetQty || 0,
            achQty: data.achQty || 0,
            cashQty: data.cashQty || 0,
            remarks: data.remarks || '',
            editHistory: data.editHistory || [],
          });
          formMap.set(data.executiveId, {
            target: (data.targetQty || 0).toString(),
            ach: (data.achQty || 0).toString(),
            cash: (data.cashQty || 0).toString(),
            remarks: data.remarks || '',
          });
        });

        // Initialize form data for executives without entries
        execList.forEach((exec) => {
          if (!formMap.has(exec.id)) {
            formMap.set(exec.id, { target: '', ach: '', cash: '', remarks: '' });
          }
        });

        setEntries(entryMap);
        setFormData(formMap);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (branchId) fetchData();
  }, [branchId, date]);

  const updateFormField = (execId: string, field: string, value: string) => {
    setFormData((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(execId) || { target: '', ach: '', cash: '', remarks: '' };
      newMap.set(execId, { ...current, [field]: value });
      return newMap;
    });
  };

  const handleSave = async (execId: string) => {
    setSaving(execId);
    setMessage({ type: '', text: '', execId: '' });

    const form = formData.get(execId);
    if (!form) return;

    const newTarget = parseInt(form.target) || 0;
    const newAch = parseInt(form.ach) || 0;
    const newCash = parseInt(form.cash) || 0;

    try {
      const existing = entries.get(execId);
      
      if (existing) {
        // Build edit history for changed fields
        const newHistory: EditHistory[] = [...(existing.editHistory || [])];
        
        if (existing.targetQty !== newTarget && existing.targetQty > 0) {
          newHistory.push({
            field: 'Target',
            oldValue: existing.targetQty,
            newValue: newTarget,
            editedAt: new Date(),
            editedBy: userEmail,
          });
        }
        if (existing.achQty !== newAch && existing.achQty > 0) {
          newHistory.push({
            field: 'ACH',
            oldValue: existing.achQty,
            newValue: newAch,
            editedAt: new Date(),
            editedBy: userEmail,
          });
        }
        if (existing.cashQty !== newCash && existing.cashQty > 0) {
          newHistory.push({
            field: 'Cash',
            oldValue: existing.cashQty,
            newValue: newCash,
            editedAt: new Date(),
            editedBy: userEmail,
          });
        }

        await updateDoc(doc(db, 'dailyCollections', existing.docId), {
          branchId,
          executiveId: execId,
          date,
          targetQty: newTarget,
          achQty: newAch,
          cashQty: newCash,
          remarks: form.remarks,
          editHistory: newHistory,
          lastUpdated: serverTimestamp(),
        });

        // Update local state
        setEntries((prev) => {
          const newMap = new Map(prev);
          newMap.set(execId, {
            ...existing,
            targetQty: newTarget,
            achQty: newAch,
            cashQty: newCash,
            remarks: form.remarks,
            editHistory: newHistory,
          });
          return newMap;
        });
      } else {
        // Create new entry
        const docRef = await addDoc(collection(db, 'dailyCollections'), {
          branchId,
          executiveId: execId,
          date,
          targetQty: newTarget,
          achQty: newAch,
          cashQty: newCash,
          remarks: form.remarks,
          editHistory: [],
          createdAt: serverTimestamp(),
        });
        
        setEntries((prev) => {
          const newMap = new Map(prev);
          newMap.set(execId, {
            docId: docRef.id,
            executiveId: execId,
            targetQty: newTarget,
            achQty: newAch,
            cashQty: newCash,
            remarks: form.remarks,
            editHistory: [],
          });
          return newMap;
        });
      }
      setMessage({ type: 'success', text: 'Saved!', execId });
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'Failed to save', execId });
    } finally {
      setSaving(null);
    }
  };

  const formatDateTime = (date: Date | { toDate: () => Date }) => {
    const d = date instanceof Date ? date : date.toDate();
    return d.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar userEmail={userEmail} isAdmin={false} />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userEmail={userEmail} isAdmin={false} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Daily Entry</h1>
          <p className="text-gray-500">{branchName} • {date}</p>
        </div>

        {executives.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No executives added yet. Go to Executives page to add them first.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {executives.map((exec) => {
              const form = formData.get(exec.id) || { target: '', ach: '', cash: '', remarks: '' };
              const existing = entries.get(exec.id);
              const hasHistory = existing?.editHistory && existing.editHistory.length > 0;
              
              return (
                <div key={exec.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="w-40">
                      <span className="font-medium text-gray-900">{exec.name}</span>
                      {hasHistory && (
                        <button
                          onClick={() => setShowHistory(showHistory === exec.id ? null : exec.id)}
                          className="ml-2 text-xs text-orange-600 hover:text-orange-800"
                        >
                          (edited)
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      placeholder="Target"
                      value={form.target}
                      onChange={(e) => updateFormField(exec.id, 'target', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <input
                      type="number"
                      placeholder="ACH"
                      value={form.ach}
                      onChange={(e) => updateFormField(exec.id, 'ach', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Cash"
                      value={form.cash}
                      onChange={(e) => updateFormField(exec.id, 'cash', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Remarks"
                      value={form.remarks}
                      onChange={(e) => updateFormField(exec.id, 'remarks', e.target.value)}
                      className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      onClick={() => handleSave(exec.id)}
                      disabled={saving === exec.id}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving === exec.id ? '...' : existing ? 'Update' : 'Save'}
                    </button>
                    {message.execId === exec.id && (
                      <span className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {message.text}
                      </span>
                    )}
                  </div>
                  
                  {/* Edit History */}
                  {showHistory === exec.id && hasHistory && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-2">Edit History:</p>
                      <div className="space-y-1">
                        {existing?.editHistory?.map((edit, idx) => (
                          <div key={idx} className="text-xs text-gray-600 bg-orange-50 px-2 py-1 rounded">
                            <span className="font-medium">{edit.field}</span> changed from{' '}
                            <span className="text-red-600 line-through">{edit.oldValue}</span> to{' '}
                            <span className="text-green-600 font-medium">{edit.newValue}</span>
                            <span className="text-gray-400 ml-2">
                              • {formatDateTime(edit.editedAt)} by {edit.editedBy}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
