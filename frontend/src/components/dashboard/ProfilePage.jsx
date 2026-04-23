import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { User, MapPin, Calendar, Briefcase, GraduationCap, ClipboardList, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { getAuthHeaders } from '../../lib/authHeaders';

const API = process.env.REACT_APP_BACKEND_URL;

function toDateInputValue(iso) {
  if (!iso) return '';
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

const ProfilePage = () => {
  const { user, checkAuth } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const [formData, setFormData] = useState({
    full_name: '',
    gender: '',
    place_of_birth: '',
    date_of_birth: '',
    city: '',
    qualification: '',
    profession: '',
    phone: '',
    joined_divine_iris_at: '',
  });

  useEffect(() => {
    if (!user) return;
    setFormData({
      full_name: user.name || user.full_name || '',
      gender: user.gender || '',
      place_of_birth: user.place_of_birth || '',
      date_of_birth: toDateInputValue(user.date_of_birth),
      city: user.city || '',
      qualification: user.qualification || '',
      profession: user.profession || '',
      phone: user.phone || '',
      joined_divine_iris_at: toDateInputValue(user.joined_divine_iris_at),
    });
  }, [user]);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`${API}/api/student/profile`, formData, {
        withCredentials: true,
        headers: getAuthHeaders(),
      });
      await checkAuth();
      toast({ title: "Profile Submitted", description: "Your changes are pending approval." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#5D3FD3] to-[#84A98C] p-[2px]">
          <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
            {user?.picture ? <img src={user.picture} alt="Profile" className="w-full h-full object-cover" /> : <User size={32} className="text-[#5D3FD3]" />}
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{user?.name}</h1>
          <p className="text-sm text-[#5D3FD3] font-medium">{user?.email}</p>
          <div className="mt-2 flex gap-2">
            <span className="text-[10px] px-2 py-1 bg-purple-50 text-purple-700 rounded-full uppercase tracking-wider font-bold">Tier {user?.tier}</span>
            {user?.pending_profile_update && <span className="text-[10px] px-2 py-1 bg-amber-50 text-amber-700 rounded-full uppercase tracking-wider font-bold">Update Pending</span>}
          </div>
        </div>
      </div>

      <Link
        to="/dashboard/orders"
        className="flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50/80 to-white px-4 py-3 text-left hover:border-[#5D3FD3]/30 transition-colors shadow-sm"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-lg bg-white border border-violet-100 flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-[#5D3FD3]" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-gray-900 text-sm">Order history</span>
            <span className="block text-xs text-gray-500 truncate">Receipts, invoices, and program links</span>
          </span>
        </span>
        <ChevronRight size={18} className="text-[#5D3FD3] shrink-0" />
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2 pb-2 border-b border-gray-100">
              <Label htmlFor="joined-divine-iris">Date of joining Divine Iris</Label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-3 text-gray-400 pointer-events-none" aria-hidden />
                <Input
                  id="joined-divine-iris"
                  type="date"
                  name="joined_divine_iris_at"
                  value={formData.joined_divine_iris_at}
                  onChange={handleChange}
                  className="pl-10"
                  aria-describedby="joined-divine-iris-hint"
                />
              </div>
              <p id="joined-divine-iris-hint" className="text-[10px] text-gray-500">
                Defaults from your first record on file. You may correct it here; changes are reviewed like the rest of your profile.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Full Name</Label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-gray-400" />
                <Input name="full_name" value={formData.full_name} onChange={handleChange} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input name="phone" value={formData.phone} onChange={handleChange} placeholder="+91..." />
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <select name="gender" value={formData.gender} onChange={handleChange} className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                <option value="">Select Gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-3 text-gray-400" />
                <Input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Place of Birth</Label>
              <Input name="place_of_birth" value={formData.place_of_birth} onChange={handleChange} placeholder="City, Country" />
            </div>

            <div className="space-y-2">
              <Label>Current City</Label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                <Input name="city" value={formData.city} onChange={handleChange} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Academic Qualification</Label>
              <div className="relative">
                <GraduationCap size={16} className="absolute left-3 top-3 text-gray-400" />
                <Input name="qualification" value={formData.qualification} onChange={handleChange} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Profession</Label>
              <div className="relative">
                <Briefcase size={16} className="absolute left-3 top-3 text-gray-400" />
                <Input name="profession" value={formData.profession} onChange={handleChange} className="pl-10" />
              </div>
            </div>

            <div className="md:col-span-2 mt-4">
              <Button type="submit" disabled={loading} className="w-full bg-[#5D3FD3] hover:bg-[#4c32b3]">
                {loading ? "Submitting..." : "Save Changes for Approval"}
              </Button>
              <p className="text-[10px] text-center text-gray-400 mt-2">
                Updates to sensitive information require admin verification.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
