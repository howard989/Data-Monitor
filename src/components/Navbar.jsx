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

  const userMenuItems = [
    { key: 'logout', label: <span className="text-red-600">logout</span> }
  ];
  const onUserMenuClick = ({ key }) => {
    if (key === 'logout') handleLogout();
  };

  return (
    <nav className="bg-white border-b-4 border-[#FFC800] shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-0">
        <div className="flex justify-between h-16 relative">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <a href="/" className="flex items-center">
                <img 
                  src="/logo-48club.svg" 
                  alt="48 Club" 
                  className="h-4 md:h-5 mr-3"
                />
              </a>
            </div>
            
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[24px] md:text-[26px] text-[#1E1E1E] hover:text-[#FFC800] font-bold tracking-wide transition-colors cursor-pointer">
              Data Center
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                <a
                  href="https://web3.48.club"
                  className="border border-[#FFC801] hover:bg-[#FFC801] hover:text-[#1E1E1E] text-[#1E1E1E] px-4 py-[6px] rounded text-sm transition-all inline-flex items-center"
                >
                  <span>48 Club</span>
                  <RightOutlined className="ml-1 text-xs" />
                </a>

                <Dropdown
                  placement="bottomRight"
                  trigger={['hover']}
                  menu={{ items: userMenuItems, onClick: onUserMenuClick }}
                  overlayClassName="rounded-md"
                >
                  <button className="bg-[#FFC801] hover:brightness-95 text-[#1E1E1E] px-6 py-[6px] rounded text-sm transition-all shadow inline-flex items-center">
                    <span>{user.username}</span>
                  </button>
                </Dropdown>
              </>
            ) : (
              <NavLink 
                to="/login" 
                className="bg-[#FFC801] hover:brightness-95 text-[#1E1E1E] px-6 py-2 rounded text-sm transition-all shadow"
              >
                Login
              </NavLink>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="text-[#1E1E1E] hover:text-black p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        id="mobile-menu"
        className={[
          'md:hidden bg-white transition-all duration-300 ease-out overflow-hidden',
          menuOpen ? 'max-h-[520px] opacity-100 border-t border-[#FFE38A]' : 'max-h-0 opacity-0 border-t border-transparent pointer-events-none'
        ].join(' ')}
      >
        <div className="max-w-[1140px] mx-auto px-2 pt-2 pb-3 space-y-1">

          <div className="pt-4 pb-3 border-t border-gray-200">
            {user ? (
              <div className="px-3">
                <div className="text-[#4A4A4A] text-sm mb-3">Welcome, {user.username}</div>
                <a
                  href="https://web3.48.club"
                  className="w-full mb-2 inline-flex justify-center items-center text-center border-2 border-[#FFC801] hover:bg-[#FFC801] text-[#1E1E1E] px-4 py-2 rounded text-sm transition-all"
                >
                  <span>48 Club</span>
                  <RightOutlined className="ml-1 text-xs" />
                </a>
                <button
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                  className="w-full bg-[#FFC801] hover:brightness-95 text-[#1E1E1E] px-4 py-2 rounded text-sm transition-all shadow"
                >
                  Logout
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="mx-3 block bg-[#FFC801] hover:brightness-95 text-[#1E1E1E] px-4 py-2 rounded text-sm text-center transition-all shadow"
              >
                Login
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;