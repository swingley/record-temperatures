'use strict'

let queries = {
  all: 'SELECT * FROM inventory ORDER BY station',
  stationHighs: `SELECT d.*, i.name
    FROM data d, inventory i
    WHERE d.station = i.station
    AND d.station = '${station}'
    AND d.rank = 1
    AND d.record_type = 'TMAXHI'
    ORDER BY d.value
    LIMIT 10`,
  stationWhen: `SELECT *
    FROM data
    WHERE station = '${station}'
    AND record_date like '%${when}%'`

}

module.exports = queries;
