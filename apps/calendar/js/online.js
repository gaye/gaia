define(function(require, exports, module) {
'use strict';

module.exports = function() {
  if (!navigator || !('onLine' in navigator)) {
    return false;
  }

  return navigator.onLine;
};

});
