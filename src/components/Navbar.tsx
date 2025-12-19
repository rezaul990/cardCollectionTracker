import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useNavigate, Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  userEmail: string;
  isAdmin: boolean;
}

export default function Navbar({ userEmail, isAdmin }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const managerLinks = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/entry', label: 'Entry' },
    { path: '/executives', label: 'Executives' },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <span className="text-xl font-semibold text-gray-900">Collection Tracker</span>
            <div className="hidden sm:flex space-x-4">
              {isAdmin ? (
                <>
                  <Link
                    to="/admin"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive('/admin') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/branches"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive('/branches') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Branches
                  </Link>
                </>
              ) : (
                managerLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive(link.path) ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500 hidden sm:block">{userEmail}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="sm:hidden pb-3 flex flex-wrap gap-2">
          {isAdmin ? (
            <>
              <Link
                to="/admin"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/admin') ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/branches"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/branches') ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
                }`}
              >
                Branches
              </Link>
            </>
          ) : (
            managerLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive(link.path) ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
                }`}
              >
                {link.label}
              </Link>
            ))
          )}
        </div>
      </div>
    </nav>
  );
}
