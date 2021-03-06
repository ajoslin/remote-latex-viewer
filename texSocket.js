var io = require('socket.io');
var fs = require('fs');
var exec = require('child_process').exec;
module.exports = function texSocket(app) {
  var self = this;
  io = io.listen(app, {'log level': 0});
  var sockets = [];
  io.on('connection', function(socket) {
    sockets.push(socket);
    socket.on('disconnect', function() {
      sockets.splice(sockets.indexOf(socket),1);
    });
  });
  this.notifyStartCompile = function notifyStartCompile() {
    sockets.forEach(function(socket) {
      socket.emit("file_start_compile");
    });
  };
  this.notifyUpdate = function notifyUpdate(error) {
    sockets.forEach(function(socket) {
      socket.emit("file_update");
    });
  };
};
