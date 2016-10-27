'use strict';

var aws = require('aws-sdk'),
    fs = require('fs'),
    zlib = require('zlib'),
    childProcess = require('child_process'),
    log4js = require('log4js'),
    logger = log4js.getLogger('Tinker DB backup'),
    JSONValidation = require('json-validation'),
    helper = require('sendgrid').mail;

var BUCKET, DB_LOGIN, DB_PASSWORD, ALEMAIL, SGAPIKEY;

var dbnames = ['design', 'users', 'orders', 'order_number', 'discounts'],
    todayDate = new Date(),
    today = todayDate.toISOString().substring(0, 10);

//calling backup bash scripts
var readDB = function (database) {
  logger.info('Backing up ' + database + ' database to local file');
  var path = 'backups/' + today + '-' + database + '-backup.json';
  //delete file if exists
  try {
    fs.accessSync(path, fs.F_OK);
    logger.warn('File '+ path + ' exists. Deleting');
    return new Promise((resolve, reject) => {
      fs.unlink(path, function(err) {
        if (err) {
          logger.error('Error while deleting ' + path + ' : ' + err);
          reject(err);
        } else {
          resolve();
        }
      });
    })
    .then(() => {
      return readDB(database);
    });
  } catch (e) {
    return new Promise((resolve, reject) => {childProcess.exec('bash couchdb-backup.sh  -b -H ' + DB_LOGIN + '.cloudant.com -d ' + database + ' -f ' + path + ' -u ' + DB_LOGIN + ' -p ' + DB_PASSWORD,
      function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        if (err) {
          logger.error('Error occuried while reading data from db ' + database + ': ' + err);
        } else {
          fs.readFile(path, (err, data) => {
            if (err) {
              logger.error('Error reading backup file: ' + err);
              reject(err);
            }

            try {
              JSON.parse(data);
              logger.info('Export of ' + database + ' to file completed successfully');
              resolve();
            } catch (err) {
              if (err.message.indexOf('Unexpected token : in JSON at position') > -1) {
                var errPosition = err.message.split(' ')[7],
                    errExample;
                if (errPosition > 1000) {
                  errExample = data.toString().substr(errPosition - 50, 100);
                } else {
                  errExample = data.toString().substr(errPosition - 10, 20);
                }
                logger.error(errExample);
              }
              logger.error(err.message);

              var failureMailHTML = 'Hello.<br>' +
                    '&nbsp;&nbsp;This email is autogenerated, please do not respond to it.<br><br>' +
                    '&nbsp;&nbsp;This is to inform you that backup for ' + todayDate.toDateString() +
                    ' <b>failed</b> due incorrect JSON document exported from <b>' + database + '</b> database.\n' +
                    '<i>' + err.message + '</i><br>' +
                    '<i>' + errExample + '</i>',
                  from_email = new helper.Email('do-not-reply@per4max.fit'),
                  to_email = new helper.Email(ALEMAIL),
                  subject = database.charAt(0).toUpperCase() + database.slice(1) + ' JSON parsing failed',
                  content = new helper.Content('text/html', failureMailHTML),
                  mail = new helper.Mail(from_email, subject, to_email, content);

              var sg = require('sendgrid')(SGAPIKEY);
              var request = sg.emptyRequest({
                method: 'POST',
                path: '/v3/mail/send',
                body: mail.toJSON(),
              });

              sg.API(request, function(error, response) {
                if(error){
                  logger.error('Failed reporting to ' + ALEMAIL);
                  logger.error('Please check Sendgrid configuration');
                } else {
                  logger.warn('This incident had been reported to ' + ALEMAIL);
                  return;
                }
              });
            }
          });
        }
      });});
  }
};

