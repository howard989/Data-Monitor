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
          {/* Logo和导航链接 */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center mr-8">
              <h1 className="text-[20px] font-bold tracking-wide text-[#F3BA2F]">Data Monitor</h1>
            </div>
            
            {/* 桌面端导航 */}
            <div className="hidden md:flex md:space-x-6">
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

          {/* 用户信息和登出按钮 */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-[#4A4A4A] text-sm">Welcome, {user.username}</span>
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

          {/* 移动端菜单按钮 */}
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

      {/* 移动端菜单 */}
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

            {/* 用户信息 */}
            <div className="pt-4 pb-3 border-t border-gray-200">
              {user ? (
                <div className="px-3">
                  <div className="text-[#4A4A4A] text-sm mb-3">Welcome, {user.username}</div>
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