import { Tinytest } from 'meteor/tinytest'

import { name as packageName } from 'meteor/lamhieu:hypersubs'

Tinytest.add('hypersubs - import', function(test) {
  test.equal(packageName, 'hypersubs')
})
