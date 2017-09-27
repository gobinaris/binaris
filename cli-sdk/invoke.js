const util = require('./util');
const { invoke } = require('../sdk');

// invokes a binaris function that you have previously
// deployed either through the CLI or other means
const invokeCLI = async function invokeCLI(funcPath, funcData) {
  const binarisConf = util.loadBinarisConf(funcPath);
  const funcName = util.getFuncName(binarisConf);
  return invoke(funcName, funcData);
};

module.exports = invokeCLI;
