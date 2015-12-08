const lights = ['red', 'green', 'yellow'];

/**
 * application state
 */
var index = 0;

function main() {
  var element = document.getElementById('light');
  element.addEventListener('click', function() {
    index = (index + 1) % lights.length;
    element.className = lights[index];
  });
}

window.onload = main;
