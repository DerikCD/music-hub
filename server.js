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
    const allowed = /\.(mp3|wav|flac|m4a|ogg)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files allowed'));
    }
  }
});

let tracks = [];

app.post('/api/upload', upload.single('track'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const track = {
    id: Date.now(),
    filename: req.file.filename,
    artist: req.body.artist || 'Unknown',
    title: req.body.title || req.file.originalname,
    url: `/stream/${req.file.filename}`
  };

  tracks.push(track);
  res.json(track);
});

app.get('/api/tracks', (req, res) => {
  res.json(tracks);
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
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Running on port ${PORT}`);
});
