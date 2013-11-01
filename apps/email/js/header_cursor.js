/**
 * @fileoverview Bug 918303 - HeaderCursor added to provide MessageListCard and
 *     MessageReaderCard the current message and whether there are adjacent
 *     messages that can be advanced to.
 */
define(function(require) {
  var array = require('array'),
      evt = require('evt'),
      model = require('model');

  /**
   * @constructor
   */
  function HeaderCursor() {
    // Inherit from evt.Emitter.
    evt.Emitter.call(this);

    // Listen to model for folder changes.
    this.onLatestFolder = this.onLatestFolder.bind(this);
    model.latest('folder', this.onLatestFolder);
  }

  HeaderCursor.prototype = evt.mix({
    /**
     * @type {CurrentMessage}
     */
    currentMessage: null,

    /**
     * @type {HeadersViewSlice}
     */
    messagesSlice: null,

    /**
     * The messageReader told us it wanted to advance, so we should go ahead
     * and update our currentMessage appropriately and then report the new one.
     *
     * @param {string} direction either 'next' or 'previous'.
     */
    advance: function(direction) {
      var index = this.indexOfMessageById(this.currentMessage.header.id);
      switch (direction) {
        case 'previous':
          index -= 1;
          break;
        case 'next':
          index += 1;
          break;
      }

      var messages = this.messagesSlice.items;
      if (index < 0 || index >= messages.length) {
        // We can't advance that far!
        return;
      }

      this.setCurrentMessage(messages[index]);
    },

    /**
     * @param {MailHeader} header message header.
     * @private
     */
    setCurrentMessage: function(header) {
      if (!header) {
        return;
      }

      var index = this.indexOfMessageById(header.id);
      var messages = this.messagesSlice.items;
      var currentMessage = new CurrentMessage(header, {
        hasPrevious: index !== 0,                 // Can't be first
        hasNext: index !== messages.length - 1    // Can't be last
      });

      this.emit('currentMessage', currentMessage);
      this.currentMessage = currentMessage;
    },

    /**
     * @param {string} id message id.
     * @return {number} the index of the message cursor's current message
     *     in the message slice it has checked out.
     */
    indexOfMessageById: function(id) {
      var messages = this.messagesSlice.items;
      return array.indexOfGeneric(messages, function(message) {
        return message.id === id;
      });
    },

    /**
     * @param {Object} folder the folder we switched to.
     */
    onLatestFolder: function(folder) {
      // It is possible that the notification of latest folder is fired
      // but in the meantime the foldersSlice could be cleared due to
      // a change in the current account, before this listener is called.
      // So skip this work if no foldersSlice, this method will be called
      // again soon.
      if (!model.foldersSlice) {
        return;
      }

      this.die();

      this.messagesSlice = model.api.viewFolderMessages(folder);
      this.messagesSlice.onremove = this.onMessagesSpliceRemove.bind(this);
    },

    /**
     * Choose a new currentMessage if we spilled the existing one.
     * Otherwise, emit 'currentMessage' event to update stale listeners
     * in case we spilled a sibling.
     *
     * @param {MailHeader} removedHeader header that got removed.
     * @param {number} removedFromIndex index header was removed from.
     */
    onMessagesSpliceRemove: function(removedHeader, removedFromIndex) {
      if (this.currentMessage !== removedHeader) {
        // Emit 'currentMessage' event in case we're spilling a sibling.
        return this.setCurrentMessage(this.currentMessage);
      }

      var messages = this.messagesSlice.items;
      if (messages.length === 0) {
        // No more messages... sad!
        return this.currentMessage = null;
      }

      var index = Math.min(removedFromIndex, messages.length - 1);
      var message = this.messagesSlice.items[index];
      this.setCurrentMessage(message);
    },

    die: function() {
      if (this.messagesSlice) {
        this.messagesSlice.die();
        this.messagesSlice = null;
      }

      this.currentMessage = null;
    }
  });

  /**
   * @constructor
   * @param {MailHeader} header message header.
   * @param {Object} siblings whether message has next and previous siblings.
   */
  function CurrentMessage(header, siblings) {
    this.header = header;
    this.siblings = siblings;
  };

  CurrentMessage.prototype = {
    /**
     * @type {MailHeader}
     */
    header: null,

    /**
     * Something like { hasPrevious: true, hasNext: false }.
     * @type {Object}
     */
    siblings: null
  };

  return {
    CurrentMessage: CurrentMessage,
    cursor: new HeaderCursor()
  };
});
