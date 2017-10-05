// here we just grab all our SDK functions that we plan to use
// invoke, destroy, help, info, login, logout, signup
const { init, invoke, deploy, remove } = require('./cli-sdk');

// create our basic logger
const log = require('./logger');

// our core modules
const fs = require('fs');
const path = require('path');

// our 3rd party modules
const commander = require('commander');
const colors = require('colors');

const errorMessageAndExit = function errorMessageAndExit() {
  log.info('For more information set the BINARIS_LOG_LEVEL environment variable to debug, verbose, info, warn or error');
  process.exit(1);
};

// attempts to parse a json and throws if an issue is encountered
const attemptJSONParse = function attemptJSONParse(rawJSON) {
  try {
    const parsedJSON = JSON.parse(rawJSON);
    if (parsedJSON && typeof parsedJSON === 'object') {
      return parsedJSON;
    }
  } catch (err) {
    log.debug(err);
  }
  throw new Error('Invalid JSON received, unable to parse');
};

function getFuncPath(options) {
  return path.resolve(options.path || process.cwd());
}

// initializes a binaris function based on the options given by
// the user
// this essentially boils down to creating template files with
// the correct information in the correct location
const initHandler = async function initHandler(options) {
  // now we actually call our initialize function and then immediately
  // determine if was successfully completed
  const functionPath = getFuncPath(options);
  try {
    const finalName = await init(options.functionName, functionPath);
    log.info(`Initialized function: ${finalName}`);
    log.info(`To deploy:\n  cd ${functionPath}/${finalName}\n  bn deploy`);
  } catch (err) {
    log.error(err.message.red);
    errorMessageAndExit();
  }
};

// simply handles the process of deploying a function and its
// associated metadata to the Binaris cloud
const deployHandler = async function deployHandler(options) {
  log.info('Deploying function...');
  try {
    const funcPath = getFuncPath(options);
    const funcEndpoint = await deploy(funcPath);
    log.info(`Function deployed. To invoke use:\n  curl ${funcEndpoint}\nor\n  bn invoke`);
  } catch (err) {
    log.error(err.message.red);
    errorMessageAndExit();
  }
};

// Removes a binaris function that you previously deployed.
const removeHandler = async function removeHandler(options) {
  try {
    const { functionName } = options;
    const funcPath = getFuncPath(options);

    if (!functionName && !funcPath) {
      throw new Error('Missing function name. Use --path or --functionName');
    }
    log.info(`Removing function: ${functionName || funcPath }...`);
    await remove(functionName, funcPath);
    log.info('Function removed');
  } catch (err) {
    log.error(err.message.red);
    errorMessageAndExit();
  }
};

// invokes a binaris function that you have previously
// deployed either through the CLI or other means
const invokeHandler = async function invokeHandler(functionName, options) {
  if (options.file && options.json) {
    log.error('Options json (-j) and file (-f) cannot be provided together'.red);
    errorMessageAndExit();
  }
  const funcPath = getFuncPath(options);
  let funcData;
  try {
    let payloadJSON;
    if (options.json) {
      payloadJSON = options.json;
    } else if (options.file) {
      try {
        payloadJSON = fs.readFileSync(options.file, 'utf8');
      } catch (err) {
        throw new Error(`Invalid JSON file path: ${options.file}`);
      }
    }

    if (payloadJSON) {
      funcData = attemptJSONParse(payloadJSON);
      log.debug({ funcData });
    }

    const response = await invoke(funcPath, functionName, funcData);
    if (response.statusCode !== 200) {
      log.warn(`Function returned non standard status: ${response.statusCode}`.yellow);
    }
    console.log(response.body);
  } catch (err) {
    log.error(err.message.red);
    errorMessageAndExit();
  }
};

commander
  .version('0.0.1')
  .description('Binaris command line interface');

commander
  .command('init')
  .description('Initialize a function from template')
  .option('-f, --functionName <functionName>', 'name for the generated fucntion (if omitted, a name will be chosen at random)')
  .option('-p, --path <path>', 'directory for the generated function (default is cwd)')
  .action(initHandler);

commander
  .command('deploy')
  .description('Deploys a function to the cloud')
  .option('-p, --path <path>', 'path to function direcotry (where binaris.yml is)')
  .action(deployHandler);

commander
  .command('remove')
  .description('Remove a function from the cloud')
  .option('-f, --functionName <functionName>', 'name of function to remove')
  .option('-p, --path <path>', 'path to function')
  .action(removeHandler);

commander
  .command('invoke <functionName>')
  .description('Invoke a function on the cloud')
  .option('-p, --path <path>', 'path to function')
  .option('-j, --json <json>', 'JSON data to pass as event.body')
  .option('-f, --filePath <filePath>', 'path to a JSON file containing data to pass as event.body')
  .action(invokeHandler);

commander
  .command('*', null, { noHelp: true })
  .description('')
  .action((env) => {
    log.info(`Unknown command: ${env}`.red);
    commander.outputHelp();
    process.exit(1);
  });

commander
  .parse(process.argv);

if (!process.argv.slice(2).length) {
  commander.outputHelp();
}

