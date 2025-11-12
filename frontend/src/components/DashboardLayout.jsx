import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectCurrentUser, logout } from '@/features/auth/authSlice';
import { 
  Home, 
  BedDouble, 
  Users, 
  BarChart2, 
  FileText, 
  Settings, 
  LogOut, 
  ClipboardList,
  Shield,
  TrendingUp
} from 'lucide-react';
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  Logo,
  ProfileLink,
} from '@/components/ui/sidebar';

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentUser = useSelector(selectCurrentUser);
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  // Define links based on user role
  const getLinksForRole = () => {
    const role = currentUser?.role;
    
    const commonLinks = [
      {
        label: 'Settings',
        href: '#settings',
        icon: <Settings className="h-5 w-5" />,
      },
      {
        label: 'Logout',
        href: '#',
        icon: <LogOut className="h-5 w-5" />,
        onClick: (e) => {
          e.preventDefault();
          handleLogout();
        },
      },
    ];

    switch (role) {
      case 'manager':
        return [
          {
            label: 'Dashboard',
            href: '/manager/dashboard',
            icon: <Home className="h-5 w-5" />,
          },
          {
            label: 'Bed Management',
            href: '/manager/dashboard',
            icon: <BedDouble className="h-5 w-5" />,
          },
          {
            label: 'Occupant Status',
            href: '/manager/occupants',
            icon: <Users className="h-5 w-5" />,
          },
          {
            label: 'Reports',
            href: '/reports',
            icon: <FileText className="h-5 w-5" />,
          },
          {
            label: 'Analytics',
            href: '#analytics',
            icon: <BarChart2 className="h-5 w-5" />,
          },
          ...commonLinks,
        ];

      case 'ward_staff':
        return [
          {
            label: 'Dashboard',
            href: '/staff/dashboard',
            icon: <Home className="h-5 w-5" />,
          },
          {
            label: 'Bed Cleaning',
            href: '/staff/dashboard',
            icon: <BedDouble className="h-5 w-5" />,
          },
          {
            label: 'Cleaning Logs',
            href: '#logs',
            icon: <ClipboardList className="h-5 w-5" />,
          },
          ...commonLinks,
        ];

      case 'hospital_admin':
        return [
          {
            label: 'Dashboard',
            href: '/admin/dashboard',
            icon: <Home className="h-5 w-5" />,
          },
          {
            label: 'Analytics',
            href: '/admin/dashboard',
            icon: <BarChart2 className="h-5 w-5" />,
          },
          {
            label: 'Reports',
            href: '/reports',
            icon: <FileText className="h-5 w-5" />,
          },
          {
            label: 'Occupants',
            href: '/manager/occupants',
            icon: <Users className="h-5 w-5" />,
          },
          {
            label: 'Forecasting',
            href: '#forecasting',
            icon: <TrendingUp className="h-5 w-5" />,
          },
          ...commonLinks,
        ];

      case 'technical_team':
        return [
          {
            label: 'Dashboard',
            href: '/tech/dashboard',
            icon: <Home className="h-5 w-5" />,
          },
          {
            label: 'System Status',
            href: '#system',
            icon: <Shield className="h-5 w-5" />,
          },
          {
            label: 'Bed Management',
            href: '#beds',
            icon: <BedDouble className="h-5 w-5" />,
          },
          {
            label: 'Users',
            href: '#users',
            icon: <Users className="h-5 w-5" />,
          },
          ...commonLinks,
        ];

      case 'er_staff':
        return [
          {
            label: 'Dashboard',
            href: '/er/dashboard',
            icon: <Home className="h-5 w-5" />,
          },
          {
            label: 'Available Beds',
            href: '#beds',
            icon: <BedDouble className="h-5 w-5" />,
          },
          {
            label: 'Emergency Queue',
            href: '#queue',
            icon: <ClipboardList className="h-5 w-5" />,
          },
          ...commonLinks,
        ];

      default:
        return [
          {
            label: 'Dashboard',
            href: '/',
            icon: <Home className="h-5 w-5" />,
          },
          ...commonLinks,
        ];
    }
  };

  const links = getLinksForRole();

  return (
    <div className="flex h-screen w-full bg-black text-white overflow-hidden">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="h-full flex flex-col justify-between">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            <Logo />
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>
          <div className="mt-auto">
            <ProfileLink />
          </div>
        </SidebarBody>
      </Sidebar>

      <div className="flex-1 overflow-auto h-full bg-black">
        <div className="min-h-full p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
