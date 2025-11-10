import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

interface UserData {
    name: string | null;
    username: string;
    email: string;
    avatarUrl: string | null;
}

export const StickyNavbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('jwt'));

  const clearUserData = () => {
    setUserData(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt');
    setIsLoggedIn(false);
    clearUserData();
    navigate('/signin');
  };

  useEffect(() => {
    const fetchUserData = async () => {
      const jwt = localStorage.getItem('jwt');
      if (jwt) {
        setIsLoggedIn(true);
        try {
          const decodedToken = JSON.parse(atob(jwt.split('.')[1]));
          const userId = decodedToken.id;

          const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/users/${userId}`, {
            headers: { Authorization: `Bearer ${jwt}` }
          });
          setUserData(response.data);

        } catch (error) {
          console.error("Error fetching user data:", error);
          if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
            handleLogout();
          }
        }
      } else {
        setIsLoggedIn(false);
        clearUserData();
      }
    };

    fetchUserData();
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    const syncAuth = (event: StorageEvent) => {
      if (event.key === 'jwt') {
        const token = event.newValue;
        if (token) {
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
          clearUserData();
          if (window.location.pathname !== '/signin' && window.location.pathname !== '/signup') {
            navigate('/signin');
          }
        }
      }
    };

    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener('storage', syncAuth);
    };
  }, [navigate]);

  const handleHomeClick = () => {
    navigate('/');
  };
  
  const userInitial = userData?.name?.charAt(0).toUpperCase() || userData?.username?.charAt(0).toUpperCase() || "U";
  const avatarSrc = userData?.avatarUrl || `https://i.pravatar.cc/48?u=${encodeURIComponent(userData?.username || 'default')}`;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/95 shadow-md backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-[50px] items-center">
          <div className="flex-shrink-0 flex items-center">
            <button onClick={handleHomeClick} className="text-xl font-bold text-zinc-100 hover:text-zinc-300 transition-colors">
              <span className="hidden sm:inline">blogApp</span>
              <span className="sm:hidden">bA</span>
            </button>
          </div>

          {isLoggedIn ? (
            <div className="flex items-center">
              <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      {userData && <AvatarImage src={avatarSrc} alt={userData.name || userData.username} />}
                      <AvatarFallback className="bg-zinc-800 text-zinc-300">{userInitial}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 border-zinc-800 bg-zinc-950 text-zinc-100" align="end" forceMount>
                    {userData && (
                        <>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex items-center gap-3 p-2">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={avatarSrc} alt={userData.name || userData.username} />
                                        <AvatarFallback className="bg-zinc-800 text-zinc-300">{userInitial}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col space-y-1 overflow-hidden">
                                        <p className="text-sm font-medium leading-none truncate">{userData.name || userData.username}</p>
                                        <p className="text-xs leading-none text-zinc-400 truncate">{userData.email}</p>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-zinc-800" />
                        </>
                    )}
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild className="cursor-pointer focus:bg-zinc-800 focus:text-zinc-100">
                        <Link to="/profile" className="flex items-center w-full">
                        <User className="mr-2 h-4 w-4" />
                        <span>Account</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer focus:bg-zinc-800 focus:text-zinc-100">
                        <Link to="/create-blog" className="flex items-center w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        <span>Create a Blog</span>
                        </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-zinc-800"/>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className='cursor-pointer text-red-500 focus:bg-red-900/40 focus:text-red-400'
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" asChild>
                <Link to="/signin">Sign In</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};