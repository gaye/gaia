var Email = require('./lib/email');
var assert = require('assert');
var serverHelper = require('./lib/server_helper');

marionette('syncfailed', function() {
  var app;

  var client = marionette.client({
    settings: {
      // disable keyboard ftu because it blocks our display
      'keyboard.ftu.enabled': false
    }
  });

  var server = serverHelper.use(null, this);

  setup(function(done) {
    app = new Email(client);
    app.launch();
    app.manualSetupImapEmail(server);

    app.sendAndReceiveMessages([
      { to: 'testy@localhost', subject: 'One', body: 'Fish' },
      { to: 'testy@localhost', subject: 'Two', body: 'Fish' },
      { to: 'testy@localhost', subject: 'Red', body: 'Fish' },
      { to: 'testy@localhost', subject: 'Blue', body: 'Fish' }
    ]);

    // Kill the server so that future syncs will fail.
    server.kill(done);
  });

  test.skip('should not harm next previous', function() {
    app.tapRefreshButton();
    app.waitForToaster();

    // Toggle around a bit.
    app.tapEmailAtIndex(0);
    assert.strictEqual(app.getMessageReaderSubject(), 'Blue');

    app.advanceMessageReader(/* up */ false);
    assert.strictEqual(app.getMessageReaderSubject(), 'Red');

    app.advanceMessageReader(/* up */ false);
    assert.strictEqual(app.getMessageReaderSubject(), 'Two');

    app.advanceMessageReader(/* up */ false);
    assert.strictEqual(app.getMessageReaderSubject(), 'One');
  });
});
