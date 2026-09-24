const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Storage setup
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config - accepts ALL audio and video types
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Accept any audio or video type
    const audioTypes = ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac', 'wma', 'ape'];
    const videoTypes = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv', 'mts', 'm2ts', '3gp', 'ogv'];
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    
    if (audioTypes.includes(ext) || videoTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${ext} not supported`), false);
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// In-memory database
let tracks = [];
let favorites = [];
let playlists = [];
let recentlyPlayed = [];
let settings = {};
let trackIdCounter = 1;

// Routes

// Get all tracks
app.get('/api/tracks', (req, res) => {
  res.json(tracks);
});

// Search tracks
app.get('/api/tracks/search/:query', (req, res) => {
  const query = req.params.query.toLowerCase();
  const results = tracks.filter(t =>
    t.title.toLowerCase().includes(query) ||
    t.artist.toLowerCase().includes(query) ||
    t.genre.toLowerCase().includes(query)
  );
  res.json(results);
});

// Upload track
app.post('/api/upload', upload.single('track'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const track = {
    id: trackIdCounter++,
    title: req.body.title || 'Untitled',
    artist: req.body.artist || 'Unknown Artist',
    genre: req.body.genre || 'Other',
    filename: req.file.filename,
    plays: 0,
    createdAt: new Date()
  };

  tracks.push(track);
  res.json({ success: true, track });
});

// Stream track
app.get('/stream/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(uploadsDir, filename);

  // Security: prevent directory traversal
  if (!filepath.startsWith(uploadsDir)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Get favorites
app.get('/api/favorites', (req, res) => {
  const favTracks = tracks.filter(t => favorites.includes(t.id));
  res.json(favTracks);
});

// Add to favorites
app.post('/api/favorites/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!favorites.includes(id)) {
    favorites.push(id);
  }
  res.json({ success: true });
});

// Remove from favorites
app.delete('/api/favorites/:id', (req, res) => {
  const id = parseInt(req.params.id);
  favorites = favorites.filter(f => f !== id);
  res.json({ success: true });
});

// Record play
app.post('/api/played/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const track = tracks.find(t => t.id === id);
  if (track) {
    track.plays += 1;
    if (!recentlyPlayed.includes(id)) {
      recentlyPlayed.unshift(id);
    } else {
      recentlyPlayed = recentlyPlayed.filter(p => p !== id);
      recentlyPlayed.unshift(id);
    }
    if (recentlyPlayed.length > 50) {
      recentlyPlayed.pop();
    }
  }
  res.json({ success: true });
});

// Get recently played
app.get('/api/recently-played', (req, res) => {
  const recentTracks = recentlyPlayed
    .map(id => tracks.find(t => t.id === id))
    .filter(Boolean);
  res.json(recentTracks);
});

// Get most played
app.get('/api/most-played', (req, res) => {
  const sorted = [...tracks].sort((a, b) => b.plays - a.plays);
  res.json(sorted.slice(0, 10));
});

// Create playlist
app.post('/api/playlists', (req, res) => {
  const playlist = {
    id: Date.now(),
    name: req.body.name || 'New Playlist',
    description: req.body.description || '',
    tracks: [],
    createdAt: new Date()
  };
  playlists.push(playlist);
  res.json(playlist);
});

// Get playlists
app.get('/api/playlists', (req, res) => {
  res.json(playlists);
});

// Delete playlist
app.delete('/api/playlists/:id', (req, res) => {
  const id = parseInt(req.params.id);
  playlists = playlists.filter(p => p.id !== id);
  res.json({ success: true });
});

// Delete track
app.delete('/api/tracks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const track = tracks.find(t => t.id === id);
  
  if (track && fs.existsSync(path.join(uploadsDir, track.filename))) {
    fs.unlinkSync(path.join(uploadsDir, track.filename));
  }
  
  tracks = tracks.filter(t => t.id !== id);
  favorites = favorites.filter(f => f !== id);
  recentlyPlayed = recentlyPlayed.filter(p => p !== id);
  
  res.json({ success: true });
});

// Settings endpoints
app.get('/api/settings', (req, res) => {
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  settings = { ...settings, ...req.body };
  res.json(settings);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', tracksCount: tracks.length });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`🎵 SoundWave server running on port ${PORT}`);
});
