// jshint unused:false
/* globals frameDataFromDB:true, cartDataFromDB:true, curWheelchair:true, $ */
'use strict';

/**
 * @ngdoc function
 * @name abacuApp.static factory:orderFactory
 * @description
 * # orderFactory
 * Service of the abacuApp
 */
angular.module('abacuApp')
  .factory('orderFactory', ['$http', 'userFactory', function ($http){



    return{
      all: function(){
        return $http({method:"GET", url:"data/orderData.json"});
      },
      create: function(info){
        return $http({method:"POST", url:"data/orderData.json", data:info});
      }
    };
  }]);
