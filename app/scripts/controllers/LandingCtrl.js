/**
 * Created by zhoufeng on 7/27/15.
 */
angular.module('abacuApp')
  .controller('LandingCtrl', ['$scope', '$location',
    function ($scope, $location) {
      $scope.toFramePage = function(){
        $location.path('/frames');
      }
    }]);
