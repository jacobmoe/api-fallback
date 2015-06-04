import path from 'path'

import packageJson from '../../../package.json'
import utils from '../utils'
import projects from '../storage/projects'

import * as defaults from './defaults'

const name = packageJson.name
let configName = '.' + name + '.json'

if (process.env.NODE_ENV === 'test') {
  configName = configName + '.test'
}

/* get config file object */
function read(cb) {
  projects.getRoot((err, rootPath) => {
    if (err) { cb(err); return }
    if (!rootPath) { cb({message: 'No project root found'}); return }

    const configPath = path.join(rootPath, configName)
    utils.readJsonFile(configPath, cb)
  })
}

/* check if config file exists in current directory */
function checkPwd(cb) {
  const configPath = path.join(process.cwd(), configName)

  utils.fileExists(configPath, cb)
}

/*
 * Create project config file
 *
 * Nothing is returned is file created successfully,
 * or if file already exists
 */
function create(cb) {
  const configPath = path.join(process.cwd(), configName)

  checkPwd((err, exists) => {
    if (exists) {
      cb()
    } else if (err) {
      cb({message: "Error creating project config", data: err})
    } else {
      utils.writeJsonFile(configPath, defaults.configData, err => {
        if (err) {
          cb({message: 'Error creating project config', data: err})
        } else {
          cb()
        }
      })
    }
  })
}

function update(data, cb) {
  projects.getRoot((err, rootPath) => {
    if (err) { cb(err); return }

    const configPath = path.join(rootPath, configName)

    utils.writeJsonFile(configPath, data, err => {
      if (err) {
        cb({message: 'Error updating project config', data: err})
      } else {
        cb()
      }
    })
  })
}

function validAction(action) {
  return defaults.allowedActions.indexOf(action) > -1
}

function newEndpoint(opts) {
  const port = opts.port || defaults.port
  const action = validAction(opts.action) ? opts.action : defaults.action

  return { port: port, [action]: [] }
}

function addEndpointToAction(endpoints, index, action, url) {
  if (!endpoints[index][action]) {
    endpoints[index][action] = []
  }

  if (endpoints[index][action].indexOf(url) < 0) {
    endpoints[index][action].push(url)
  }

  return endpoints
}

function addEndpointForPort(endpoints, url, port, opts) {
  const action = validAction(opts.action) ? opts.action : defaults.action

  let endpointIndex = utils.findIndexBy(endpoints, item => {
    return item.port == port
  })

  if (endpointIndex !== 0 && !endpointIndex) {
    endpoints.push(newEndpoint(opts))
    endpointIndex = endpoints.length - 1
  }

  return addEndpointToAction(endpoints, endpointIndex, action, url)
}

function addEndpointForDefault(endpoints, url, opts) {
  const action = validAction(opts.action) ? opts.action : defaults.action

  let endpointIndex = utils.findIndexBy(endpoints, {default: true})

  if (!endpointIndex && endpoints.length) {
    endpointIndex = 0
  } else {
    endpoints.push(newEndpoint(opts))
    endpointIndex = 0
  }

  return addEndpointToAction(endpoints, endpointIndex, action, url)
}

function cleanUrl(url) {
  url = url || ''

  return url.replace(/^https?:\/\//, '')
}

/*
 * addEndpoint
 *
 * Takes a url and options and adds the url to the config file
 * Options: action, port
 * First try to add the url to the config item that matches the
 * supplied port number. If not found, a new config item is created.
 * The udpated data is then written back to the file
 */
function addEndpoint(url, opts, cb) {
  read((err, configData) => {
    if (err) { cb(err); return }

    let endpoints = configData.endpoints || []
    url = cleanUrl(url)

    if (opts.port) {
      endpoints = addEndpointForPort(endpoints, url, opts.port, opts)
    } else {
      endpoints = addEndpointForDefault(endpoints, url, opts)
    }

    configData.endpoints = endpoints

    update(configData, cb)
  })
}

function removeEndpoint() {

}

export default {
  create: create,
  read: read,
  checkPwd: checkPwd,
  configName: configName,
  addEndpoint: addEndpoint,
  cleanUrl: cleanUrl
}
