'use strict'

let queries = {
  all: 'SELECT * FROM inventory ORDER BY station',
  stationRecords: 'SELECT d.*, i.name, i.state ' +
    'FROM data d, inventory i ' +
    'WHERE d.station = i.station ' +
    'AND d.station = ? ' +
    'AND d.rank = 1 ' +
    'AND d.record_type = \'TMAXHI\' ' +
    'ORDER BY d.value DESC ' +
    'LIMIT 10',
  stationRecordsForDate: 'SELECT d.*, i.name, i.state ' +
    'FROM data d, inventory i ' +
    'WHERE d.station = i.station ' +
    'AND d.station = ? ' +
    'AND d.record_date like ?',
  placeRecords: 'SELECT d.*, i.* ' +
    'FROM data d, inventory i ' +
    'WHERE d.station = i.station ' +
    'AND d.station = ? ' +
    'AND d.rank = 1 ' +
    'AND d.record_type = \'TMAXHI\'' +
    'ORDER BY d.value DESC ' +
    'LIMIT 10',
  placeRecordsForDate: 'SELECT d.*, i.* ' +
    'FROM data d, inventory i ' +
    'WHERE d.station = i.station ' +
    'AND d.station = ? ' +
    'AND d.record_date like ?',
  placeMonthlyHigh: 'SELECT MAX(value) AS value, record_date ' +
    'FROM data ' +
    'WHERE record_type = \'TMAXHI\' ' +
    'AND station = ? ' +
    'AND SUBSTR(record_date, 0, 3) = ?',
  placeMonthlyLow: 'SELECT MIN(value) AS value, record_date ' +
    'FROM data ' +
    'WHERE record_type = \'TMINLO\' ' +
    'AND station = ? ' +
    'AND SUBSTR(record_date, 0, 3) = ?',
}

module.exports = queries;
