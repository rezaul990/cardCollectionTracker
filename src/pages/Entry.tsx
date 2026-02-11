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
import { sendBranchStatusUpdate, isAfter9PM, sendMissingAchReport, sendWorkPlanStatusUpdate } from '../utils/telegram';

interface EntryProps {
  userEmail: string;
  branchId: string;
  branchName: string;
}

interface Executive {
  id: string;
  name: string;
}

interface EntryData {
  docId: string;
  executiveId: string;
  cardCollectionTarget: number;
  salesTarget: number;
  joripTarget: number;
  todaysWorkPlan: string;
  cardCollectionAch: number;
  salesAch: number;
  joripAch: number;
  remarks: string;
}

interface WorkPlanData {
  docId?: string;
  remarks: string;
}

export default function Entry({ userEmail, branchId, branchName }: EntryProps) {
  const [date] = useState(new Date().toISOString().split('T')[0]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [entries, setEntries] = useState<Map<string, EntryData>>(new Map());
  const [formData, setFormData] = useState<Map<string, { 
    cardCollectionTarget: string; 
    salesTarget: string; 
    joripTarget: string; 
    todaysWorkPlan: string;
    cardCollectionAch: string; 
    salesAch: string; 
    joripAch: string; 
    remarks: string 
  }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState({ type: '', text: '', execId: '' });
  
  // Work Plan state
  const [workPlan, setWorkPlan] = useState<WorkPlanData>({ remarks: '' });
  const [savingWorkPlan, setSavingWorkPlan] = useState(false);
  const [workPlanMessage, setWorkPlanMessage] = useState({ type: '', text: '' });

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
        const formMap = new Map<string, { 
          cardCollectionTarget: string; 
          salesTarget: string; 
          joripTarget: string; 
          todaysWorkPlan: string;
          cardCollectionAch: string; 
          salesAch: string; 
          joripAch: string; 
          remarks: string 
        }>();

        entrySnapshot.docs.forEach((doc) => {
          const data = doc.data();
          entryMap.set(data.executiveId, {
            docId: doc.id,
            executiveId: data.executiveId,
            cardCollectionTarget: data.cardCollectionTarget || 0,
            salesTarget: data.salesTarget || 0,
            joripTarget: data.joripTarget || 0,
            todaysWorkPlan: data.todaysWorkPlan || '',
            cardCollectionAch: data.cardCollectionAch || 0,
            salesAch: data.salesAch || 0,
            joripAch: data.joripAch || 0,
            remarks: data.remarks || '',
          });
          formMap.set(data.executiveId, {
            cardCollectionTarget: (data.cardCollectionTarget || 0).toString(),
            salesTarget: (data.salesTarget || 0).toString(),
            joripTarget: (data.joripTarget || 0).toString(),
            todaysWorkPlan: data.todaysWorkPlan || '',
            cardCollectionAch: (data.cardCollectionAch || 0).toString(),
            salesAch: (data.salesAch || 0).toString(),
            joripAch: (data.joripAch || 0).toString(),
            remarks: data.remarks || '',
          });
        });

        // Initialize form data for executives without entries
        execList.forEach((exec) => {
          if (!formMap.has(exec.id)) {
            formMap.set(exec.id, { 
              cardCollectionTarget: '', 
              salesTarget: '', 
              joripTarget: '', 
              todaysWorkPlan: '',
              cardCollectionAch: '', 
              salesAch: '', 
              joripAch: '', 
              remarks: '' 
            });
          }
        });

        setEntries(entryMap);
        setFormData(formMap);

        // Fetch today's work plan
        const workPlanQuery = query(
          collection(db, 'workPlans'),
          where('branchId', '==', branchId),
          where('date', '==', date)
        );
        const workPlanSnapshot = await getDocs(workPlanQuery);
        if (!workPlanSnapshot.empty) {
          const wpDoc = workPlanSnapshot.docs[0];
          const wpData = wpDoc.data();
          setWorkPlan({
            docId: wpDoc.id,
            remarks: wpData.remarks || '',
          });
        }
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
      const current = newMap.get(execId) || { cardCollectionTarget: '', salesTarget: '', joripTarget: '', todaysWorkPlan: '', cardCollectionAch: '', salesAch: '', joripAch: '', remarks: '' };
      newMap.set(execId, { ...current, [field]: value });
      return newMap;
    });
  };

  const handleSave = async (execId: string) => {
    setSaving(execId);
    setMessage({ type: '', text: '', execId: '' });

    const form = formData.get(execId);
    if (!form) return;

    const newCardCollectionTarget = parseInt(form.cardCollectionTarget) || 0;
    const newSalesTarget = parseInt(form.salesTarget) || 0;
    const newJoripTarget = parseInt(form.joripTarget) || 0;
    const newCardCollectionAch = parseInt(form.cardCollectionAch) || 0;
    const newSalesAch = parseInt(form.salesAch) || 0;
    const newJoripAch = parseInt(form.joripAch) || 0;

    try {
      const existing = entries.get(execId);
      
      if (existing) {
        await updateDoc(doc(db, 'dailyCollections', existing.docId), {
          branchId,
          executiveId: execId,
          date,
          cardCollectionTarget: newCardCollectionTarget,
          salesTarget: newSalesTarget,
          joripTarget: newJoripTarget,
          todaysWorkPlan: form.todaysWorkPlan,
          cardCollectionAch: newCardCollectionAch,
          salesAch: newSalesAch,
          joripAch: newJoripAch,
          remarks: form.remarks,
          lastUpdated: serverTimestamp(),
        });

        setEntries((prev) => {
          const newMap = new Map(prev);
          newMap.set(execId, {
            ...existing,
            cardCollectionTarget: newCardCollectionTarget,
            salesTarget: newSalesTarget,
            joripTarget: newJoripTarget,
            todaysWorkPlan: form.todaysWorkPlan,
            cardCollectionAch: newCardCollectionAch,
            salesAch: newSalesAch,
            joripAch: newJoripAch,
            remarks: form.remarks,
          });
          return newMap;
        });
      } else {
        const docRef = await addDoc(collection(db, 'dailyCollections'), {
          branchId,
          executiveId: execId,
          date,
          cardCollectionTarget: newCardCollectionTarget,
          salesTarget: newSalesTarget,
          joripTarget: newJoripTarget,
          todaysWorkPlan: form.todaysWorkPlan,
          cardCollectionAch: newCardCollectionAch,
          salesAch: newSalesAch,
          joripAch: newJoripAch,
          remarks: form.remarks,
          createdAt: serverTimestamp(),
        });
        
        setEntries((prev) => {
          const newMap = new Map(prev);
          newMap.set(execId, {
            docId: docRef.id,
            executiveId: execId,
            cardCollectionTarget: newCardCollectionTarget,
            salesTarget: newSalesTarget,
            joripTarget: newJoripTarget,
            todaysWorkPlan: form.todaysWorkPlan,
            cardCollectionAch: newCardCollectionAch,
            salesAch: newSalesAch,
            joripAch: newJoripAch,
            remarks: form.remarks,
          });
          return newMap;
        });
      }

      sendBranchStatusUpdate(date);

      if (isAfter9PM() && (newCardCollectionAch > 0 || newSalesAch > 0 || newJoripAch > 0)) {
        sendMissingAchReport(date);
      }

      setMessage({ type: 'success', text: 'Saved!', execId });
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'Failed to save', execId });
    } finally {
      setSaving(null);
    }
  };

  const handleSaveWorkPlan = async () => {
    setSavingWorkPlan(true);
    setWorkPlanMessage({ type: '', text: '' });

    try {
      if (workPlan.docId) {
        await updateDoc(doc(db, 'workPlans', workPlan.docId), {
          remarks: workPlan.remarks,
          lastUpdated: serverTimestamp(),
        });
      } else {
        const docRef = await addDoc(collection(db, 'workPlans'), {
          branchId,
          date,
          remarks: workPlan.remarks,
          createdAt: serverTimestamp(),
        });
        setWorkPlan(prev => ({ ...prev, docId: docRef.id }));
      }

      sendWorkPlanStatusUpdate(date);

      setWorkPlanMessage({ type: 'success', text: 'Work Plan saved!' });
    } catch (error) {
      console.error('Error saving work plan:', error);
      setWorkPlanMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSavingWorkPlan(false);
    }
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
          <div className="space-y-6">
            {/* Morning Entry Section */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">🌅 Morning Entry</h2>
              <div className="space-y-3">
                {executives.map((exec) => {
                  const form = formData.get(exec.id) || { cardCollectionTarget: '', salesTarget: '', joripTarget: '', todaysWorkPlan: '', cardCollectionAch: '', salesAch: '', joripAch: '', remarks: '' };
                  
                  return (
                    <div key={`morning-${exec.id}`} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
                      <div className="mb-3">
                        <span className="font-medium text-gray-900 text-sm sm:text-base">{exec.name}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                        <input
                          type="number"
                          placeholder="Card"
                          value={form.cardCollectionTarget}
                          onChange={(e) => updateFormField(exec.id, 'cardCollectionTarget', e.target.value)}
                          className="px-2 py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Sales"
                          value={form.salesTarget}
                          onChange={(e) => updateFormField(exec.id, 'salesTarget', e.target.value)}
                          className="px-2 py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Jorip"
                          value={form.joripTarget}
                          onChange={(e) => updateFormField(exec.id, 'joripTarget', e.target.value)}
                          className="px-2 py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Plan"
                          value={form.todaysWorkPlan}
                          onChange={(e) => updateFormField(exec.id, 'todaysWorkPlan', e.target.value)}
                          className="col-span-2 sm:col-span-1 px-2 py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(exec.id)}
                          disabled={saving === exec.id}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving === exec.id ? '...' : 'Save'}
                        </button>
                        {message.execId === exec.id && (
                          <span className={`text-xs sm:text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {message.text}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Evening Entry Section */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">🌆 Evening Entry</h2>
              <div className="space-y-3">
                {executives.map((exec) => {
                  const form = formData.get(exec.id) || { cardCollectionTarget: '', salesTarget: '', joripTarget: '', todaysWorkPlan: '', cardCollectionAch: '', salesAch: '', joripAch: '', remarks: '' };
                  
                  return (
                    <div key={`evening-${exec.id}`} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
                      <div className="mb-3">
                        <span className="font-medium text-gray-900 text-sm sm:text-base">{exec.name}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                        <input
                          type="number"
                          placeholder="Card"
                          value={form.cardCollectionAch}
                          onChange={(e) => updateFormField(exec.id, 'cardCollectionAch', e.target.value)}
                          className="px-2 py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-green-500 outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Sales"
                          value={form.salesAch}
                          onChange={(e) => updateFormField(exec.id, 'salesAch', e.target.value)}
                          className="px-2 py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-green-500 outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Jorip"
                          value={form.joripAch}
                          onChange={(e) => updateFormField(exec.id, 'joripAch', e.target.value)}
                          className="px-2 py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-green-500 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Report"
                          value={form.remarks}
                          onChange={(e) => updateFormField(exec.id, 'remarks', e.target.value)}
                          className="col-span-2 sm:col-span-1 px-2 py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-green-500 outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(exec.id)}
                          disabled={saving === exec.id}
                          className="flex-1 px-3 py-2 bg-green-600 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                          {saving === exec.id ? '...' : 'Save'}
                        </button>
                        {message.execId === exec.id && (
                          <span className={`text-xs sm:text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {message.text}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Manager Work Plan Submission Section */}
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Manager Work Plan Submission</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Plan Details
                </label>
                <textarea
                  value={workPlan.remarks}
                  onChange={(e) => setWorkPlan(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Enter work plan details here..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSaveWorkPlan}
                  disabled={savingWorkPlan}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {savingWorkPlan ? 'Saving...' : workPlan.docId ? 'Update Work Plan' : 'Save Work Plan'}
                </button>
                {workPlanMessage.text && (
                  <span className={`text-sm ${workPlanMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {workPlanMessage.text}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
