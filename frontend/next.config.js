const { PHASE_PRODUCTION_BUILD } = require("next/constants")

module.exports = (phase) => ({
  ...(phase === PHASE_PRODUCTION_BUILD ? { output: "standalone" } : {}),
})
