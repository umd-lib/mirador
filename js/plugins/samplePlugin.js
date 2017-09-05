(function($) {
  $.Plugin = function(options) {
    this.init();
  };

  $.Plugin.prototype = {

  	init: function() {
  		console.log('Plugin Loaded');
  	},

  	test: function() {
  		console.log('The plugin is being tested');
  	}
  };
}(Mirador));