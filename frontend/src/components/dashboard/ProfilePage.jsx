import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { User, MapPin, Calendar, Briefcase, GraduationCap } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const ProfilePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    full_name: user?.name || '',
    gender: user?.gender || '',
    place_of_birth: user?.place_of_birth || '',
    date_of_birth: user?.date_of_birth || '',
    city: user?.city || '',
    qualification: user?.qualification || '',
    profession: user?.profession || '',
    phone: user?.phone || ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`${API}/api/student/profile`, formData, { withCredentials: true });
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
          <h1 className="text-2xl font-serif font-bold text-gray-900">{user?.name}</h1>
          <p className="text-sm text-[#5D3FD3] font-medium">{user?.email}</p>
          <div className="mt-2 flex gap-2">
            <span className="text-[10px] px-2 py-1 bg-purple-50 text-purple-700 rounded-full uppercase tracking-wider font-bold">Tier {user?.tier}</span>
            {user?.pending_profile_update && <span className="text-[10px] px-2 py-1 bg-amber-50 text-amber-700 rounded-full uppercase tracking-wider font-bold">Update Pending</span>}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Detailed Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">
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
