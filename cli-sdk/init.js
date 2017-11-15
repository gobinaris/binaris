const fse = require('fs-extra');
const path = require('path');
const moniker = require('moniker');

const { validateName } = require('./nameUtil');
const YMLUtil = require('./binarisYML');

const templateDir = './functionTemplates/nodejs/';

/**
 * Initializes a Binaris function with the given name at the
 * provided path. If a name is not provided one will be randomly
 * generated.
 *
 * @param {string} functionName - the name of the function to initialize
 * @param {string} functionPath - the path to initialize the function at
 * @returns {string} - the final name selected for the function
 */
const init = async function init(functionName, functionPath) {
  // removing the '-' from monikers string is required because they
  // don't allow the glue string to be empty.
  const finalName = functionName || moniker.choose().replace(/-/g, '');
  validateName(finalName);
  // parse the templated yml and make the necessary modifications
  const templatePath = path.join(__dirname, templateDir);
  const binarisConf = await YMLUtil.loadBinarisConf(templatePath);
  const templateName = YMLUtil.getFuncName(binarisConf);
  const funcConf = YMLUtil.getFuncConf(binarisConf, templateName);
  // replace the generic function name with the actual name
  YMLUtil.addFuncConf(binarisConf, finalName, funcConf);
  YMLUtil.delFuncConf(binarisConf, templateName);
  // now write out all the files that have been modified
  const file = funcConf.file;
  await fse.copy(path.join(__dirname, templateDir, file), path.join(functionPath, file));
  await YMLUtil.saveBinarisConf(functionPath, binarisConf);
  return finalName;
};

module.exports = init;
