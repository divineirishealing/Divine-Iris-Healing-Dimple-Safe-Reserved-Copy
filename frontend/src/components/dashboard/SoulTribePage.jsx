import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Heart, MessageCircle, Send, Image as ImageIcon, Smile, Star, Loader2, MoreHorizontal } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../../hooks/use-toast';
import { cn, formatDateTimeDdMonYyyy } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

const REACTIONS = [
  { emoji: '❤️', label: 'Love' },
  { emoji: '🙏', label: 'Gratitude' },
  { emoji: '✨', label: 'Inspired' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '🌟', label: 'Star' },
  { emoji: '🤗', label: 'Hug' },
];

const PostCard = ({ post, onReact, onComment }) => {
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [showReactions, setShowReactions] = useState(false);

  const totalReactions = Object.values(post.reactions || {}).reduce((s, v) => s + v, 0);

  return (
    <div className="bg-white rounded-2xl border overflow-hidden hover:shadow-sm transition-shadow" data-testid={`tribe-post-${post.id}`}>
      {/* Author */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5D3FD3] to-[#D4AF37] flex items-center justify-center text-white text-sm font-bold">
          {(post.author_name || 'A').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{post.author_name || 'Soul Tribe Member'}</p>
          <p className="text-[10px] text-gray-400">
            {formatDateTimeDdMonYyyy(post.created_at)}{' '}
            {post.badge && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] text-[8px] font-bold">
                {post.badge}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>
      </div>

      {/* Image */}
      {post.image && (
        <div className="px-4 pb-3">
          <img src={post.image.startsWith('/') ? `${API}${post.image}` : post.image} alt="" className="w-full rounded-xl max-h-96 object-cover" />
        </div>
      )}

      {/* Reaction summary */}
      {totalReactions > 0 && (
        <div className="px-4 pb-2 flex items-center gap-1">
          {Object.entries(post.reactions || {}).filter(([, v]) => v > 0).slice(0, 3).map(([emoji]) => (
            <span key={emoji} className="text-xs">{emoji}</span>
          ))}
          <span className="text-[10px] text-gray-400 ml-1">{totalReactions}</span>
        </div>
      )}

      {/* Actions */}
      <div className="border-t flex items-center">
        <div className="relative flex-1">
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
            data-testid={`react-${post.id}`}
          >
            <Heart size={14} /> React
          </button>
          {showReactions && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white rounded-full shadow-lg border px-2 py-1 flex gap-1 z-10">
              {REACTIONS.map(r => (
                <button key={r.emoji} onClick={() => { onReact(post.id, r.emoji); setShowReactions(false); }}
                  className="text-lg hover:scale-125 transition-transform p-1" title={r.label}>
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setShowComments(!showComments)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors border-l"
          data-testid={`comment-toggle-${post.id}`}
        >
          <MessageCircle size={14} /> {(post.comments || []).length || 'Comment'}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t bg-gray-50 p-3">
          {(post.comments || []).map((c, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-600 shrink-0">
                {(c.author || 'A').charAt(0)}
              </div>
              <div className="bg-white rounded-xl px-3 py-2 text-xs flex-1">
                <span className="font-semibold text-gray-900">{c.author}</span>{' '}
                <span className="text-gray-600">{c.text}</span>
                <p className="text-[9px] text-gray-400 mt-0.5">{formatDateTimeDdMonYyyy(c.created_at)}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && comment.trim()) { onComment(post.id, comment); setComment(''); } }}
              placeholder="Write a comment..."
              className="flex-1 bg-white border rounded-full px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-purple-300"
              data-testid={`comment-input-${post.id}`}
            />
            <button onClick={() => { if (comment.trim()) { onComment(post.id, comment); setComment(''); } }}
              className="w-8 h-8 rounded-full bg-[#5D3FD3] text-white flex items-center justify-center hover:bg-[#4c32b3] transition-colors">
              <Send size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const SoulTribePage = () => {
  const { toast } = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/api/student/tribe/posts`, { withCredentials: true })
      .then(r => setPosts(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const createPost = async () => {
    if (!newPost.trim()) return;
    setPosting(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        const fd = new FormData();
        fd.append('file', imageFile);
        const uploadRes = await axios.post(`${API}/api/upload/image`, fd, { withCredentials: true });
        imageUrl = uploadRes.data.url || '';
      }
      const r = await axios.post(`${API}/api/student/tribe/posts`, {
        content: newPost, image: imageUrl,
      }, { withCredentials: true });
      setPosts(prev => [r.data, ...prev]);
      setNewPost('');
      setImageFile(null);
      setImagePreview(null);
      toast({ title: 'Posted to Soul Tribe!' });
    } catch { toast({ title: 'Error posting', variant: 'destructive' }); }
    finally { setPosting(false); }
  };

  const handleReact = async (postId, emoji) => {
    try {
      await axios.post(`${API}/api/student/tribe/react`, { post_id: postId, emoji }, { withCredentials: true });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: { ...p.reactions, [emoji]: (p.reactions?.[emoji] || 0) + 1 } } : p));
    } catch {}
  };

  const handleComment = async (postId, text) => {
    try {
      const r = await axios.post(`${API}/api/student/tribe/comment`, { post_id: postId, text }, { withCredentials: true });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), r.data] } : p));
    } catch {}
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-[#5D3FD3]" size={24} />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4" data-testid="soul-tribe-page">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Soul Tribe</h1>
        <p className="text-sm text-gray-500">Share, inspire, and grow together</p>
      </div>

      {/* Create Post */}
      <div className="bg-white rounded-2xl border p-4" data-testid="create-post">
        <textarea
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          placeholder="Share your experience, aha moment, or just send love to your tribe..."
          className="w-full h-20 bg-gray-50 rounded-xl px-3 py-2 text-sm resize-none border-0 focus:ring-1 focus:ring-purple-300 outline-none"
          data-testid="tribe-post-input"
        />
        {imagePreview && (
          <div className="relative mt-2 inline-block">
            <img src={imagePreview} alt="" className="h-20 rounded-lg object-cover" />
            <button onClick={() => { setImageFile(null); setImagePreview(null); }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">×</button>
          </div>
        )}
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-xs text-gray-500 hover:text-purple-600 transition-colors px-2 py-1 rounded-lg hover:bg-purple-50">
              <ImageIcon size={14} /> Photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </div>
          <Button onClick={createPost} disabled={posting || !newPost.trim()} size="sm"
            className="bg-[#5D3FD3] hover:bg-[#4c32b3] text-white rounded-full px-4" data-testid="tribe-post-btn">
            {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} className="mr-1" />}
            Share
          </Button>
        </div>
      </div>

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border">
          <div className="text-4xl mb-2">🌱</div>
          <p className="text-sm text-gray-500">Be the first to share in the Soul Tribe!</p>
          <p className="text-xs text-gray-400 mt-1">Your words could be the light someone needs today</p>
        </div>
      ) : (
        posts.map(post => (
          <PostCard key={post.id} post={post} onReact={handleReact} onComment={handleComment} />
        ))
      )}
    </div>
  );
};

export default SoulTribePage;
