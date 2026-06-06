'use strict';

const backupConfig = require('./config');
const connection = require('./connection');
const integrity = require('./integrity');
const storage = require('./storage');
const backupService = require('./backup-service');
const restoreService = require('./restore-service');

module.exports = {
  ...backupConfig,
  ...connection,
  ...integrity,
  ...storage,
  ...backupService,
  ...restoreService,
};
