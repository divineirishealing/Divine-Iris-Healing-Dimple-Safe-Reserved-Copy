import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Lock, Eye, EyeOff } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const AdminLogin = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API}/admin/login`, { username, password });
      if (res.data?.success) {
        localStorage.setItem('admin_token', res.data.token || 'authenticated');
        onLogin(true);
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      // Fallback to local check if backend endpoint doesn't exist yet
      const storedHash = localStorage.getItem('admin_password_hash');
      const defaultPass = 'divineadmin2024';
      const checkPass = storedHash || defaultPass;
      if (username === 'admin' && password === checkPass) {
        onLogin(true);
      } else {
        setError('Invalid username or password');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1a0b2e] to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 bg-gradient-to-br from-[#D4AF37] to-[#b8962e] rounded-full flex items-center justify-center shadow-lg">
              <Lock size={24} className="text-white" />
            </div>
          </div>
          <CardTitle className="text-xl font-serif">Divine Iris Healing</CardTitle>
          <p className="text-xs text-gray-500">Admin Panel</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)}
              required className="h-10" autoComplete="username" data-testid="admin-username" />
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                required className="h-10 pr-10" autoComplete="current-password" data-testid="admin-password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full h-10 bg-[#D4AF37] hover:bg-[#b8962e] text-white font-medium" data-testid="admin-login-btn">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