var writeBackupToS3 = function (database) {
  //writing backup file to S3
  logger.info('Writing backup of ' + database + ' to S3');
  var filename = today + '-' + database + '-backup.json';
  var path = 'backups/' + filename;

  var body = fs.createReadStream(path).pipe(zlib.createGzip());
  return new Promise((resolve, reject) => {new aws.S3({params: {Bucket: BUCKET, Key: filename}}).upload({Body: body}).
    on('httpUploadProgress', function(evt) {
      var progress = Math.round(evt.loaded/evt.total*100);
      logger.info('Uploading of ' + filename + ': ' + (progress === 100? (progress + '%'): (progress + '% ...')));
    }).
    send(function(err, data) {
      if (err) {
        logger.error('An error occuried while uploading file: ' + err);
        reject(err);
      }
      fs.unlink(path, function(err) {
        if (err) {
          logger.error('Error while deleting ' + path + ' : ' + err);
          reject(err);
        }
      });
      logger.info('File successfully uploaded at url ' + data.Location);
      resolve();
    });});
  };

var reportMissingEV = function (name) {
  var failureMailHTML = 'Hello.<br>' +
        '&nbsp;&nbsp;This email is autogenerated, please do not respond to it.<br><br>' +
        '&nbsp;&nbsp;This is to inform you that backup for ' + todayDate.toDateString() +
        ' <b>failed</b> due to missing <b>' + name + '</b> environment variable.\n' +
        'DB backup will fail until all required environment variables will be configured' +
        '<br><br>&nbsp;&nbsp;You can set this environment variables now for successfull next backup',
      from_email = new helper.Email('do-not-reply@per4max.fit'),
      to_email = new helper.Email(ALEMAIL),
      subject = name + ' environment variable missing',
      content = new helper.Content('text/html', failureMailHTML),
      mail = new helper.Mail(from_email, subject, to_email, content);

  var sg = require('sendgrid')(SGAPIKEY);
  var request = sg.emptyRequest({
    method: 'POST',
    path: '/v3/mail/send',
    body: mail.toJSON(),
  });

  sg.API(request, function(error, response) {
    if(error){
      logger.error('Failed reporting to ' + ALEMAIL);
      logger.error('Please check Sendgrid configuration');
    } else {
      logger.warn('This incident had been reported to ' + ALEMAIL);
      return;
    }
  });
}

var backup = function () {
  BUCKET = process.env.BACKUP_BUCKET,
  DB_LOGIN = process.env.BACKUP_DB_LOGIN,
  DB_PASSWORD = process.env.BACKUP_DB_PASSWORD,
  ALEMAIL = process.env.BACKUP_ALARM_EMAIL,
  SGAPIKEY = process.env.SENDGRID_API_KEY;

  if (!SGAPIKEY) {
    logger.error('SENDGRID_API_KEY environment variable must be specified');
    return;
  }

  if (!ALEMAIL) {
    logger.error('Please specify your email in BACKUP_ALARM_EMAIL environment variable');
    return;
  }

  if (!DB_LOGIN) {
    logger.error('Please specify CloudantDB login in BACKUP_DB_LOGIN environment variable');
    reportMissingEV('BACKUP_DB_LOGIN');
    return;
  }

  if (!DB_PASSWORD) {
    logger.error('Please specify CloudantDB password in BACKUP_DB_PASSWORD environment variable');
    reportMissingEV('BACKUP_DB_PASSWORD');
    return;
  }

  if (!BUCKET) {
    logger.error('Please specify AWS bucket in BACKUP_BUCKET environment variable');
    reportMissingEV('BACKUP_BUCKET');
    return;
  }

  if (!process.env.AWS_ACCESS_KEY_ID) {
    logger.error('Please specify AWS access key id in AWS_ACCESS_KEY_ID environment variable');
    reportMissingEV('AWS_ACCESS_KEY_ID');
    return;
  }

  if (!process.env.AWS_SECRET_ACCESS_KEY) {
    logger.error('Please specify AWS secret access key AWS_SECRET_ACCESS_KEY environment variable');
    reportMissingEV('AWS_SECRET_ACCESS_KEY');
    return;
  }

  dbnames.reduce((prom, database) => {
    return prom
      .then(() => {
        return readDB(database);
      });
  }, Promise.resolve())
    .then(() => {
      return dbnames.reduce((prom, database) => {
        return prom
          .then(() => {
            return writeBackupToS3(database);
          })
          .catch((err) => {
            console.log(err);

          })
      }, Promise.resolve());
    });
};

exports.backup = backup;
