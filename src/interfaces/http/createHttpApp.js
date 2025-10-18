const path = require('path');
const express = require('express');
const { createHttpRouter } = require('./createHttpRouter');

/** @typedef {import('./createHttpRouter').HttpRouteDependencies} HttpRouteDependencies */

/**
 * Builds an Express application configured with HTTP routes and static assets.
 * @param {HttpRouteDependencies} dependencies
 * @returns {import('express').Express}
 */
function createHttpApp(dependencies) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(path.join(__dirname, '..', '..', '..', 'public')));
  app.use(createHttpRouter(dependencies));
  return app;
}

module.exports = {
  createHttpApp,
};
