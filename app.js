#!/usr/local/bin/node
var args = process.argv;
var settings = {};
var fs = require('fs');
settings.file = args[2];
settings.port = args[3];
if (settings.file === null || settings.file === undefined) {
  console.log("Help");
  return;
}

if (settings.port === null || settings.port === undefined) {
  settings.port = 3000;
}
settings.destination = settings.file.replace('.tex','.pdf');
if (settings.destination === settings.file) {
  console.log("ERROR: file must have .tex extension");
  return;
}

var express = require("express");
var io = require('socket.io');
var exec = require('child_process').exec;
var app = express();  

/**
 * Configure
 */
app.configure(function() {
  app.set('sessionStore', new express.session.MemoryStore());

  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.set('view options', { layout: false })
  app.use(express.session({
    secret: "hugc;yfaeokxqwv';",
    key: 'express.session',
    store: app.set('sessionStore')
  }));
  app.use(express.bodyParser());
  app.use(app.router);
});
app.configure("development", function() {
  app.use(express.static(__dirname + "/public"));
  app.set('view options', { layout: false })
  app.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
  }));
});

app.configure("production", function() {
  var oneYear = 31557600000;
  app.use(express.static(__dirname + "/public", {
    maxAge: oneYear
  }));
  app.use(express.errorHandler());
});

exec('ifconfig | grep inet | grep netmask | grep -v 127.0.0.1', function(err,stdout,stderr) {
  stdout = stdout.substr(0,stdout.indexOf('netmask'));
  stdout = stdout.substr(stdout.indexOf('inet') + 5);
  stdout = stdout.replace(' ', '');
  console.log("Server Address: " + stdout + ":" + settings.port);
});
var server = app.listen(settings.port);
io = io.listen(server, {'log level': 0});
var sockets = [];
function compileTex(file, destination, callback) {
  exec("texi2pdf " + file + " -o " + destination, function(err,stdout,stderr) {
    if (!(err === null || err === undefined)) {
      console.log("Update Fail");
      console.log(err);
      console.log(stderr);
    } else {
      console.log(destination);
      console.log("Update Successful");
      callback();
    }
  });
}
fs.watchFile(settings.file,function(curr, prev) {
  sockets.forEach(function(socket) {
    socket.emit("file_start_compile");
  });
  compileTex(settings.file,settings.destination,function() {
    sockets.forEach(function(socket) {
      socket.emit("file_update");
    });
  });
});
io.sockets.on('connection', function(socket) {
  socket.on('disconnect',function() {
    sockets.splice(sockets.indexOf(socket),1);
  });
  sockets.push(socket);
});
app.get('/', function(req, res) {
  res.pageTitle="Hello";
  res.render('index.jade', {
    pageTitle:"Remote LaTeX Viewer: " + settings.file,
    port:settings.port
  });
});

app.get('/file.pdf', function(req, res) {
  fs.exists(settings.destination, function(exists) {
    var writeRes = function() {
      fs.readFile(settings.destination, function(err, data) {
        if (err === undefined || err === null) {
          res.write(data);
        } else {
          console.log(err);
        }
        res.end();
      });
    };
    if (exists) {
      writeRes();
    } else {
      console.log("COMPILE");
      compileTex(settings.file,settings.destination,writeRes);
    }
  });
});
