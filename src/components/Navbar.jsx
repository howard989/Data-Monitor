import React, { useContext, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Dropdown, Menu } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const [expandedSections, setExpandedSections] = useState({
    core: false,
    fourmeme: false,
    special: false,
    tagAI: false,
    botKiller: false,
    wallet: false,
    other: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b-2 border-[#FFC800] shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-0">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-8">
              <a href="/" className="flex items-center">
                <img 
                  src="/logo-48club.svg" 
                  alt="48 Club" 
                  className="h-5 md:h-6 mr-3"
                />
                <span className="text-[20px] font-bold tracking-wide text-[#F3BA2F]">Data Center</span>
              </a>
            </div>
            
            {/* Desktop navigation */}
            <div className="hidden md:flex md:items-center md:space-x-6">
              {/* <NavLink 
                to="/" 
                className={({ isActive }) =>
                  isActive
                    ? 'text-[#FF5733] inline-flex items-center px-1 pt-1 border-b-2 border-[#FF5733] text-sm font-medium h-full'
                    : 'text-[#4A4A4A] hover:text-[#FF5733] inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300 text-sm font-medium h-full transition-colors'
                }
              >
                48club &lt;&gt; Binance Wallet
              </NavLink> */}
              
              <NavLink 
                to="/sandwich-stats" 
                className={({ isActive }) =>
                  isActive
                    ? 'text-black inline-flex items-center px-1 pt-1 border-b-2 border-[#FFC801] text-[15px] font-semibold h-full'
                    : 'text-[#1E1E1E] hover:text-black inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-[15px] font-medium h-full transition-colors'
                }
              >
                Sandwich Stats
              </NavLink>
            </div>
          </div>

     
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-[#4A4A4A] text-sm">Welcome, {user.username}</span>
                <a
                  href="https://web3.48.club"
                  className="border-2 border-[#FFC801] hover:bg-[#FFC801] hover:text-[#1E1E1E] text-[#1E1E1E] px-4 py-[6px] rounded-sm text-sm transition-all"
                >
                  ← 48 Club
                </a>
                <button
                  onClick={handleLogout}
                  className="bg-[#FFC801] hover:brightness-95 text-[#1E1E1E] px-4 py-2 rounded-sm text-sm transition-all shadow"
                >
                  Logout
                </button>
              </>
            ) : (
              <NavLink 
                to="/login" 
                className="bg-[#FFC801] hover:brightness-95 text-[#1E1E1E] px-4 py-2 rounded-sm text-sm transition-all shadow"
              >
                Login
              </NavLink>
            )}
          </div>

          {/* mobile menu button */}
          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-[#1E1E1E] hover:text-black p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-[#FFE38A]">
          <div className="max-w-[1140px] mx-auto px-2 pt-2 pb-3 space-y-1">
            {/* <NavLink
              to="/"
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                isActive
                  ? 'text-[#FF5733] block px-3 py-2 rounded-md text-base font-medium bg-orange-50'
                  : 'text-[#4A4A4A] hover:text-[#FF5733] hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium'
              }
            >
              48club &lt;&gt; Binance Wallet
            </NavLink> */}
            
            <NavLink
              to="/sandwich-stats"
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                isActive
                  ? 'text-black block px-3 py-2 rounded-md text-base font-bold bg-yellow-50'
                  : 'text-[#1E1E1E] hover:text-black hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium'
              }
            >
              Sandwich Stats
            </NavLink>

        
            <div className="pt-4 pb-3 border-t border-gray-200">
              {user ? (
                <div className="px-3">
                  <div className="text-[#4A4A4A] text-sm mb-3">Welcome, {user.username}</div>
                  <a
                    href="https://web3.48.club"
                    className="w-full mb-2 block text-center border-2 border-[#FFC801] hover:bg-[#FFC801] text-[#1E1E1E] px-4 py-2 rounded-sm text-sm transition-all"
                  >
                    ← 48 Club
                  </a>
                  <button
                    onClick={() => {
                      handleLogout();
                      setMenuOpen(false);
                    }}
                    className="w-full bg-[#FFC801] hover:brightness-95 text-[#1E1E1E] px-4 py-2 rounded-sm text-sm transition-all shadow"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <NavLink
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="mx-3 block bg-[#FFC801] hover:brightness-95 text-[#1E1E1E] px-4 py-2 rounded-sm text-sm text-center transition-all shadow"
                >
                  Login
                </NavLink>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;