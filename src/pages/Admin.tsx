import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import Navbar from '../components/Navbar';
import { getAchievementBgColor } from '../components/StatCard';
import { sendTelegramMessage, formatSummaryReport } from '../utils/telegram';

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
  cardCollectionTarget: number;
  salesTarget: number;
  joripTarget: number;
  cardCollectionAch: number;
  salesAch: number;
  joripAch: number;
  remarks: string;
  todaysWorkPlan: string;
  managerWorkPlanRemarks?: string;
  editHistory?: EditHistory[];
}

interface BranchData {
  id: string;
  name: string;
}

interface WorkPlanStatus {
  branchId: string;
  branchName: string;
  remarks: string;
}

export default function Admin({ userEmail }: AdminProps) {
  const [branchList, setBranchList] = useState<BranchData[]>([]);
  const [branches, setBranches] = useState<Map<string, string>>(new Map());
  const [executives, setExecutives] = useState<Map<string, string>>(new Map());
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ target: '', ach: '', cash: '', remarks: '' });
  const [saving, setSaving] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [last3DaysData, setLast3DaysData] = useState<CollectionRow[]>([]);
  const [workPlanStatus, setWorkPlanStatus] = useState<WorkPlanStatus[]>([]);
  const workPlanRef = useRef<HTMLDivElement>(null);

  const handleScreenshot = async () => {
    if (!workPlanRef.current) return;
    try {
      const domtoimage = await import('dom-to-image-more');
      const { saveAs } = await import('file-saver');
      
      const blob = await domtoimage.toBlob(workPlanRef.current, {
        bgcolor: '#ffffff',
        quality: 1,
        scale: 2,
      });
      
      saveAs(blob, `WorkPlan_Report_${new Date().toISOString().split('T')[0]}.png`);
    } catch (error) {
      console.error('Screenshot error:', error);
      alert('Failed to save image');
    }
  };

  const fetchMasterData = async () => {
    try {
      const branchSnapshot = await getDocs(collection(db, 'Branches'));
      const branchMap = new Map<string, string>();
      const branchArr: BranchData[] = [];
      branchSnapshot.docs.forEach(doc => {
        branchMap.set(doc.id, doc.data().branchName);
        branchArr.push({ id: doc.id, name: doc.data().branchName });
      });
      setBranches(branchMap);
      setBranchList(branchArr.sort((a, b) => a.name.localeCompare(b.name)));

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

  // Fetch last 3 days data for lowest performers
  const fetchLast3DaysData = async (branchMap: Map<string, string>, execMap: Map<string, string>) => {
    try {
      const today = new Date();
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 2);
      const startStr = threeDaysAgo.toISOString().split('T')[0];
      const endStr = today.toISOString().split('T')[0];

      const q = query(
        collection(db, 'dailyCollections'),
        where('date', '>=', startStr),
        where('date', '<=', endStr),
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
      setLast3DaysData(data);
    } catch (error) {
      console.error('Error fetching last 3 days data:', error);
    }
  };

  // Fetch today's work plan status
  const fetchWorkPlanStatus = async (branchMap: Map<string, string>) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const q = query(
        collection(db, 'workPlans'),
        where('date', '==', today)
      );
      const snapshot = await getDocs(q);
      const workPlanMap = new Map<string, string>();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        workPlanMap.set(data.branchId, data.remarks || '');
      });

      const statusList: WorkPlanStatus[] = [];
      branchMap.forEach((name, id) => {
        const remarks = workPlanMap.get(id);
        statusList.push({
          branchId: id,
          branchName: name,
          remarks: remarks || '',
        });
      });
      statusList.sort((a, b) => a.branchName.localeCompare(b.branchName));
      setWorkPlanStatus(statusList);
    } catch (error) {
      console.error('Error fetching work plan status:', error);
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
      
      // Fetch all work plans for the date range
      const wpQuery = query(
        collection(db, 'workPlans'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const wpSnapshot = await getDocs(wpQuery);
      const workPlanMap = new Map<string, string>();
      wpSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const key = `${data.branchId}_${data.date}`;
        workPlanMap.set(key, data.remarks || '');
      });

      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        const wpKey = `${d.branchId}_${d.date}`;
        const wpRemarks = workPlanMap.get(wpKey);
        return {
          id: doc.id,
          date: d.date,
          branchId: d.branchId,
          branchName: branchMap.get(d.branchId) || 'Unknown',
          executiveId: d.executiveId,
          executiveName: execMap.get(d.executiveId) || 'Unknown',
          cardCollectionTarget: d.cardCollectionTarget || 0,
          salesTarget: d.salesTarget || 0,
          joripTarget: d.joripTarget || 0,
          cardCollectionAch: d.cardCollectionAch || 0,
          salesAch: d.salesAch || 0,
          joripAch: d.joripAch || 0,
          remarks: d.remarks || '',
          todaysWorkPlan: d.todaysWorkPlan || '',
          managerWorkPlanRemarks: wpRemarks || '',
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
        fetchLast3DaysData(branchMap, execMap);
        fetchWorkPlanStatus(branchMap);
      } else {
        setLoading(false);
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
      target: row.cardCollectionTarget.toString(),
      ach: row.cardCollectionAch.toString(),
      cash: row.cardCollectionTarget.toString(),
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

      const newHistory: EditHistory[] = [...(row.editHistory || [])];
      if (row.cardCollectionTarget !== newTarget) {
        newHistory.push({ field: 'Target', oldValue: row.cardCollectionTarget, newValue: newTarget, editedAt: new Date(), editedBy: userEmail + ' (Admin)' });
      }
      if (row.cardCollectionAch !== newAch) {
        newHistory.push({ field: 'ACH', oldValue: row.cardCollectionAch, newValue: newAch, editedAt: new Date(), editedBy: userEmail + ' (Admin)' });
      }
      if (row.cardCollectionTarget !== newCash) {
        newHistory.push({ field: 'Cash', oldValue: row.cardCollectionTarget, newValue: newCash, editedAt: new Date(), editedBy: userEmail + ' (Admin)' });
      }

      await updateDoc(doc(db, 'dailyCollections', row.id), {
        cardCollectionTarget: newTarget, cardCollectionAch: newAch, cardCollectionTarget: newCash, remarks: editForm.remarks,
        editHistory: newHistory, lastUpdated: serverTimestamp(),
      });

      setCollections(prev => prev.map(c =>
        c.id === row.id ? { ...c, cardCollectionTarget: newTarget, cardCollectionAch: newAch, cardCollectionTarget: newCash, remarks: editForm.remarks, editHistory: newHistory } : c
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
    const exportData = filteredCollections.map(row => {
      const balance = row.cardCollectionTarget - row.cardCollectionAch;
      const achievementPercent = row.cardCollectionTarget > 0 ? (row.cardCollectionAch / row.cardCollectionTarget) * 100 : 0;
      return { date: row.date, branchName: row.branchName, executiveName: row.executiveName, targetQty: row.cardCollectionTarget, achQty: row.cardCollectionAch, cashQty: row.cardCollectionTarget, balance, achievementPercent };
    });
    const branchName = selectedBranch === 'all' ? '' : `_${branchList.find(b => b.id === selectedBranch)?.name || ''}`;
    const filename = startDate === endDate ? `Daily_Collection${branchName}_${startDate}` : `Collection${branchName}_${startDate}_to_${endDate}`;
    exportToExcel(exportData, filename);
  };

  // Get branch summary for today
  const getBranchSummary = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayCollections = collections.filter(c => c.date === today);
    
    return branchList.map(branch => {
      const branchEntries = todayCollections.filter(c => c.branchId === branch.id);
      const totalTarget = branchEntries.reduce((sum, e) => sum + e.cardCollectionTarget, 0);
      const totalAch = branchEntries.reduce((sum, e) => sum + e.cardCollectionAch, 0);
      return {
        branchName: branch.name,
        hasEntry: branchEntries.length > 0,
        totalTarget,
        totalAch,
        executiveCount: branchEntries.length,
      };
    });
  };

  const handleSendTelegram = async () => {
    setSendingTelegram(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const summary = getBranchSummary();
      const message = formatSummaryReport(today, summary);
      const success = await sendTelegramMessage(message);
      if (success) {
        alert('Summary sent to Telegram!');
      } else {
        alert('Failed to send. Check bot token and chat ID.');
      }
    } catch (error) {
      console.error('Telegram error:', error);
      alert('Failed to send to Telegram');
    } finally {
      setSendingTelegram(false);
    }
  };

  const branchSummary = getBranchSummary();
  const enteredCount = branchSummary.filter(b => b.hasEntry).length;
  const notEnteredCount = branchSummary.filter(b => !b.hasEntry).length;

  // Filter collections by selected branch and sort by branch name A-Z
  const filteredCollections = (selectedBranch === 'all' 
    ? collections 
    : collections.filter(c => c.branchId === selectedBranch)
  ).sort((a, b) => a.branchName.localeCompare(b.branchName));

  // Calculate lowest 10 performers based on last 3 days average
  const getLowestPerformers = () => {
    const execStats = new Map<string, { name: string; branch: string; totalTarget: number; totalAch: number; days: number }>();
    
    last3DaysData.forEach(row => {
      const key = row.executiveId;
      const current = execStats.get(key) || { name: row.executiveName, branch: row.branchName, totalTarget: 0, totalAch: 0, days: 0 };
      execStats.set(key, {
        name: row.executiveName,
        branch: row.branchName,
        totalTarget: current.totalTarget + row.cardCollectionTarget,
        totalAch: current.totalAch + row.cardCollectionAch,
        days: current.days + 1,
      });
    });

    const performers = Array.from(execStats.values())
      .filter(e => e.totalTarget > 0)
      .map(e => ({
        ...e,
        avgPercent: (e.totalAch / e.totalTarget) * 100,
      }))
      .sort((a, b) => a.avgPercent - b.avgPercent)
      .slice(0, 10);

    return performers;
  };

  const lowestPerformers = getLowestPerformers();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userEmail={userEmail} isAdmin={true} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500">View, edit, and manage all collection data</p>
        </div>

        {/* Today's Summary Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Today's Entry Status</h2>
              <div className="flex gap-6">
                <div>
                  <span className="text-2xl font-bold text-green-600">{enteredCount}</span>
                  <p className="text-sm text-gray-500">Branches Entered</p>
                </div>
                <div>
                  <span className="text-2xl font-bold text-red-600">{notEnteredCount}</span>
                  <p className="text-sm text-gray-500">Not Entered</p>
                </div>
              </div>
              {notEnteredCount > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-gray-600">Missing: {branchSummary.filter(b => !b.hasEntry).map(b => b.branchName).join(', ')}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleSendTelegram}
              disabled={sendingTelegram}
              className="px-4 py-2 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              <span>📤</span>
              {sendingTelegram ? 'Sending...' : 'Send to Telegram'}
            </button>
          </div>
        </div>

        {/* Work Plan Status Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">📋 Work Plan Status (Today)</h2>
          <div className="flex gap-6 mb-3">
            <div>
              <span className="text-2xl font-bold text-green-600">{workPlanStatus.filter(w => w.remarks).length}</span>
              <p className="text-sm text-gray-500">Submitted</p>
            </div>
            <div>
              <span className="text-2xl font-bold text-red-600">{workPlanStatus.filter(w => !w.remarks).length}</span>
              <p className="text-sm text-gray-500">Not Submitted</p>
            </div>
          </div>
          {workPlanStatus.filter(w => !w.remarks).length > 0 && (
            <div className="mb-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium text-red-600">Not Submitted:</span>{' '}
                {workPlanStatus.filter(w => !w.remarks).map(w => w.branchName).join(', ')}
              </p>
            </div>
          )}
          {workPlanStatus.filter(w => w.remarks).length > 0 && (
            <div>
              <p className="text-sm text-gray-600">
                <span className="font-medium text-green-600">Submitted:</span>{' '}
                {workPlanStatus.filter(w => w.remarks).map(w => w.branchName).join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* Work Plan Report Table */}
        <div ref={workPlanRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-900">📝 Manager Work Plan Report (Today)</h2>
            <button
              onClick={handleScreenshot}
              className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 flex items-center gap-2"
            >
              📷 Screenshot
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Work Plan Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {workPlanStatus.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-500">No data available</td></tr>
                ) : (
                  workPlanStatus.map((wp, idx) => (
                    <tr key={wp.branchId} className={!wp.remarks ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{idx + 1}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{wp.branchName}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{wp.remarks || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lowest 10 Performers - Last 3 Days */}
        {lowestPerformers.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">📉 Lowest 10 Performers (Last 3 Days Avg)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Executive</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Target</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total ACH</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Avg %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lowestPerformers.map((p, idx) => (
                    <tr key={idx} className={idx < 3 ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{idx + 1}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{p.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{p.branch}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{p.totalTarget}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{p.totalAch}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAchievementBgColor(p.avgPercent)}`}>
                          {p.avgPercent.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none min-w-48"
              >
                <option value="all">All Branches</option>
                {branchList.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <button onClick={handleExport} disabled={filteredCollections.length === 0}
              className="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50">
              Download Excel
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exec</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Card T</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales T</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jorip T</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Card A</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales A</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jorip A</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">%</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exec Work Plan</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Evening Report</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manager WP</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={14} className="px-2 sm:px-4 py-4 text-center text-gray-500">Loading...</td></tr>
                ) : filteredCollections.length === 0 ? (
                  <tr><td colSpan={14} className="px-2 sm:px-4 py-4 text-center text-gray-500">No data available</td></tr>
                ) : (
                  filteredCollections.map((row) => {
                    const totalTarget = row.cardCollectionTarget + row.salesTarget + row.joripTarget;
                    const totalAch = row.cardCollectionAch + row.salesAch + row.joripAch;
                    const percent = totalTarget > 0 ? (totalAch / totalTarget) * 100 : 0;
                    const isEditing = editingId === row.id;
                    return (
                      <tr key={row.id} className={isEditing ? 'bg-yellow-50' : ''}>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-gray-900">{row.date}</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-gray-900">{row.branchName}</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-gray-900">{row.executiveName}</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-gray-900">{row.cardCollectionTarget}</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-gray-900">{row.salesTarget}</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-gray-900">{row.joripTarget}</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-gray-900">{row.cardCollectionAch}</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-gray-900">{row.salesAch}</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-gray-900">{row.joripAch}</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAchievementBgColor(percent)}`}>{percent.toFixed(0)}%</span>
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={row.todaysWorkPlan || '-'}>
                          {row.todaysWorkPlan || '-'}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={row.remarks || '-'}>
                          {row.remarks || '-'}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={row.managerWorkPlanRemarks || '-'}>
                          {row.managerWorkPlanRemarks || '-'}
                        </td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-sm">
                          <div className="flex gap-1">
                            <button onClick={() => handleEdit(row)} className="text-blue-600 hover:text-blue-800 text-xs">Edit</button>
                            <button onClick={() => handleDelete(row.id)} className="text-red-600 hover:text-red-800 text-xs">Del</button>
                          </div>
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
        'Date': row.date, 'Branch': row.branchName, 'Executive': row.executiveName,
        'Target': row.targetQty, 'ACH': row.achQty, 'Cash': row.cashQty,
        'Balance': row.balance, 'Achievement %': `${row.achievementPercent.toFixed(1)}%`
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
