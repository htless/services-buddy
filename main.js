const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const fs = require('fs');

const monorepoPath = '../shippon-monorepo';

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', (socket) => {
  let activeServices = {};
  let currentLogStream;

  socket.emit('activeServices', Object.keys(activeServices));

  socket.on('startService', (services) => {
    services.forEach(service => {
      if (activeServices[service]) {
        socket.emit('serviceError', `O serviço ${service} já está ativo.`);
        return;
      }
  
      const logFile = `/tmp/logs/${service}.log`;
      const serviceProcess = spawn('nx', ['run', `backend-${service}:serve`], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: monorepoPath
      });
  
      activeServices[service] = { process: serviceProcess, logFile };
  
      serviceProcess.stdout.pipe(fs.createWriteStream(logFile, { flags: 'a' }));
      serviceProcess.stderr.pipe(fs.createWriteStream(logFile, { flags: 'a' }));
    });

    socket.emit('servicesStarted', services);
  });
  

  socket.on('stopService', (service) => {
    if (activeServices[service]) {
      activeServices[service].process.kill();
      delete activeServices[service];
      socket.emit('serviceStopped', service);
    } else {
      socket.emit('serviceError', `O serviço ${service} não está ativo.`);
    }
  });

  socket.on('subscribeToLog', ({ service }) => {
    const logPath = activeServices[service]?.logFile;
    if (!logPath || !fs.existsSync(logPath)) {
      socket.emit('logError', 'Caminho do log inválido ou log não encontrado.');
      return;
    }
  
    const readStream = fs.createReadStream(logPath, { encoding: 'utf8' });
  
    readStream.on('data', (chunk) => {
      socket.emit('logData', chunk);
    });
  
    readStream.on('end', () => {
      socket.emit('logEnd');
    });
  
    readStream.on('error', (error) => {
      socket.emit('logError', error.message);
    });
  
    socket.on('disconnect', () => {
      readStream.close();
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
