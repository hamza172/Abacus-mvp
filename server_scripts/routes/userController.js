/**
 * Contains any necessary CRUD routes for user object
 */
'use strict';

var router = require('express').Router();
var _ = require('lodash');
var promise = require('bluebird');

// Import services
var update = require('../services/user').update;
var fixObject = require('../services/user').fixObject;
var dbUtils   = require('../services/dbUtils');
var dbService = require('../services/db');
var updateOrInsertAllEntriesPr = promise.promisify(dbUtils.updateOrInsertAllEntries);
var getUserPr = promise.promisify(dbService.users.get);
var hash      = require('../services/security').hash;
var check     = require('../services/security').check;
// Import policies
var restrict = require('../policies/restrict');

//var _designFunctionId = '69777e82324ef175df6ee184cc7c93cd'; //uncomment this line to use the Testing Database called intelliwheels-Testin
var _designFunctionId = '90e3fa2f51a7470a708c7aede3121ccf'; //uncomment this line to use the Real Database called intelliwheels

//UPDATE USER INFO
//TODO: find out if cloudant allows single field update. i.e. update only fName or lName.
router.post('/update', restrict, function (req, res) {
  //Retrieve request parameters that we need, ignoring any others.
  var data = {
    fName: req.body.fName,
    lName: req.body.lName,
    email: req.body.email,
    phone: req.body.phone,
    addr: req.body.addr,
    addr2: req.body.addr2,
    city: req.body.city,
    state: req.body.state,
    zip: req.body.zip,
    oldPass: req.body.oldPass,
    newPass1: req.body.newPass1,
    newPass2: req.body.newPass2,
    unitSys: 0,
    currentWheelchair: req.body.currentWheelchair,
    // Linked fields
    cart: req.body.cart || null,
    orders: req.body.orders || [],
    savedDesigns: req.body.savedDesigns || []
  };
  update(data, req.session.user, function (err, body, errNo, updatedUserObj) { //Main update logic, passing data as new obj and the session cookie as the key
    //CALLBACK
    if (body) {
      //Regenerate the session cookie
      req.session.regenerate(function () {
        req.session.user = body.id;
        var message = '';
        //Use the error number to alert the user
        switch (errNo) {
          case 1: message = 'New password is not valid';
                break;
          case 2: message = 'Current password is incorrect';
                break;
          case 3: message = 'Password Changed';
                break;
        }
        res.json({
          'err': err,
          'message': message,
          'user': updatedUserObj
        });
      });
    } else {
      res.json({
        'err': err,
        'user': updatedUserObj
      });
    }
  });
});

router.post('/update-current-wheelchair', restrict, function (req, res) {
  var updateData = {
    'currentWheelchair': req.body.currentWheelchair
  }
  updateUserObj(updateData, req, res);
});

router.post('/update-saved-designs', restrict, function (req, res) {
  var updateData = {
    'savedDesigns': req.body.savedDesigns
  }
  updateUserObj(updateData, req, res);
});

router.post('/update-user-info', restrict, function (req, res) {
  var errNo = null;
  var obj = {
    fName: req.body.fName,
    lName: req.body.lName,
    email: req.body.email,
    phone: req.body.phone,
    addr: req.body.addr,
    addr2: req.body.addr2,
    city: req.body.city,
    state: req.body.state,
    zip: req.body.zip,
    oldPass: req.body.oldPass,
    newPass1: req.body.newPass1,
    newPass2: req.body.newPass2
  };
  var userID = req.session.user;
  getUserPr(req.session.user)
  .then(function (existing) {
    //Sanitize the obj to be inserted
    fixObject(obj, existing);
    obj._rev = existing._rev;
    //Set the password in the object, may be replaced later
    obj.password = existing.password;
    obj.salt = existing.salt;

    if (!obj.newPass1 || obj.newPass1.length < 8 || obj.newPass1 !== obj.newPass2) {
      if (obj.newPass1 && obj.newPass1.length < 8 || obj.newPass1 !== obj.newPass2) {
        errNo = 1;
      }
      delete obj.oldPass;
      delete obj.newPass1;
      delete obj.newPass2;

      dbService.users.atomic(_designFunctionId, 'inplace', req.session.user, obj, cb);
    } else {
      hash(obj.oldPass, existing.salt, function (err, oldHash) {
        if (oldHash !== existing.password) {
          delete obj.oldPass;
          delete obj.newPass1;
          delete obj.newPass2;
          errNo = 2;
          dbService.users.atomic(_designFunctionId, 'inplace', req.session.user, obj, cb);
        } else {
          hash(obj.newPass1, function (err, salt, hash) {
            if (err) throw err;
            obj.password = hash;
            obj.salt = salt;
            delete obj.oldPass;
            delete obj.newPass1;
            delete obj.newPass2;
            errNo = 3;
            dbService.users.atomic(_designFunctionId, 'inplace', req.session.user, obj, cb);
          });
        }
      });
    }

    function cb(err, resp) {
      if (errNo) {
        req.session.regenerate(function () {
          req.session.user = userID;
          var message = '';
          switch (errNo) {
            case 1: message = 'New password is not valid';
                  break;
            case 2: message = 'Current password is incorrect';
                  break;
            case 3: message = 'Password Changed';
                  break;
          }
          res.json({
            'err': err,
            'message': message,
            'user': obj
          });
        });
      } else {
        req.session.regenerate(function () {
          req.session.user = userID;
          res.json({
            'err': err,
            'user': obj
          });
        });
      }
    }
  })
  .catch(function(err) {
    res.json({
      'err': err
    });
  })
});

router.post('/update-cart', restrict, function (req, res) {
  var cart = req.body.cart;
  updateOrInsertAllEntriesPr({
      db: dbService.orders,
      dbInsert: dbUtils.insertOrder,
      idField: '_id',
      entries: [cart]
    }).then(function (cartArr) {
      var cart = _.first(cartArr);
      var updateData = {
        'cart': cart.id
      };
      var userID = req.session.user;
      dbService.users.atomic(_designFunctionId, 'inplace', userID, updateData, cb);
      function cb(error, response) {
        if (error) {
          res.json({
            'err': error
          });
        } else {
          req.session.regenerate(function () {
            req.session.user = userID;
            updateData._rev = response;
            updateData.userID = userID;
            res.send(cart);
          });
        }
      }
    })
    .catch(function(err) {
      res.json({
        'err': err
      });
    })
});

function updateUserObj(updateData, req, res) {
  var userID = req.session.user;
  dbService.users.atomic(_designFunctionId, 'inplace', userID, updateData, cb);
  function cb(error, response) {
    if (error) {
      res.json({
        'err': error
      });
    } else {
      req.session.regenerate(function () {
        req.session.user = userID;
        updateData._rev = response;
        updateData.userID = userID;
        res.send(updateData);
      });
    }
  }
}

module.exports = router; // expose the router
