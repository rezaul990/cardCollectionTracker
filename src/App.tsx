import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Entry from './pages/Entry';
import Executives from './pages/Executives';
import Admin from './pages/Admin';

const ADMIN_EMAIL = 'admin@card.com';

interface BranchInfo {
  branchId: string;
  branchName: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [branchError, setBranchError] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setBranchError(false);
      
      if (currentUser && currentUser.email !== ADMIN_EMAIL) {
        // Fetch branch info for branch manager
        console.log('Logged in user email:', currentUser.email);
        try {
          const q = query(
            collection(db, 'Branches'),
            where('managerEmail', '==', currentUser.email)
          );
          console.log('Querying branches for:', currentUser.email);
          const snapshot = await getDocs(q);
          console.log('Query result - empty?:', snapshot.empty, 'size:', snapshot.size);
          
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            console.log('Found branch:', doc.id, doc.data());
            setBranchInfo({
              branchId: doc.id,
              branchName: doc.data().branchName
            });
          } else {
            console.error('No branch found for user:', currentUser.email);
            setBranchError(true);
            setBranchInfo(null);
          }
        } catch (error) {
          console.error('Error fetching branch:', error);
          setBranchError(true);
          setBranchInfo(null);
        }
      } else {
        setBranchInfo(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const isAdmin = user?.email === ADMIN_EMAIL;

  // Show error if branch manager has no assigned branch
  if (user && !isAdmin && branchError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">No Branch Assigned</h1>
          <p className="text-gray-600 mb-6">
            Your account ({user.email}) is not assigned to any branch. Please contact the administrator.
          </p>
          <button
            onClick={() => signOut(auth)}
            className="px-4 py-2 bg-red-500 text-white font-medium rounded-md hover:bg-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={isAdmin ? '/admin' : '/dashboard'} /> : <Login />}
        />
        <Route
          path="/dashboard"
          element={
            !user ? (
              <Navigate to="/login" />
            ) : isAdmin ? (
              <Navigate to="/admin" />
            ) : branchInfo ? (
              <Dashboard
                userEmail={user.email || ''}
                branchId={branchInfo.branchId}
                branchName={branchInfo.branchName}
              />
            ) : (
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">Loading branch info...</p>
              </div>
            )
          }
        />
        <Route
          path="/entry"
          element={
            !user ? (
              <Navigate to="/login" />
            ) : isAdmin ? (
              <Navigate to="/admin" />
            ) : branchInfo ? (
              <Entry
                userEmail={user.email || ''}
                branchId={branchInfo.branchId}
                branchName={branchInfo.branchName}
              />
            ) : (
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">Loading branch info...</p>
              </div>
            )
          }
        />
        <Route
          path="/executives"
          element={
            !user ? (
              <Navigate to="/login" />
            ) : isAdmin ? (
              <Navigate to="/admin" />
            ) : branchInfo ? (
              <Executives
                userEmail={user.email || ''}
                branchId={branchInfo.branchId}
                branchName={branchInfo.branchName}
              />
            ) : (
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">Loading branch info...</p>
              </div>
            )
          }
        />
        <Route
          path="/admin"
          element={
            !user ? (
              <Navigate to="/login" />
            ) : isAdmin ? (
              <Admin userEmail={user.email || ''} />
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />
        <Route path="*" element={<Navigate to={user ? (isAdmin ? '/admin' : '/dashboard') : '/login'} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
