﻿// jshint unused:false
/* globals frameDataFromDB:true, cartDataFromDB:true, curWheelchair:true, $ */
'use strict';

/**
 * @ngdoc function
 * @name abacuApp.controller:InfoCtrl
 * @description
 * # InfoCtrl
 * Controller of the abacuApp
 */
angular.module('abacuApp')
  .controller('OrderCtrl', function ($scope, $location, sharedVars) {

    /*************************** CONTROL VARIABLES *************************/
    $scope.stages = {
      INFO: 0,
      PAYMENT: 1,
      CONFIRM: 2,
      COMPLETE: 3
    }

    $scope.curStage = $scope.stages.INFO;


    $scope.display = [
      { //INFO
        title: "YOUR INFO",
        button: "PAYMENT >"
      },
      { //PAYMENT
        title: "PAYMENT",
        button: "CONFIRM >"
      },
      { //CONFIRM
        title: "ORDER CONFIRMATION",
        button: "COMPLETE >"
      },
      { //COMPLETE
        title: "COMPLETE",
        button: "GO TO MY ORDER >>"
      }
    ]

    /*************************** SIDEBAR BUTTONS ************************/

    //Return to the previous stage of checkout
    $scope.back = function () {
      switch ($scope.curStage) {
        case $scope.stages.INFO:
          //TODO: Implement this
          //If guest, return to 'checkout'
          $location.path('/checkout');
          //If logged in, return to 'cart'
          //$location.path('/cart');
          break;
        case $scope.stages.PAYMENT:
        case $scope.stages.CONFIRM:
        case $scope.stages.COMPLETE:
          $scope.curStage--;
          break;
      }
    };

    //Advance to the next stage of checkout (Payment)
    $scope.next = function () {
      switch ($scope.curStage) {
        case $scope.stages.INFO:
          //TODO: Verify inputs to contactForm and shippingForm
          alert(JSON.stringify($scope.contactForm));
          alert(JSON.stringify($scope.shippingForm));

          $scope.curStage++;
          break;
        case $scope.stages.PAYMENT:
          alert(JSON.stringify($scope.payForm.method));
          $scope.curStage++;
          break;
        case $scope.stages.CONFIRM:
          if (!$scope.termsForm.hasReadTerms) {
            alert("You must accept the Terms and Conditions to continue");
            return;
          }
          //TODO: Send the order
          $scope.curStage++;
          break;
        case $scope.stages.COMPLETE:
          //TODO: Send user to "orders" page (Settings-MyOrders?)
          alert("YAY!");
          break;
      }
    };

    /*************************** INFO ******************************/

    //Model for the contact form
    $scope.contactForm = {
      fName: "",
      lName: "",
      email: "",
      phone: ""
    };

    //Model for the shipping form
    $scope.shippingForm = {
      addr: "",
      addr2: "",
      city: "",
      state: "",
      zip: ""
    };

    //Return the user to their cart
    $scope.returnToCart = function () {
      $location.path('/cart');
    };

    /**************************** PAYMENT ******************************/

    //Payment Method radio buttons
    $scope.payMethods = {
      PAYPAL: 'paypal',
      ADVANCE: 'advance'
    };

    //User's choice of payment method
    $scope.payForm = {
      method: $scope.payMethods.ADVANCE
    };

    /**************************** CONFIRM ******************************/

    //T&C Checkbox model
    $scope.termsForm = {
      hasReadTerms: false
    };


    /**************************** COMPLETE *****************************/


  });
