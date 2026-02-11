import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
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
  cardCollectionTarget: number;
  salesTarget: number;
  joripTarget: number;
  cardCollectionAch: number;
  salesAch: number;
  joripAch: number;
}

export default function Dashboard({ userEmail, branchId, branchName }: DashboardProps) {
  const [execNames, setExecNames] = useState<Map<string, string>>(new Map());
  const [todayData, setTodayData] = useState<DailyEntry[]>([]);
  const [lowestPerformers, setLowestPerformers] = useState<{ name: string; totalTarget: number; totalAch: number; avgPercent: number }[]>([]);
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
            cardCollectionTarget: d.cardCollectionTarget || 0,
            salesTarget: d.salesTarget || 0,
            joripTarget: d.joripTarget || 0,
            cardCollectionAch: d.cardCollectionAch || 0,
            salesAch: d.salesAch || 0,
            joripAch: d.joripAch || 0,
          };
        });
        setTodayData(data);

        // Fetch last 3 days data for lowest performers
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
        const startStr = threeDaysAgo.toISOString().split('T')[0];

        const last3Query = query(
          collection(db, 'dailyCollections'),
          where('branchId', '==', branchId),
          where('date', '>=', startStr),
          where('date', '<=', today),
          orderBy('date', 'desc')
        );
        const last3Snapshot = await getDocs(last3Query);
        
        // Calculate average per executive
        const execStats = new Map<string, { name: string; totalTarget: number; totalAch: number }>();
        last3Snapshot.docs.forEach(doc => {
          const d = doc.data();
          const key = d.executiveId;
          const totalTarget = (d.cardCollectionTarget || 0) + (d.salesTarget || 0) + (d.joripTarget || 0);
          const totalAch = (d.cardCollectionAch || 0) + (d.salesAch || 0) + (d.joripAch || 0);
          const current = execStats.get(key) || { name: execMap.get(d.executiveId) || 'Unknown', totalTarget: 0, totalAch: 0 };
          execStats.set(key, {
            name: current.name,
            totalTarget: current.totalTarget + totalTarget,
            totalAch: current.totalAch + totalAch,
          });
        });

        const performers = Array.from(execStats.values())
          .filter(e => e.totalTarget > 0)
          .map(e => ({
            ...e,
            avgPercent: (e.totalAch / e.totalTarget) * 100,
          }))
          .sort((a, b) => a.avgPercent - b.avgPercent)
          .slice(0, 2);

        setLowestPerformers(performers);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (branchId) fetchData();
  }, [branchId, today]);

  // Calculate totals
  const totalCardTarget = todayData.reduce((sum, d) => sum + d.cardCollectionTarget, 0);
  const totalSalesTarget = todayData.reduce((sum, d) => sum + d.salesTarget, 0);
  const totalJoripTarget = todayData.reduce((sum, d) => sum + d.joripTarget, 0);
  const totalCardAch = todayData.reduce((sum, d) => sum + d.cardCollectionAch, 0);
  const totalSalesAch = todayData.reduce((sum, d) => sum + d.salesAch, 0);
  const totalJoripAch = todayData.reduce((sum, d) => sum + d.joripAch, 0);
  
  const totalTarget = totalCardTarget + totalSalesTarget + totalJoripTarget;
  const totalAch = totalCardAch + totalSalesAch + totalJoripAch;
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
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-4 mb-8">
          <StatCard title="Card Target" value={totalCardTarget} />
          <StatCard title="Sales Target" value={totalSalesTarget} />
          <StatCard title="Jorip Target" value={totalJoripTarget} />
          <StatCard title="Card Ach" value={totalCardAch} />
          <StatCard title="Sales Ach" value={totalSalesAch} />
          <StatCard title="Jorip Ach" value={totalJoripAch} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 mb-8">
          <StatCard title="Total Target" value={totalTarget} />
          <StatCard title="Total ACH" value={totalAch} />
          <StatCard
            title="Achievement"
            value={`${achievementPercent.toFixed(1)}%`}
            colorClass={getAchievementColor(achievementPercent)}
          />
        </div>

        {/* Lowest 2 Performers - Last 3 Days */}
        {lowestPerformers.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-4 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">📉 Lowest Performers (Last 3 Days Avg)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lowestPerformers.map((p, idx) => (
                <div key={idx} className="bg-red-50 rounded-lg p-4 border border-red-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-sm text-gray-500">Target: {p.totalTarget} | ACH: {p.totalAch}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAchievementBgColor(p.avgPercent)}`}>
                      {p.avgPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Executive-wise Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Today's Executive Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Executive</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Card T</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales T</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jorip T</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Card A</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales A</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jorip A</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">%</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {todayData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 sm:px-6 py-4 text-center text-gray-500">No entries for today</td>
                  </tr>
                ) : (
                  todayData.map((row) => {
                    const rowTotal = row.cardCollectionTarget + row.salesTarget + row.joripTarget;
                    const rowAch = row.cardCollectionAch + row.salesAch + row.joripAch;
                    const rowPercent = rowTotal > 0 ? (rowAch / rowTotal) * 100 : 0;
                    return (
                      <tr key={row.executiveId}>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap font-medium text-gray-900">{row.executiveName}</td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-gray-900">{row.cardCollectionTarget}</td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-gray-900">{row.salesTarget}</td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-gray-900">{row.joripTarget}</td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-gray-900">{row.cardCollectionAch}</td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-gray-900">{row.salesAch}</td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-gray-900">{row.joripAch}</td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAchievementBgColor(rowPercent)}`}>
                            {rowPercent.toFixed(0)}%
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
