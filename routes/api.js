const Conf = require('conf')
const router = require('express').Router()
const { getFiles } = require('../utils')

// Configurations
const config = new Conf({ projectName: 'MBTiles Server' })

/**
 * Route for API
 */
router.route('/')
  .all((req, res) => {
    const PROTOCOL = config.get('PROTOCOL')
    const PORT = config.get('PORT')
    const CACHE = config.get('CACHE')

    res.json({
      api: `MBTiles Server ${require('../package.json').version}`,
      http: {
        GET: [
          '/<mbtiles>',
          '/<mbtiles>/{zoom}/{x}/{y}',
          '/<mbtiles>/WMTS',
          '/<mbtiles>/WMTS/1.0.0/WMTSCapabilities.xml'
        ]
      },
      mbtiles: getFiles(CACHE, /\.mbtiles$/),
      ok: true,
      protocol: PROTOCOL,
      cache: CACHE,
      port: PORT,
      status: 200
    })
  })

module.exports = router
