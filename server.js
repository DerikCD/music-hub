const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static('public'));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /\.(mp3|wav|flac|m4a|ogg|mp4|avi|mov|mkv|webm|flv|wmv)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio/video files allowed'));
    }
  }
});

let tracks = [];
let favorites = [];
let playlists = [];
let recentlyPlayed = [];
let queue = [];

app.post('/api/upload', upload.single('track'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const track = {
    id: Date.now(),
    filename: req.file.filename,
    artist: req.body.artist || 'Unknown',
    title: req.body.title || req.file.originalname,
    genre: req.body.genre || 'Other',
    url: `/stream/${req.file.filename}`,
    plays: 0,
    uploadedAt: new Date().toISOString()
  };

  tracks.push(track);
  res.json(track);
});

app.get('/api/tracks', (req, res) => {
  res.json(tracks);
});

app.get('/api/tracks/search/:query', (req, res) => {
  const query = req.params.query.toLowerCase();
  const results = tracks.filter(t => 
    t.title.toLowerCase().includes(query) || 
    t.artist.toLowerCase().includes(query) ||
    t.genre.toLowerCase().includes(query)
  );
  res.json(results);
});

app.get('/api/favorites', (req, res) => {
  const favTracks = tracks.filter(t => favorites.includes(t.id));
  res.json(favTracks);
});

app.post('/api/favorites/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!favorites.includes(id)) {
    favorites.push(id);
  }
  res.json({ success: true });
});

app.delete('/api/favorites/:id', (req, res) => {
  const id = parseInt(req.params.id);
  favorites = favorites.filter(f => f !== id);
  res.json({ success: true });
});

app.get('/api/recently-played', (req, res) => {
  const recent = recentlyPlayed.map(id => tracks.find(t => t.id === id)).filter(Boolean);
  res.json(recent);
});

app.post('/api/played/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const track = tracks.find(t => t.id === id);
  if (track) {
    track.plays++;
    recentlyPlayed = recentlyPlayed.filter(p => p !== id);
    recentlyPlayed.unshift(id);
    if (recentlyPlayed.length > 20) recentlyPlayed.pop();
  }
  res.json({ success: true });
});

app.get('/api/most-played', (req, res) => {
  const sorted = [...tracks].sort((a, b) => b.plays - a.plays).slice(0, 10);
  res.json(sorted);
});

app.post('/api/playlists', (req, res) => {
  const playlist = {
    id: Date.now(),
    name: req.body.name || 'New Playlist',
    tracks: [],
    createdAt: new Date().toISOString()
  };
  playlists.push(playlist);
  res.json(playlist);
});

app.get('/api/playlists', (req, res) => {
  res.json(playlists);
});

app.delete('/api/playlists/:id', (req, res) => {
  const id = parseInt(req.params.id);
  playlists = playlists.filter(p => p.id !== id);
  res.json({ success: true });
});

app.get('/stream/:filename', (req, res) => {
  const filepath = path.join(uploadsDir, req.params.filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(filepath);
});

app.delete('/api/tracks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const track = tracks.find(t => t.id === id);
  if (!track) return res.status(404).json({ error: 'Not found' });

  const filepath = path.join(uploadsDir, track.filename);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  
  tracks = tracks.filter(t => t.id !== id);
  favorites = favorites.filter(f => f !== id);
  queue = queue.filter(q => q !== id);
  
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Running on port ${PORT}`);
});
