// Loads the browser engine files into this Node process, in dependency order.
['stats', 'trend', 'compare', 'pyramid', 'language', 'rules', 'narrate'].forEach(function (f) {
  require('../storyteller/engine/' + f + '.js');
});
module.exports = globalThis.SoochanaInsight;
