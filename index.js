const fs = require('fs')
const Conf = require('./plugins/conf')
const mkdirp = require('mkdirp')
const express = require('express')
const bodyParser = require('body-parser')
const {EventEmitter} = require('events')
const DEFAULT = require('./config')

/**
 * Start Server
 *
 * @param {string} [options] Server Options
 * @param {string} [options.cache=~/mbtiles] CACHE file path
 * @param {string} [options.domain='localhost'] URL Domain
 * @param {string} [options.port=5000] URL Port
 * @returns {EventEmitter} EventEmitter
 * @example
 * server({cache: '/Users/mac/mbtiles', port: 5000, verbose: true})
 */
module.exports = function (options = {}) {
  const config = new Conf()
  config.set('PORT', options.port || DEFAULT.PORT)
  config.set('DOMAIN', options.domain || DEFAULT.DOMAIN)
  config.set('CACHE', options.cache || DEFAULT.CACHE)

  // Settings
  const app = express()
  app.use(bodyParser.json())
  app.set('json spaces', 2)
  app.use(bodyParser.urlencoded({ extended: true }))
  app.set('trust proxy', true)

  /**
   * Server
   */
  class Server extends EventEmitter {
    /**
     * Start Server
     *
     * @param {string} [options] Server Options
     * @param {string} [options.cache=~/mbtiles] CACHE file path
     * @param {string} [options.domain='localhost'] URL Domain
     * @param {string} [options.port=5000] URL Port
     * @returns {Promise<Object>} port
     */
    start (options = {}) {
      const port = options.port || DEFAULT.PORT
      const domain = options.domain || DEFAULT.DOMAIN
      const cache = options.cache || DEFAULT.CACHE
      options = {port, domain, cache}

      // Save local settings
      config.set('PORT', port)
      config.set('DOMAIN', domain)
      config.set('CACHE', cache)
      this.cache = cache

      // Create folder
      mkdirp.sync(cache)

      // Restart if file change detected
      fs.watchFile(cache, current => {
        this.restart(options)
      })

      return new Promise((resolve, reject) => {
        this.server = app.listen(port, () => {
          this.emit('start', options)
          return resolve(options)
        })
        this.server.on('error', error => {
          return reject(error)
        })
      })
    }

    /**
     * Shutdown Server
     *
     * @returns {Promise<void>}
     */
    close () {
      return new Promise(resolve => {
        if (!this.server) return resolve()
        this.server.close(() => {
          this.emit('end')
          this.server = undefined
          fs.unwatchFile(this.cache)
          return resolve()
        })
      })
    }

    /**
     * Restart Server
     *
     * @param {string} [options] Server Options
     * @param {string} [options.cache=~/mbtiles] CACHE file path
     * @param {string} [options.domain='localhost'] URL Domain
     * @param {string} [options.port=5000] URL Port
     * @returns {Promise<Object>} options
     */
    restart (options = {}) {
      return new Promise(resolve => {
        this.close().then(() => {
          this.start(options).then(options => {
            return resolve(options)
          })
        })
      })
    }
  }
  const ee = new Server()

  // Logging Middleware
  app.use((req, res, next) => {
    const log = {
      body: req.body,
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      method: req.method,
      url: req.originalUrl,
      query: req.query,
      params: req.params
    }
    ee.emit('log', log)
    next()
  })

  // Register Routes
  const routes = require('./routes')
  app.use(routes.permissions)
  app.use('/', routes.api)
  app.use('/', routes.mbtiles)
  app.use('/', routes.wmts)

  // Auto-start server
  ee.start(options)
  return ee
}
