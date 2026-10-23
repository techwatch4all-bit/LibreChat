const { getEndpointsConfig } = require('~/server/services/Config');
const { hasOperatorControl } = require('~/server/middleware/roles/capabilities');

async function endpointController(req, res) {
  const operator = await hasOperatorControl({
    id: req.user?.id ?? req.user?._id?.toString(),
    role: req.user?.role ?? '',
    tenantId: req.user?.tenantId,
    idOnTheSource: req.user?.idOnTheSource ?? null,
  });
  if (!operator) {
    // Provider names, URLs, and configured model IDs are operator-only. End
    // users select only the semantic Chat/Work/Privacy model specs from /config.
    return res.json({});
  }
  const endpointsConfig = await getEndpointsConfig(req);
  return res.json(endpointsConfig);
}

module.exports = endpointController;
