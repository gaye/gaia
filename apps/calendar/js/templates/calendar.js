define(function(require, exports, module) {
'use strict';

var create = require('template').create;
var local = require('provider/local');

module.exports = create({
  item: function() {
    var id = this.h('_id');
    var l10n = '';
    var name = '';

    // localize only the default calendar; there is no need to set the name
    // the [data-l10n-id] will take care of setting the proper value
    if (id && local.calendarId === id) {
      // localize the default calendar name
      l10n = 'data-l10n-id="calendar-local"';
    } else {
      name = this.h('name');
    }

    var checked = this.bool('localDisplayed', 'checked');

    return `<li id="calendar-${id}" class="calendar-id-${id}">
        <div class="gaia-icon icon-calendar-dot calendar-text-color"></div>
        <label class="pack-checkbox">
          <input value="${id}" type="checkbox" ${checked} />
          <span ${l10n} class="name">${name}</span>
        </label>
      </li>`;
  }
});

});
