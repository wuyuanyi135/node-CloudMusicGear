var express = require('express');
var request = require('request');
var url = require('url');
var fs = require('fs');
var cmg = require('./CMG.js');



const serverPort = 80;



app = express();

// Default : proxy to remoteUrl
app.use('*', function(req, res){
    var uri = req._parsedUrl;

    if (!uri.host) {
        uri.host = req.headers['host'];
    }
    if (!uri.protocol) {
        uri.protocol = 'http';
    }
    var originalHost = uri.host;
    if (uri.host.indexOf('music') === -1) {
        // host must contain music
    } else if (req.originalUrl.indexOf('.mp3') !== -1) {
        //contains .mp3 extension
        uri.host = cmg.Config.IpAddress;
    }

    uri.host = cmg.Config.IpAddress;

    uri = url.format(uri);
    headers = {};
    headers = req.headers;
    headers.Host = originalHost;
    var options = {
      url: uri,
      gzip: true,       //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      headers: headers,
      encoding: null,
      method: req.method,
      body: req.body
    };


    //r = request(options, (e, r, d)=>responseHandler(e,r,d,res));
    r = request(options);
    var data = new Buffer([]);
    // var data = []
    var response;
    req.pipe(r)
        .on('response', (resp) => response = resp)
        .on('error', (error)=>{console.log(error);})
        .on('data',  (ndata) => { const tmp =  Buffer.concat([data, ndata]); data = null; data = tmp; global.gc(); })
        .on('end', ()=>{cmg.onResponse(response, data,  res)})
        // .pipe(res);

});

app.listen(serverPort);
console.log('Server started');
