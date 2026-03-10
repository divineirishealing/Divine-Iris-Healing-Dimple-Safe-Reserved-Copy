import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { Pencil, Trash2, Plus, LogOut } from 'lucide-react';
import ImageUploader from './ImageUploader';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminPanel = ({ onLogout }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('programs');

  // State for data
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [stats, setStats] = useState([]);
  const [subscribers, setSubscribers] = useState([]);

  // Form states
  const [programForm, setProgramForm] = useState({ title: '', category: '', description: '', image: '', link: '/program' });
  const [sessionForm, setSessionForm] = useState({ title: '', description: '', image: '' });
  const [testimonialForm, setTestimonialForm] = useState({ videoId: '' });
  const [editingId, setEditingId] = useState(null);

  // Load data
  useEffect(() => {
    loadPrograms();
    loadSessions();
    loadTestimonials();
    loadStats();
    loadSubscribers();
  }, []);

  const loadPrograms = async () => {
    try {
      const response = await axios.get(`${API}/programs`);
      setPrograms(response.data);
    } catch (error) {
      console.error('Error loading programs:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await axios.get(`${API}/sessions`);
      setSessions(response.data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadTestimonials = async () => {
    try {
      const response = await axios.get(`${API}/testimonials`);
      setTestimonials(response.data);
    } catch (error) {
      console.error('Error loading testimonials:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadSubscribers = async () => {
    try {
      const response = await axios.get(`${API}/newsletter`);
      setSubscribers(response.data);
    } catch (error) {
      console.error('Error loading subscribers:', error);
    }
  };

  // Programs CRUD
  const handleProgramSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API}/programs/${editingId}`, programForm);
        toast({ title: 'Program updated successfully!' });
      } else {
        await axios.post(`${API}/programs`, programForm);
        toast({ title: 'Program created successfully!' });
      }
      setProgramForm({ title: '', category: '', description: '', image: '', link: '/program' });
      setEditingId(null);
      loadPrograms();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleProgramEdit = (program) => {
    setProgramForm(program);
    setEditingId(program.id);
  };

  const handleProgramDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this program?')) {
      try {
        await axios.delete(`${API}/programs/${id}`);
        toast({ title: 'Program deleted successfully!' });
        loadPrograms();
      } catch (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    }
  };

  // Sessions CRUD
  const handleSessionSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API}/sessions/${editingId}`, sessionForm);
        toast({ title: 'Session updated successfully!' });
      } else {
        await axios.post(`${API}/sessions`, sessionForm);
        toast({ title: 'Session created successfully!' });
      }
      setSessionForm({ title: '', description: '', image: '' });
      setEditingId(null);
      loadSessions();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSessionEdit = (session) => {
    setSessionForm(session);
    setEditingId(session.id);
  };

  const handleSessionDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this session?')) {
      try {
        await axios.delete(`${API}/sessions/${id}`);
        toast({ title: 'Session deleted successfully!' });
        loadSessions();
      } catch (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    }
  };

  // Testimonials CRUD
  const handleTestimonialSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/testimonials`, testimonialForm);
      toast({ title: 'Testimonial added successfully!' });
      setTestimonialForm({ videoId: '' });
      loadTestimonials();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleTestimonialDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this testimonial?')) {
      try {
        await axios.delete(`${API}/testimonials/${id}`);
        toast({ title: 'Testimonial deleted successfully!' });
        loadTestimonials();
      } catch (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    }
  };

  const handleStatUpdate = async (stat, newValue, newLabel) => {
    try {
      await axios.put(`${API}/stats/${stat.id}`, { value: newValue, label: newLabel, order: stat.order });
      toast({ title: 'Stat updated successfully!' });
      loadStats();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Divine Iris Healing - Admin Panel</h1>
          <Button onClick={onLogout} variant="outline" className="text-white border-white hover:bg-white hover:text-gray-900">
            <LogOut size={18} className="mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="container mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="programs">Programs ({programs.length})</TabsTrigger>
            <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
            <TabsTrigger value="testimonials">Testimonials ({testimonials.length})</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="subscribers">Subscribers ({subscribers.length})</TabsTrigger>
          </TabsList>

          {/* Programs Tab */}
          <TabsContent value="programs">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{editingId ? 'Edit Program' : 'Add New Program'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProgramSubmit} className="space-y-4">
                    <Input
                      placeholder="Title"
                      value={programForm.title}
                      onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })}
                      required
                    />
                    <Input
                      placeholder="Category (e.g., Foundation, Body-Based)"
                      value={programForm.category}
                      onChange={(e) => setProgramForm({ ...programForm, category: e.target.value })}
                      required
                    />
                    <Textarea
                      placeholder="Description"
                      value={programForm.description}
                      onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                      required
                      rows={4}
                    />
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Program Image *</label>
                      <div className="text-xs text-gray-600 mb-2">Choose one option below:</div>
                      
                      {/* Simple file input */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                        <label className="block">
                          <span className="text-sm font-medium text-gray-700">Upload from Computer:</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              
                              if (file.size > 5 * 1024 * 1024) {
                                toast({ title: 'File too large', description: 'Max 5MB', variant: 'destructive' });
                                return;
                              }
                              
                              const formData = new FormData();
                              formData.append('file', file);
                              
                              try {
                                const response = await axios.post(`${API}/upload/image`, formData);
                                const imageUrl = `${BACKEND_URL}${response.data.url}`;
                                setProgramForm({ ...programForm, image: imageUrl });
                                toast({ title: 'Image uploaded!' });
                              } catch (error) {
                                toast({ title: 'Upload failed', variant: 'destructive' });
                              }
                            }}
                            className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                          />
                        </label>
                      </div>
                      
                      <div className="text-center text-sm text-gray-500">OR</div>
                      
                      {/* URL input */}
                      <Input
                        placeholder="Paste image URL (e.g., https://images.unsplash.com/...)"
                        value={programForm.image}
                        onChange={(e) => setProgramForm({ ...programForm, image: e.target.value })}
                      />
                      
                      {/* Image preview */}
                      {programForm.image && (
                        <div className="mt-2">
                          <img src={programForm.image} alt="Preview" className="w-full h-32 object-cover rounded border" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1">
                        <Plus size={18} className="mr-2" />
                        {editingId ? 'Update' : 'Add'} Program
                      </Button>
                      {editingId && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingId(null);
                            setProgramForm({ title: '', category: '', description: '', image: '', link: '/program' });
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Existing Programs</h3>
                {programs.map((program) => (
                  <Card key={program.id}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <img src={program.image} alt={program.title} className="w-20 h-20 object-cover rounded" />
                        <div className="flex-1">
                          <h4 className="font-semibold">{program.title}</h4>
                          <p className="text-sm text-gray-600">{program.category}</p>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{program.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleProgramEdit(program)}>
                            <Pencil size={16} />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleProgramDelete(program.id)}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{editingId ? 'Edit Session' : 'Add New Session'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSessionSubmit} className="space-y-4">
                    <Input
                      placeholder="Title"
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                      required
                    />
                    <Textarea
                      placeholder="Description"
                      value={sessionForm.description}
                      onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
                      required
                      rows={4}
                    />
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Session Image *</label>
                      <div className="text-xs text-gray-600 mb-2">Choose one option below:</div>
                      
                      {/* Simple file input */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                        <label className="block">
                          <span className="text-sm font-medium text-gray-700">Upload from Computer:</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              
                              if (file.size > 5 * 1024 * 1024) {
                                toast({ title: 'File too large', description: 'Max 5MB', variant: 'destructive' });
                                return;
                              }
                              
                              const formData = new FormData();
                              formData.append('file', file);
                              
                              try {
                                const response = await axios.post(`${API}/upload/image`, formData);
                                const imageUrl = `${BACKEND_URL}${response.data.url}`;
                                setSessionForm({ ...sessionForm, image: imageUrl });
                                toast({ title: 'Image uploaded!' });
                              } catch (error) {
                                toast({ title: 'Upload failed', variant: 'destructive' });
                              }
                            }}
                            className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                          />
                        </label>
                      </div>
                      
                      <div className="text-center text-sm text-gray-500">OR</div>
                      
                      {/* URL input */}
                      <Input
                        placeholder="Paste image URL (e.g., https://images.unsplash.com/...)"
                        value={sessionForm.image}
                        onChange={(e) => setSessionForm({ ...sessionForm, image: e.target.value })}
                      />
                      
                      {/* Image preview */}
                      {sessionForm.image && (
                        <div className="mt-2">
                          <img src={sessionForm.image} alt="Preview" className="w-full h-32 object-cover rounded border" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1">
                        <Plus size={18} className="mr-2" />
                        {editingId ? 'Update' : 'Add'} Session
                      </Button>
                      {editingId && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingId(null);
                            setSessionForm({ title: '', description: '', image: '' });
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Existing Sessions</h3>
                {sessions.map((session) => (
                  <Card key={session.id}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <img src={session.image} alt={session.title} className="w-20 h-20 object-cover rounded" />
                        <div className="flex-1">
                          <h4 className="font-semibold">{session.title}</h4>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{session.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleSessionEdit(session)}>
                            <Pencil size={16} />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleSessionDelete(session.id)}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Testimonials Tab */}
          <TabsContent value="testimonials">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add YouTube Testimonial</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTestimonialSubmit} className="space-y-4">
                    <Input
                      placeholder="YouTube Video ID (e.g., i3UJ6t6xYwQ)"
                      value={testimonialForm.videoId}
                      onChange={(e) => setTestimonialForm({ videoId: e.target.value })}
                      required
                    />
                    <p className="text-sm text-gray-600">Enter just the video ID from the YouTube URL</p>
                    <Button type="submit" className="w-full">
                      <Plus size={18} className="mr-2" />
                      Add Testimonial
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Existing Testimonials</h3>
                {testimonials.map((testimonial) => (
                  <Card key={testimonial.id}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <img src={testimonial.thumbnail} alt="Testimonial" className="w-32 h-20 object-cover rounded" />
                        <div className="flex-1">
                          <p className="text-sm font-mono">{testimonial.videoId}</p>
                        </div>
                        <Button size="sm" variant="destructive" onClick={() => handleTestimonialDelete(testimonial.id)}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle>Website Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {stats.map((stat) => (
                    <StatEditor key={stat.id} stat={stat} onUpdate={handleStatUpdate} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscribers Tab */}
          <TabsContent value="subscribers">
            <Card>
              <CardHeader>
                <CardTitle>Newsletter Subscribers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {subscribers.map((subscriber) => (
                    <div key={subscriber.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>{subscriber.email}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(subscriber.subscribed_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const StatEditor = ({ stat, onUpdate }) => {
  const [value, setValue] = useState(stat.value);
  const [label, setLabel] = useState(stat.label);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onUpdate(stat, value, label);
    setIsEditing(false);
  };

  return (
    <Card>
      <CardContent className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" />
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} className="flex-1">Save</Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-3xl font-bold text-yellow-600 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-600 mb-3">{stat.label}</div>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="w-full">
              <Pencil size={14} className="mr-2" />
              Edit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminPanel;
