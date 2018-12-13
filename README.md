# Hypersubs

[![github issues][github-issues-image]][github-issues-url]
[![build status][travis-image]][github-project-url]

An upgraded version of Meteor subscribe, which helps optimize data and performance!

## Why hypersubs?

This is the overwritten version of **Meteor subscribe**. It optimizes performance by not create connect sent to the server when it is not needed.
**Hypersubs** only creates one connection for multiple subscriptions when detected it is duplicate (same publication name and params). **Hypersubs** only make a real connection (for the first time call `Meteor.subscribe`), since the second times call `Meteor.subscribe`, they will be optimized reuse the connection is existed!

## Installation

read more in [atmospherejs](https://atmospherejs.com/lamhieu/hypersubs)

```bash
$ meteor add lamhieu:hypersubs
```

All the rest of the packages are automatically made for you, no need to change anything in your source code!

[github-project-url]: https://github.com/lamhieu-vk/hypersubs
[travis-image]: https://travis-ci.com/lamhieu-vk/hypersubs.svg?branch=master
[github-issues-image]: https://img.shields.io/github/issues/lamhieu-vk/hypersubs.svg
[github-issues-url]: https://github.com/lamhieu-vk/hypersubs/issues
