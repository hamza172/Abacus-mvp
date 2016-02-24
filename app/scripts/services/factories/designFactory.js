'use strict';

/*
* This Factory creates a Design object
* Designs contain a wheelchair reference and a creator field linking the design back to the creator of the wheelchair
*/


angular.module('abacuApp')
  .factory('Design', ['Wheelchair', function (Wheelchair) {
  	var Design = function (designObj) {
  		this.id = designObj._id;
  		this.creator = designObj.creator;
  		this.wheelchair = new Wheelchair(designObj.wheelchair);
  	};

  	return Design;
  }]);