const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const fs = require('fs');
const { exec } = require('child_process');

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/start-services', (req, res) => {
  const services = req.body.services.join(' ');
  exec(`./run-backend.sh ${services}`, (err, stdout, stderr) => {
      if (err) {
          return res.status(500).json({ error: stderr });
      }
      const logsInfo = JSON.parse(stdout.substring(stdout.lastIndexOf('{')));
      res.json(logsInfo);
  });
});

io.on('connection', (socket) => {
  let currentLogStream;

  socket.on('selectLog', (logKey) => {
    if (currentLogStream) {
      currentLogStream.close();
    }

    currentLogStream = fs.createReadStream(logPaths[logKey], { encoding: 'utf8', flags: 'r' });
    currentLogStream.on('data', (chunk) => {
      socket.emit('logData', chunk);
    });
  });

  socket.on('disconnect', () => {
    if (currentLogStream) {
      currentLogStream.close();
    }
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
