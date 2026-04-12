const MongoStore = require('connect-mongo');
console.log('Direct require:', typeof MongoStore.create);
console.log('MongoStore.MongoStore.create:', typeof (MongoStore.MongoStore && MongoStore.MongoStore.create));
console.log('MongoStore.default.create:', typeof (MongoStore.default && MongoStore.default.create));
console.log('MongoStore object:', Object.keys(MongoStore));
