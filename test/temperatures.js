var expect = require("chai").expect;
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('../db/threadex-records.db');

describe("ThreadEx Data Consistency", function(done) {
  describe("data table should have 6 columns", function () {
    it("checks the structure of the data table", function() {
      var sql = "PRAGMA table_info(data)";
      db.all(sql, function(err, result) {
        expect(result.length).to.equal(6);
        done();
      });
    });
  });
  describe("inventory table should have 11 columns", function (done) {
    it("checks the structure of the inventory table", function() {
      var sql = "PRAGMA table_info(inventory)";
      db.all(sql, function(err, result) {
        expect(result.length).to.equal(11);
        done();
      });
    });
  });
  describe("data table has rows", function () {
    it("queries the data table", function() {
      var sql = "SELECT COUNT(*) FROM data";
      db.all(sql, function(err, result) {
        expect(result.length).to.be.above(0);
        done();
      });
    });
  });
  describe("inventory table has rows", function () {
    it("queries the inventory table", function() {
      var sql = "SELECT COUNT(*) FROM inventory";
      db.all(sql, function(err, result) {
        expect(result.length).to.be.above(0);
        done();
      });
    });
  });
});
