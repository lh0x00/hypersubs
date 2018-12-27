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


## How it work?

On the page, every time you call `Meteor.subscribe`, the system will create a` subscription` and start its workflow, it will send the request to the server, and get back in the message returned from the server. When you call `Meteor.subscribe` with the same arguments and names in multiple locations, the system creates separate connections, so there is a need for unnecessary connections!

### For example:

#### default

At element A, we call `Meteor.subscribe('getData', '_id')` and somewhere in the page (many other elements) also call `Meteor.subscribe('getData', '_id')` each time you call to it the system thing will create a server communication connection! **things are not re-used!**

#### with hpersubs

At immortality A, we call `Meteor.subscribe('getData', '_id')` and somewhere in the page, even if you recall something like that, we only created one communication line with the server. and it is re-used! **The server you are working less, the speed of subscribe feedback is returned immediately!**


### Options

Default options:
```javascript
const options = {
  isOverride: true, // is override original Meteor.subscribe
}
```

#### How to config options?

Default, you can use **hypersubs** without config but you want custom config you can do this

```javascript
import { config } from 'meteor/lamhieu:hypersubs';

// if you don't want override original Meteor.subscribe
config.isOverride = false;
```

### Usage

Default **hypersubs** is add to Meteor variable, you can use by call `Meteor.hyperSubscribe` like `Meteor.subscribe`!

If set `isOverride: true` you don't need change any code in your source because `Meteor.subscribe` will replace by `Meteor.hyperSubscribe`, and you can call original susbcribe by call `Meteor.originalSubscribe`

If set `isOverride: false` when you want use **hypersubs** you need call `Meteor.hyperSubscribe`
