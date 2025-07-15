import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// Helper function to get stored auth data
const getStoredAuthData = () => {
  if (typeof window === 'undefined') {
    return { token: null, user: null, profilePicture: null };
  }
  
  try {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const profilePicture = localStorage.getItem('profilePicture');
    return {
      token,
      user: user ? JSON.parse(user) : null,
      profilePicture: profilePicture || null
    };
  } catch (error) {
    console.error('Error reading auth data from storage:', error);
    return { token: null, user: null, profilePicture: null };
  }
};

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  showSplash: false,
  error: null,
  profilePicture: null,
  login: async () => {},
  logout: () => {},
  updateUser: () => {},
  checkAuthState: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(false);
  const [error, setError] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const navigate = useNavigate();

  // Helper function to update auth state and storage
  const updateAuthState = useCallback((userData = null, authenticated = false) => {
    setUser(userData);
    setIsAuthenticated(authenticated);
    
    if (authenticated && userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      if (userData.profilePicture) {
        localStorage.setItem('profilePicture', userData.profilePicture);
      }
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('profilePicture');
    }
  }, []);

  // Check and validate authentication state
  const checkAuthState = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { token, user: storedUser, profilePicture: storedProfilePicture } = getStoredAuthData();
      
      if (!token) {
        updateAuthState(null, false);
        setProfilePicture(null);
        setIsLoading(false);
        return false;
      }
      if (storedUser) {
        updateAuthState(storedUser, true);
        setProfilePicture(storedProfilePicture);
        setIsLoading(false);
        return true;
      }
      // If no user in localStorage, validate token with backend
      try {
        const response = await authService.getCurrentUserProfile();
        if (response && (response.data || response._id)) {
          // Support both {data: user} and direct user object
          const userObj = response.data || response;
          updateAuthState(userObj, true);
          setProfilePicture(userObj.profilePicture);
          setIsLoading(false);
          return true;
        }
        throw new Error('Failed to fetch user profile');
      } catch (error) {
        console.error('Token validation failed:', error);
        authService.clearAuthData();
        updateAuthState(null, false);
        setProfilePicture(null);
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      setError(error);
      authService.clearAuthData();
      updateAuthState(null, false);
      setProfilePicture(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [updateAuthState]);

  // Handle login
  const login = useCallback(async (userData) => {
    try {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await authService.login(userData);
        // The response format should be:
        // { data: { success: true, token: '...', data: { user data } } }
        if (response && response.data && response.data.success) {
          const { token, data: user } = response.data;
          
          if (!token || !user) {
            throw new Error('Missing token or user data in response');
          }
          
          // Update auth state immediately
          updateAuthState(user, true);
          
          // Show splash screen
          setShowSplash(true);
          
          // Return success with user data
          return { success: true, user };
        }
        
        throw new Error('Invalid response format from server');
        
      } catch (apiError) {
        console.error('AuthContext: API Error during login:', {
          message: apiError.message,
          status: apiError.response?.status,
          data: apiError.response?.data
        });
        throw apiError; // Re-throw to be caught by the outer catch
      }
      
    } catch (err) {
      // Handle all errors
      const errorMessage = err.response?.data?.message || 
                         err.message || 
                         'Login failed. Please check your credentials and try again.';
      
      console.error('AuthContext: Login failed:', errorMessage);
      
      // Clear any partial auth data
      authService.clearAuthData();
      updateAuthState(null, false);
      
      // Set error for UI
      setError(errorMessage);
      
      // Re-throw with a user-friendly message
      throw new Error(errorMessage);
      
    } finally {
      setIsLoading(false);
    }
  }, [updateAuthState]);

  // Handle logout
  const logout = useCallback(async () => {
    try {
      // Clear auth data first
      authService.clearAuthData();
      
      // Update the auth state immediately
      updateAuthState(null, false);
      
      // Make the API call to invalidate the token on the server
      try {
        await authService.logout();
      } catch (apiError) {
        console.warn('AuthContext: Logout API call failed, but continuing with local cleanup', apiError);
        // Continue with the logout flow even if the API call fails
      }
      
      // Clear any remaining state
      setError(null);
      setProfilePicture(null);
      
      // Return success to indicate logout completed
      return { success: true };
      
    } catch (error) {
      console.error('AuthContext: Error during logout:', error);
      // Ensure we still clear auth data even if something unexpected happens
      authService.clearAuthData();
      updateAuthState(null, false);
      setError(error.message || 'Logout failed');
      throw error;
    } finally {
      setIsLoading(false);
      navigate('/login', { replace: true });
    }
  }, [updateAuthState, navigate]);

  // Update user data
  const updateUser = useCallback(async (userData) => {
    try {
      // If we have a complete user object (from backend), use it directly
      if (userData && userData._id) {
        const updatedUser = { ...userData };
        if (isAuthenticated) {
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        setUser(updatedUser);
        return updatedUser;
      }
      
      // For partial updates, merge with existing user data
      setUser(prev => {
        const updatedUser = { ...prev, ...userData };
        if (isAuthenticated) {
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        return updatedUser;
      });
      
      return user;
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  }, [isAuthenticated, user]);

  // Check auth state on mount
  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        showSplash,
        error,
        profilePicture,
        login,
        logout,
        updateUser,
        checkAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
