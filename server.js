/**
 * Created by Dhruv on 6/10/2015.
 */
var express = require('express');
var app = express();
app.use(express.static(__dirname + '/app'));
app.get('*', function(req, res) {
  res.sendfile('./app/index.html');
});
app.listen(8080);
