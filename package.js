Package.describe({
  name: 'lamhieu:hypersubs',
  version: '0.2.1',
  summary: 'An upgraded version of Meteor subscribe, which helps optimize data and performance!',
  git: 'https://github.com/lamhieu-vk/hypersubs.git',
  documentation: 'README.md'
})

Package.onUse(function(api) {
  api.versionsFrom('1.2')
  api.use(['ecmascript', 'random', 'ejson', 'ddp-client@2.2.0'])
  api.mainModule('hypersubs.js')
})

Package.onTest(function(api) {
  api.use(['ecmascript', 'tinytest'])
  api.use('lamhieu:hypersubs')
  api.mainModule('hypersubs-tests.js')
})

Npm.depends({
  'object-hash': '1.3.1'
})
