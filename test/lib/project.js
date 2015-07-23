import fs from 'fs-extra'
import path from 'path'
import nock from 'nock'

// variables in ES6 imports. how?
const srcPath = '../../' + SRC_DIR
const project = require(srcPath + '/lib/project')
const configFactory = require(srcPath + '/lib/config')
const storageFactory = require(srcPath + '/lib/storage')
const utils = require(srcPath + '/lib/utils')

const dataDirName = storageFactory.dataDirName

describe('controller: project', () => {
  before(cleanup)
  afterEach(cleanup)

  describe('init', () => {
    const config = configFactory.default(process.cwd())

    context('project not initialized', () => {
      it('creates data dir and config in current directory', done => {
        fs.readdir(process.cwd(), (err, files) => {
          assert.notOk(err)
          assert.equal(files.indexOf(dataDirName), -1)
          assert.equal(files.indexOf(config.configName), -1)

          project.init(initErr => {
            fs.readdir(process.cwd(), (err, files) => {
              assert.notOk(initErr)
              assert.notOk(err)
              assert.notEqual(files.indexOf(dataDirName), -1)
              assert.notEqual(files.indexOf(config.configName), -1)

              done()
            })
          })
        })
      })

      it('adds default config content', done => {
        const expected = {
          "endpoints": {
            "5000": {
              "get": [],
              "default": true
            }
          }
        }

        project.init(initErr => {
          fs.readFile(config.configName, 'utf8', (err, data) => {
            assert.notOk(err)

            assert.deepEqual(JSON.parse(data), expected)
            done()
          })
        })
      })
    })

    context('project initialized', () => {
      beforeEach(project.init)

      it('returns a warning', done => {
        project.init(initErr => {
          assert.equal(initErr.message, 'Project already initialized')
          done()
        })
      })
    })
  })

  describe('getRoot', () => {
    context('project not initialized', () => {
      it('returns a null path', done => {
        project.getRoot((err, path) => {
          assert.equal(err.message, 'Project not initialized')
          assert.notOk(path)
          done()
        })
      })
    })

    context('project initialized', () => {
      beforeEach(project.init)

      it('returns the path to the project root', done => {
        project.getRoot((err, path) => {
          assert.isNull(err)
          assert.equal(path, process.cwd())
          done()
        })
      })
    })

    context('project not in current directory', () => {
      const originalDir = process.cwd()
      const tempDirName = '.planb-temp.d.test'

      function revert(done) {
        process.chdir(originalDir)

        fs.remove(tempDirName, done)
      }

      beforeEach(project.init)

      beforeEach(done => {
        fs.mkdir(tempDirName, (err) => {
          if (err) {revert(done); return}

          process.chdir(tempDirName)

          fs.mkdir(tempDirName, (err) => {
            if (err) {revert(done); return}

            process.chdir(tempDirName)
            done()
          })
        })
      })

      afterEach(revert)

      it('looks up until finding the data directory', done => {
        assert.equal(
          process.cwd(),
          originalDir + '/' + tempDirName + '/' + tempDirName
        )

        project.getRoot((err, projectPath) => {
          assert.isNull(err)
          assert.equal(projectPath, originalDir)
          done()
        })
      })
    })
  })

  describe('addEndpoint', () => {
    const testUrl = 'http://www.someurl.com/api/v1/stuff'

    context('project not initialized', () => {
      it('returns an error', done => {
        project.addEndpoint('', {}, err => {
          assert.isObject(err)
          done()
        })
      })
    })

    context('project is initialized', () => {
      beforeEach(project.init)
      const config = configFactory.default(process.cwd())

      it('handles long urls', done => {
        var longUrl = "x".repeat(300)
        project.addEndpoint(longUrl, {}, err => {
          assert.notOk(err)

          done()
        })
      })

      it('updates config and creates directory with default options', done => {
        project.addEndpoint(testUrl, {}, err => {
          assert.notOk(err)

          config.read((err, configData) => {
            assert.notOk(err)
            assert.equal(configData.endpoints['5000'].get.length, 1)
            assert.equal(configData.endpoints['5000'].get[0], utils.cleanUrl(testUrl))

            const projectPath = path.join(process.cwd(), storageFactory.dataDirName)
            const name = utils.endpointNameFromPath(testUrl)
            const filePath = path.join(projectPath, '5000', 'get', name)

            assert.fileExists(filePath)
            done()
          })
        })
      })

      it('updates config and creates directory with supplied options', done => {
        const testUrl = 'http://www.someurl.com/api/v1/stuff'
        const opts = {port: '1234', action: 'post'}

        project.addEndpoint(testUrl, opts, err => {
          assert.notOk(err)

          config.read((err, configData) => {
            assert.notOk(err)
            assert.equal(configData.endpoints['5000'].get.length, 0)
            assert.equal(configData.endpoints[opts.port][opts.action].length, 1)
            assert.equal(configData.endpoints[opts.port][opts.action][0], utils.cleanUrl(testUrl))

            const projectPath = path.join(process.cwd(), storageFactory.dataDirName)
            const name = utils.endpointNameFromPath(testUrl)
            const filePath = path.join(projectPath, opts.port, opts.action, name)

            assert.fileExists(filePath)
            done()
          })
        })
      })
    })
  })

  describe('removeEndpoint', () => {
    beforeEach(project.init)
    const config = configFactory.default(process.cwd())

    it('updates config and removes directory with default options', done => {
      const testUrl = 'http://www.someurl.com/api/v1/stuff'

      project.addEndpoint(testUrl, {}, err => {
        assert.notOk(err)

        config.read((err, configData) => {
          assert.notOk(err)
          assert.equal(configData.endpoints['5000'].get.length, 1)

          const projectPath = path.join(process.cwd(), storageFactory.dataDirName)
          const name = utils.endpointNameFromPath(testUrl)
          const filePath = path.join(projectPath, '5000', 'get', name)

          assert.fileExists(filePath)

          project.removeEndpoint(testUrl, {}, err => {
            assert.notOk(err)

            config.read((err, configData) => {
              assert.notOk(err)
              assert.equal(configData.endpoints['5000'].get.length, 0)

              assert.fileDoesNotExist(filePath)
              done()
            })
          })
        })
      })
    })

    it('updates config and removes directory with supplied options', done => {
      const testUrl = 'http://www.someurl.com/api/v1/stuff'
      const opts = {port: '1234', action: 'post'}

      project.addEndpoint(testUrl, opts, err => {
        assert.notOk(err)

        config.read((err, configData) => {
          assert.notOk(err)
          assert.equal(configData.endpoints[opts.port][opts.action].length, 1)

          const projectPath = path.join(process.cwd(), storageFactory.dataDirName)
          const name = utils.endpointNameFromPath(testUrl)
          const filePath = path.join(projectPath, opts.port, opts.action, name)

          assert.fileExists(filePath)

          project.removeEndpoint(testUrl, opts, err => {
            assert.notOk(err)

            config.read((err, configData) => {
              assert.notOk(err)
              assert.equal(configData.endpoints[opts.port][opts.action].length, 0)

              assert.fileDoesNotExist(filePath)
              done()
            })
          })
        })
      })
    })

  })

  describe('fetchVersions', () => {
    const testUrl1 = 'http://www.test.com/api/path'
    const testUrl2 = 'http://www.test.com/api/path/2'

    beforeEach(project.init)

    it('adds a new version to each existing endpoint', done => {
      nock('http://www.test.com')
      .get('/api/path')
      .reply(200, {content: 'some content'})
      .get('/api/path/2')
      .reply(200, {content: 'some more content'})

      project.addEndpoint(testUrl1, {}, err => {
        assert.notOk(err)

        project.addEndpoint(testUrl2, {}, err => {
          assert.notOk(err)

          project.fetchVersions(err => {
            assert.notOk(err)

            const testName1 = utils.endpointNameFromPath(testUrl1)
            const testName2 = utils.endpointNameFromPath(testUrl2)
            const projectPath = path.join(process.cwd(), storageFactory.dataDirName)
            const endpointPath1 = path.join(projectPath, '5000', 'get', testName1)
            const endpointPath2 = path.join(projectPath, '5000', 'get', testName2)

            utils.readJsonFile(path.join(endpointPath1, '0.json'), (err, data) => {
              assert.notOk(err)
              assert.deepEqual(data, {content: "some content"})

              utils.readJsonFile(path.join(endpointPath2, '0.json'), (err, data) => {
                assert.notOk(err)
                assert.deepEqual(data, {content: "some more content"})

                done()
              })
            })
          })
        })
      })
    })

    it('creates non-existing endpoints', done => {
      const config = configFactory.default(process.cwd())

      nock('http://www.test.com')
      .get('/api/path')
      .reply(200, {content: 'some content'})
      .get('/api/path/2')
      .reply(200, {content: 'some more content'})

      config.addEndpoint(testUrl1, {}, err => {
        assert.notOk(err)

        config.addEndpoint(testUrl2, {}, err => {
          assert.notOk(err)

          project.fetchVersions(err => {
            assert.notOk(err)

            const testName1 = utils.endpointNameFromPath(testUrl1)
            const testName2 = utils.endpointNameFromPath(testUrl2)
            const projectPath = path.join(process.cwd(), storageFactory.dataDirName)
            const endpointPath1 = path.join(projectPath, '5000', 'get', testName1)
            const endpointPath2 = path.join(projectPath, '5000', 'get', testName2)

            utils.readJsonFile(path.join(endpointPath1, '0.json'), (err, data) => {
              assert.notOk(err)
              assert.deepEqual(data, {content: "some content"})

              utils.readJsonFile(path.join(endpointPath2, '0.json'), (err, data) => {
                assert.notOk(err)
                assert.deepEqual(data, {content: "some more content"})

                done()
              })
            })
          })
        })
      })
    })

    it('sets the file extension from the header content type', done => {
      nock('http://www.test.com')
      .defaultReplyHeaders({
        'Content-Type': 'application/json'
      })
      .get('/api/path')
      .reply(200, {content: 'some content'})
      .defaultReplyHeaders({
        'Content-Type': 'text/html'
      })
      .get('/api/path/2')
      .reply(200, {content: 'some more content'})

      project.addEndpoint(testUrl1, {}, err => {
        assert.notOk(err)

        project.addEndpoint(testUrl2, {}, err => {
          assert.notOk(err)

          project.fetchVersions(err => {
            assert.notOk(err)

            const testName1 = utils.endpointNameFromPath(testUrl1)
            const testName2 = utils.endpointNameFromPath(testUrl2)
            const projectPath = path.join(process.cwd(), storageFactory.dataDirName)
            const endpointPath1 = path.join(projectPath, '5000', 'get', testName1)
            const endpointPath2 = path.join(projectPath, '5000', 'get', testName2)

            utils.readJsonFile(path.join(endpointPath1, '0.json'), (err, data) => {
              assert.notOk(err)
              assert.deepEqual(data, {content: "some content"})

              utils.readJsonFile(path.join(endpointPath2, '0.html'), (err, data) => {
                assert.notOk(err)
                assert.deepEqual(data, {content: "some more content"})

                done()
              })
            })
          })
        })
      })
    })

    it('does not create file if extension is not supported', done => {
      nock('http://www.test.com')
      .defaultReplyHeaders({
        'Content-Type': 'something/not-supported'
      })
      .get('/api/path')
      .reply(200, {content: 'some content'})

      project.addEndpoint(testUrl1, {}, err => {
        assert.notOk(err)

        project.fetchVersions(err => {
          assert.notOk(err)

          const testName1 = utils.endpointNameFromPath(testUrl1)
          const projectPath = path.join(process.cwd(), storageFactory.dataDirName)
          const endpointPath1 = path.join(projectPath, '5000', 'get', testName1)

          fs.readdir(endpointPath1, (err, files) => {
            assert.notOk(err)
            assert.equal(files.length, 0)
            done()
          })
        })
      })
    })
  })

  describe('itemize', () => {
    const testUrl1 = 'http://www.test.com/api/path'
    const testUrl2 = 'http://www.test.com/api/path/2'

    beforeEach(project.init)

    beforeEach(done => {
      nock('http://www.test.com')
      .get('/api/path')
      .times(2)
      .reply(200, {content: 'some content'})
      .get('/api/path/2')
      .times(2)
      .reply(200, {content: 'some more content'})

      project.addEndpoint(testUrl1, {}, err => {
        assert.notOk(err)

        project.addEndpoint(testUrl2, {}, err => {
          assert.notOk(err)

          project.fetchVersions(err => {
            assert.notOk(err)

            project.fetchVersions(err => {
              assert.notOk(err)

              done()
            })
          })
        })
      })
    })

    it('returns an array of config items that include versions', done => {
      project.itemize((err, items) => {
        assert.notOk(err)

        assert.equal(items.length, 2)
        assert.equal(items[0].url, utils.cleanUrl(testUrl1))
        assert.equal(items[0].port, '5000')
        assert.equal(items[0].action, 'get')
        assert.equal(items[0].versions.length, 2)
        assert.equal(items[0].versions[0].name, '0.json')
        assert.equal(items[0].versions[1].name, '1.json')

        assert.equal(items[1].url, utils.cleanUrl(testUrl2))
        assert.equal(items[1].port, '5000')
        assert.equal(items[1].action, 'get')
        assert.equal(items[1].versions.length, 2)
        assert.equal(items[1].versions[0].name, '0.json')
        assert.equal(items[1].versions[1].name, '1.json')

        done()
      })
    })
  })

  describe('rollbackVersion', () => {
    const testUrl = 'http://www.test.com/api/path'

    beforeEach(project.init)

    beforeEach(done => {
      nock('http://www.test.com')
      .get('/api/path')
      .times(2)
      .reply(200, {content: 'some content'})
      .get('/api/path/2')
      .times(2)
      .reply(200, {content: 'some more content'})

      project.addEndpoint(testUrl, {}, err => {
        assert.notOk(err)

        project.fetchVersions(err => {
          assert.notOk(err)

          project.fetchVersions(err => {
            assert.notOk(err)

            done()
          })
        })
      })
    })

    it('removes current version from endpoint', done => {
      const testName = utils.endpointNameFromPath(testUrl)
      const endpointPath = path.join(process.cwd(), dataDirName, '5000', 'get', testName)

      fs.readdir(endpointPath, (err, files) => {
        assert.notOk(err)
        assert.deepEqual(files, ['0.json', '1.json'])

        project.rollbackVersion(testUrl, {}, err => {
          assert.notOk(err)

          fs.readdir(endpointPath, (err, files) => {
            assert.notOk(err)
            assert.deepEqual(files, ['0.json'])

            project.rollbackVersion(testUrl, {}, err => {
              assert.notOk(err)

              fs.readdir(endpointPath, (err, files) => {
                assert.notOk(err)
                assert.equal(files.length, 0)

                done()
              })
            })
          })
        })
      })
    })
  })

  describe('diff', () => {
    const testUrl = 'http://www.test.com/api/path'

    const obj1 = {
      content: 'some content'
    }

    const obj2 = {
      content: 'some more content',
      with: 'a different property'
    }

    const obj3 = {
      content: 'some more content',
      with: 'some changed content'
    }

    beforeEach(project.init)

    context('multiple versions', () => {
      beforeEach(done => {
        nock('http://www.test.com')
        .get('/api/path')
        .reply(200, obj1)
        .get('/api/path')
        .reply(200, obj2)
        .get('/api/path')
        .reply(200, obj3)

        project.addEndpoint(testUrl, {}, err => {
          assert.notOk(err)

          project.fetchVersions(err => {
            assert.notOk(err)

            project.fetchVersions(err => {
              assert.notOk(err)

              project.fetchVersions(err => {
                assert.notOk(err)

                done()
              })
            })
          })
        })
      })

      it('accepts two version numbers and returns the diff', done => {
        project.diff(testUrl, '2', '1', {}, (err, diff) => {
          assert.isNull(err)

          const expected = [
            ' {\n\u001b[31m-  with: "some changed content"',
            '\u001b[39m\n\u001b[32m+  with: "a different property',
            '"\u001b[39m\n }\n'
          ].join('')

          assert.equal(diff, expected)

          project.diff(testUrl, '1', '0', {}, (err, diff) => {
            assert.isNull(err)

            const expected = [
              ' {\n\u001b[31m-  with: "a different property"',
              '\u001b[39m\n\u001b[31m-  content: "some more content"',
              '\u001b[39m\n\u001b[32m+  content: "some content"',
              '\u001b[39m\n }\n'
            ].join('')

            assert.equal(diff, expected)

            done()
          })
        })
      })

      it('uses the current version if a single version number is provided', done => {
        project.diff(testUrl, null, '1', {}, (err, diff) => {
          assert.isNull(err)

          const expected = [
            ' {\n\u001b[31m-  with: "some changed content"',
            '\u001b[39m\n\u001b[32m+  with: "a different property',
            '"\u001b[39m\n }\n'
          ].join('')

          assert.equal(diff, expected)

          project.diff(testUrl, null, '0', {}, (err, diff) => {
            assert.isNull(err)

            const expected = [
              ' {\n\u001b[31m-  with: "some changed content"',
              '\u001b[39m\n\u001b[31m-  content: "some more content"',
              '\u001b[39m\n\u001b[32m+  content: "some content"',
              '\u001b[39m\n }\n'
            ].join('')

            assert.equal(diff, expected)

            done()
          })
        })
      })

      it('uses current version and previous if no versions provided', done => {
        project.diff(testUrl, null, null, {}, (err, diff) => {
          assert.isNull(err)

          const expected = [
            ' {\n\u001b[31m-  with: "some changed content"',
            '\u001b[39m\n\u001b[32m+  with: "a different property"',
            '\u001b[39m\n }\n'
          ].join('')

          assert.equal(diff, expected)

          done()
        })
      })

      it('returns an error if version is larger than current', done => {
        project.diff(testUrl, null, '5', {}, (err, diff) => {
          assert.isObject(err)

          done()
        })
      })

    })

    context('one version', () => {
      beforeEach(done => {
        nock('http://www.test.com')
        .get('/api/path')
        .reply(200, obj1)

        project.addEndpoint(testUrl, {}, err => {
          assert.notOk(err)

          project.fetchVersions(err => {
            assert.notOk(err)
            done()
          })
        })
      })

      it('it returns an error', done => {
        project.diff(testUrl, null, null, {}, (err, diff) => {
          assert.isObject(err)

          done()
        })
      })
    })
  })

})
