'use strict';

var as = require('async'),
    fs = require('fs'),
    Imagemin = require('imagemin'),
    multer = require('multer'),
    AWS = require('aws-sdk'),
    config = require('./config.json');

var s3 = new AWS.S3(),
    s3Config = config.aws,
    min = config.compress;

s3.config.update(s3Config);

// Compression handler config
var upload = multer({ dest: min.tmp });
var files = upload.array(min.field, min.maxupload);

// Express setup
var express = require('express');
var app = express();

// ROUTE: compress
app.post('/compress', files, (req, res, next) => {
  let secure = req.secure && true;

  // if (secure && req.ip !== null) {
  if (secure && config.whitelist.indexOf(req.ip) >= 0) {
    as.each(req.files, (file, cb) => {
      // compress image
      new Imagemin()
        .src(file.path)
        .dest(file.destination)
        .run( (err, minified) => {
          if (err) {
            cb(`${file.pathname} failed`);
            return;
          }

          // create s3 formatted object
          let obj = {
            'ACL': 'public-read',
            'Bucket': s3Config.bucket,
            'ContentType': file.mimetype,
            'CacheControl': 'public,max-age=3600',
            'Key': min.dest + file.originalname,
            'Body': minified[0].contents
          };

          // send object to S3
          s3.putObject(obj, (err, s3_response) => {
            if (err) cb(`${file.pathname} failed`);
            fs.unlink(file.path);
            cb();
          });
        });
    }, (err) => {
      if (err) res.sendStatus(500).end();
      else res.sendStatus(200).end();
    });
  }
  else res.sendStatus(403).end();
});

// ROUTE: all others rejected
app.all('*', (req, res, next) => {
  res.sendStatus(403).end();
});

// Start server
let server = app.listen(8080);
