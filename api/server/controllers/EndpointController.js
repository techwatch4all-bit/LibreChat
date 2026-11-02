const { getEndpointsConfig } = require('~/server/services/Config');

async function endpointController(req, res) {
  const endpointsConfig = await getEndpointsConfig(req);
  return res.json(endpointsConfig || {});
}

module.exports = endpointController;
