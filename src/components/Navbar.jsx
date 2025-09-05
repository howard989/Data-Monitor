import React, { useContext, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Dropdown, Menu, Button } from 'antd';
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
                <Button
                  href="https://web3.48.club"
                  type="default"
                  size="middle"
                >
                  <span>48 Club</span>
                  <RightOutlined className="ml-1 text-xs" />
                </Button>

                <Dropdown
                  placement="bottomRight"
                  trigger={['hover']}
                  menu={{ items: userMenuItems, onClick: onUserMenuClick }}
                  overlayClassName="rounded-md"
                >
                  <Button type="primary" size="middle">
                    {user.username}
                  </Button>
                </Dropdown>
              </>
            ) : (
              <NavLink to="/login">
                <Button type="primary" size="middle">
                  Login
                </Button>
              </NavLink>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <Button
              type="text"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              }
              size="middle"
            />
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
                <Button
                  href="https://web3.48.club"
                  block
                  size="middle"
                >
                  <span>48 Club</span>
                  <RightOutlined className="ml-1 text-xs" />
                </Button>
                <Button
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                  type="primary"
                  block
                  size="middle"
                >
                  Logout
                </Button>
              </div>
            ) : (
              <NavLink to="/login" onClick={() => setMenuOpen(false)}>
                <Button type="primary" block size="middle">
                  Login
                </Button>
              </NavLink>
              )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;