import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import Navbar from '../components/Navbar';
import StatCard, { getAchievementColor, getAchievementBgColor } from '../components/StatCard';

interface DashboardProps {
  userEmail: string;
  branchId: string;
  branchName: string;
}



interface DailyEntry {
  executiveId: string;
  executiveName: string;
  targetQty: number;
  achQty: number;
  cashQty: number;
}

export default function Dashboard({ userEmail, branchId, branchName }: DashboardProps) {
  const [execNames, setExecNames] = useState<Map<string, string>>(new Map());
  const [todayData, setTodayData] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch executives
        const execQuery = query(
          collection(db, 'executives'),
          where('branchId', '==', branchId)
        );
        const execSnapshot = await getDocs(execQuery);
        const execMap = new Map<string, string>();
        execSnapshot.docs.forEach(doc => {
          execMap.set(doc.id, doc.data().name);
        });
        setExecNames(execMap);

        // Fetch today's data
        const todayQuery = query(
          collection(db, 'dailyCollections'),
          where('branchId', '==', branchId),
          where('date', '==', today)
        );
        const todaySnapshot = await getDocs(todayQuery);
        const data = todaySnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            executiveId: d.executiveId,
            executiveName: execNames.get(d.executiveId) || execMap.get(d.executiveId) || 'Unknown',
            targetQty: d.targetQty || 0,
            achQty: d.achQty || 0,
            cashQty: d.cashQty || 0,
          };
        });
        setTodayData(data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (branchId) fetchData();
  }, [branchId, today]);

  // Calculate totals
  const totalTarget = todayData.reduce((sum, d) => sum + d.targetQty, 0);
  const totalAch = todayData.reduce((sum, d) => sum + d.achQty, 0);
  const totalCash = todayData.reduce((sum, d) => sum + d.cashQty, 0);
  const balance = totalTarget - totalAch;
  const achievementPercent = totalTarget > 0 ? (totalAch / totalTarget) * 100 : 0;

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
          <h1 className="text-2xl font-bold text-gray-900">{branchName}</h1>
          <p className="text-gray-500">Today: {today}</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard title="Total Target" value={totalTarget} />
          <StatCard title="Total ACH" value={totalAch} />
          <StatCard title="Total Cash" value={totalCash} />
          <StatCard title="Balance" value={balance} colorClass={balance > 0 ? 'text-red-600' : 'text-green-600'} />
          <StatCard
            title="Achievement"
            value={`${achievementPercent.toFixed(1)}%`}
            colorClass={getAchievementColor(achievementPercent)}
          />
        </div>

        {/* Executive-wise Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Today's Executive Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Executive</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ACH</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cash</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Achievement</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {todayData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No entries for today</td>
                  </tr>
                ) : (
                  todayData.map((row) => {
                    const rowBalance = row.targetQty - row.achQty;
                    const rowPercent = row.targetQty > 0 ? (row.achQty / row.targetQty) * 100 : 0;
                    return (
                      <tr key={row.executiveId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.executiveName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.targetQty}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.achQty}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.cashQty}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rowBalance}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAchievementBgColor(rowPercent)}`}>
                            {rowPercent.toFixed(1)}%
                          </span>
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
