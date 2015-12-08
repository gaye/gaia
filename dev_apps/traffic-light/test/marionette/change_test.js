var assert = require('assert');

marionette('traffic light', function() {
  var client = marionette.client();

  setup(function() {
    client.setSearchTimeout(10000);
    client.apps.launch('app://traffic-light.gaiamobile.org');
    client.apps.switchToApp('app://traffic-light.gaiamobile.org');
  });

  test('clicking should change colors', function() {
    var element = client.findElement('#light');
    waitForColor(client, element, 'red');
    element.click();
    waitForColor(client, element, 'green');
    element.click();
    waitForColor(client, element, 'yellow');
    element.click();
    waitForColor(client, element, 'red');
  });
});

function waitForColor(client, element, color) {
  client.waitFor(function() {
    return element.getAttribute('class') === color;
  });
}
