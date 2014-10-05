define(function(require, exports) {
'use strict';

var debug = require('debug')('provider');
var isOnline = require('online');
var local = require('./local');
var worker = require('./worker');

var app;
var calendarStore;
var eventStore;

Object.defineProperty(exports, 'app', {
  get: function() {
    return app;
  },

  set: function(value) {
    app = value;
    local.app = value;
    worker.app = value;
    calendarStore = value.store('Calendar');
    eventStore = value.store('Event');
  }
});

exports.isLocal = local.isLocal;

exports.getAccount = function(account) {
  return request('getAccount', { account: account });
};

exports.findCalendars = function(account) {
  return request('findCalendars', { account: account });
};

exports.syncEvents = function(account, calendar) {
  return request('syncEvents', { account: account, calendar: calendar });
};

exports.ensureRecurrencesExpanded = function(maxDate) {
  return request('ensureRecurrencesExpanded', { maxDate: maxDate });
};

exports.createEvent = function(event, busytime) {
  return eventStore.ownersOf(event).then((owners) => {
    return request('createEvent', {
      busytime: busytime,
      event: event,
      owners: owners
    });
  });
};

exports.updateEvent = function(event, busytime) {
  return eventStore.ownersOf(event).then((owners) => {
    return request('updateEvent', {
      busytime: busytime,
      event: event,
      owners: owners
    });
  });
};

exports.deleteEvent = function(event, busytime) {
  return eventStore.ownersOf(event).then((owners) => {
    return request('deleteEvent', {
      busytime: busytime,
      event: event,
      owners: owners
    });
  });
};

exports.createICalComponentForEvent = function(event) {
  return eventStore.ownersOf(event).then((owners) => {
    return request('createICalComponentForEvent', {
      event: event,
      owners: owners
    });
  });
};

exports.calendarCapabilities = function(calendar) {
  return calendarStore.ownersOf(calendar).then((owners) => {
    return request('calendarCapabilities', {
      calendar: calendar,
      owners: owners
    });
  });
};

exports.eventCapabilities = function(event) {
  return eventStore.ownersOf(event).then((owners) => {
    return request('eventCapabilities', {
      event: event,
      owners: owners
    });
  });
};

function request(method, options) {
  debug('Received request for ' + method);
  ensureReady();

  var account, calendar;
  if ('owners' in options) {
    options.account = account = options.owners.account;
    options.calendar = calendar = options.owners.calendar;
    options.details = options.owners;
  } else {
    account = options.account;
    calendar = options.account;
    options.details = { account: account, calendar: calendar };
  }

  var isLocal = method === 'ensureRecurrencesExpanded' ||
                (account && local.isLocal(account));
  debug('Operation on ' + (isLocal ? 'local' : 'remote') + ' calendar.');

  if (isLocal) {
    switch (method) {
      case 'calendarCapabilities':
      case 'eventCapabilities':
      case 'findCalendars':
      case 'getAccount':
      case 'syncEvents':
        debug('Route request to local provider.');
        return local[method].call(null, options);
    }
  }

  if (!isLocal && !isOnline()) {
    debug('Cannot fulfill requests for networked calendars when offline.');
    return Promise.reject(createOfflineError());
  }

  options.sync = !isLocal;
  debug('Route request to worker provider.');
  return worker[method].call(null, options);
}

/**
 * Create an error for the case when we're trying to perform a network
 * operation but we're not Internet-connected.
 */
function createOfflineError() {
  var l10n = window.navigator.mozL10n;
  var error = new Error();
  error.name = 'offline';
  error.message = l10n.get('error-offline');
  return error;
}

function ensureReady() {
  if (!app) {
    debug('Provider was not initialized!');
    return Promise.reject(new Error('Provider was not initialized!'));
  }
}

});
