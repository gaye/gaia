define(function(require, exports) {
'use strict';

var Timespan = require('timespan');
var calc = require('calc');
var mochaPromise = require('test/support/mocha_promise');
var provider = require('provider/provider');

suite('provider w/ local calendar', function() {
  mochaPromise(setup, function() {
    var app = testSupport.calendar.app();
    app.serviceController.start();
    var db = app.db;
    return new Promise((resolve, reject) => {
      db.deleteDatabase((error, success) => {
        if (error) { return reject(error); }
        resolve(success);
      });
    })
    .then(() => {
      return new Promise((resolve, reject) => {
        db.load((error) => {
          if (error) { return reject(error); }
          provider.app = app;
          resolve();
        });
      });
    });
  });

  teardown(function() {
    provider.app.db.close();
  });

  mochaPromise(test, '#getAccount', function() {
    return provider.getAccount({ preset: 'local' }).then((account) => {
      assert.strictEqual(account.preset, 'local');
      assert.strictEqual(account.providerType, 'Local');
    });
  });

  mochaPromise(test, '#findCalendars', function() {
    return provider.getAccount({ preset: 'local' })
    .then((account) => {
      return provider.findCalendars(account);
    })
    .then((calendars) => {
      var local = calendars['local-first'];
      assert.strictEqual(local.id, 'local-first');
      assert.strictEqual(local.name, 'Offline calendar');
    });
  });

  mochaPromise(test, '#ensureRecurrencesExpanded', function() {
    var startDate = new Date();
    var endDate = new Date();
    endDate.setDate(startDate.getDate() + 1);

    var nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    var event = {
      title: 'Boomsday',
      location: 'Knoxville, TN',
      description: 'Celebrate Knoxville!',
      calendarId: 'local-first',
      start: calc.dateToTransport(startDate),
      end: calc.dateToTransport(endDate),
      alarms: [],
      freq: 'daily',
      until: calc.dateToTransport(nextMonth)
    };

    return provider.createEvent(event)
    .then(() => {
      var nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 8);
      return provider.ensureRecurrencesExpanded(nextWeek);
    })
    .then(() => {
      // We should now have busytimes in the busytime store
      // and time controller for this event every day
      // for the next week.
      var today = new Date();
      var nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 8);
      var timespan = new Timespan(today, nextWeek);

      var app = provider.app;
      var busytimeStore = app.store('Busytime');
      var timeController = app.timeController;
      var cachedBusytimes = timeController.queryCache(timespan);
      return Promise.all([
        busytimeStore.loadSpan(timespan),
        Promise.resolve(cachedBusytimes)
      ]);
    })
    .then((results) => {
      var [busytimes, cached] = results;

      assert.operator(busytimes.length, '>=', 7);
      assert.operator(cached.length, '>=', 7);
    });
  });

  mochaPromise(test, '#createEvent', function() {
    var startDate = new Date();
    var endDate = new Date();
    endDate.setDate(startDate.getDate() + 1);

    var event = {
      title: 'Boomsday',
      location: 'Knoxville, TN',
      description: 'Celebrate Knoxville!',
      calendarId: 'local-first',
      start: calc.dateToTransport(startDate),
      end: calc.dateToTransport(endDate),
      alarms: []
    };

    return provider.createEvent(event)
    .then(() => {
      // A few things should now be true:
      // 1. Should be able to fetch event from event store.
      // 2. Should be able to find corresponding busytime in busytime store.
      // 3. Should find busytime cached in interval tree.
      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      var tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      var timespan = new Timespan(yesterday, tomorrow);

      var app = provider.app;

      var busytimeStore = app.store('Busytime');
      var eventStore = app.store('Event');

      var timeController = app.timeController;
      var cachedBusytimes = timeController.queryCache(timespan);

      return Promise.all([
        eventStore.eventsForCalendar('local-first'),
        busytimeStore.loadSpan(timespan),
        Promise.resolve(cachedBusytimes)
      ]);
    })
    .then((results) => {
      var [events, busytimes, cachedBusytimes] = results;

      // #1
      assert.lengthOf(events, 1);
      var event = events[0];
      assert.strictEqual(event.calendarId, 'local-first');
      assert.strictEqual(event.remote.title, 'Boomsday');

      // #2
      assert.lengthOf(busytimes, 1);
      var busytime = busytimes[0];
      assert.strictEqual(busytime.eventId, event._id);

      // #3
      assert.lengthOf(cachedBusytimes, 1);
      var cachedBusytime = cachedBusytimes[0];
      assert.strictEqual(cachedBusytime._id, busytime._id);
    });
  });

  mochaPromise(test, '#updateEvent', function() {
    var startDate = new Date();
    var endDate = new Date();
    endDate.setDate(startDate.getDate() + 1);

    var event = {
      title: 'Boomsday',
      location: 'Knoxville, TN',
      description: 'Celebrate Knoxville!',
      calendarId: 'local-first',
      start: calc.dateToTransport(startDate),
      end: calc.dateToTransport(endDate),
      alarms: []
    };

    return provider.createEvent(event).then(() => {
      var app = provider.app;
      var eventStore = app.store('Event');
      return eventStore.eventsForCalendar('local-first');
    })
    .then((events) => {
      var event = events[0];
      // Move event one week into the future.
      var startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      var endDate = new Date();
      endDate.setDate(endDate.getDate() + 8);
      event.remote.start = calc.dateToTransport(startDate);
      event.remote.end = calc.dateToTransport(endDate);
      return provider.updateEvent(event);
    })
    .then(() => {
      // A few things should now be true:
      // 1. Should be able to fetch event from event store.
      // 2. Should find busytime in busytime store by updated span.
      // 3. Should find busytime cached by new timespan.
      var lower = new Date();
      lower.setDate(lower.getDate() + 6);
      var upper = new Date();
      upper.setDate(upper.getDate() + 8);
      var timespan = new Timespan(lower, upper);

      var app = provider.app;

      var busytimeStore = app.store('Busytime');
      var eventStore = app.store('Event');

      var timeController = app.timeController;
      var busytimes = timeController.queryCache(timespan);

      return Promise.all([
        eventStore.eventsForCalendar('local-first'),
        busytimeStore.loadSpan(timespan),
        Promise.resolve(busytimes)
      ]);
    })
    .then((results) => {
      var [events, busytimes, cached] = results;

      // #1
      assert.lengthOf(events, 1);
      var event = events[0];
      assert.strictEqual(event.calendarId, 'local-first');
      assert.strictEqual(event.remote.title, 'Boomsday');

      // #2
      assert.lengthOf(busytimes, 1);
      var busytime = busytimes[0];
      assert.strictEqual(busytime.eventId, event._id);

      // #3
      assert.lengthOf(cached, 1);
      var cachedBusytime = cached[0];
      assert.strictEqual(cachedBusytime._id, busytime._id);
    });
  });

  mochaPromise(test, '#deleteEvent', function() {
    var startDate = new Date();
    var endDate = new Date();
    endDate.setDate(startDate.getDate() + 1);

    var event = {
      title: 'Boomsday',
      location: 'Knoxville, TN',
      description: 'Celebrate Knoxville!',
      calendarId: 'local-first',
      start: calc.dateToTransport(startDate),
      end: calc.dateToTransport(endDate),
      alarms: []
    };

    return provider.createEvent(event)
    .then(() => {
      var app = provider.app;
      var eventStore = app.store('Event');
      return eventStore.eventsForCalendar('local-first');
    })
    .then((events) => {
      assert.lengthOf(events, 1);
      return provider.deleteEvent(events[0]);
    })
    .then(() => {
      // A few things should now be true:
      // 1. Should not be able to fetch event from event store.
      // 2. Should not be able to find corresponding busytime in busytime store.
      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      var tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      var timespan = new Timespan(yesterday, tomorrow);

      var app = provider.app;

      var busytimeStore = app.store('Busytime');
      var eventStore = app.store('Event');

      return Promise.all([
        eventStore.eventsForCalendar('local-first'),
        busytimeStore.loadSpan(timespan)
      ]);
    })
    .then((results) => {
      var [events, busytimes] = results;

      // #1
      assert.lengthOf(events, 0);
      // #2
      assert.lengthOf(busytimes, 0);
    });
  });
});

});
