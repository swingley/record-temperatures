const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()

const db = new sqlite3.Database('./db/threadex-records.db')
let sqlAll = 'SELECT *, rowid FROM inventory ORDER BY station'

const OUT = 'chart-data'

const chartData = `SELECT d.*, i.name, i.state
    FROM data d, inventory i
    WHERE d.station = i.station
    AND d.station = ?
    AND d.rank = 1
    AND d.record_type IN ('TMAXHI', 'TMINLO', 'TAVG')`

let processed = 0
let stationNames

const getChartData = (final) => {
  const station = stationNames[processed]
  console.log('processing...', station)
  db.all(chartData, station, (error, rows) => {
    processed += 1
    if (error) {
      console.log('sqlite error for ', station, error)
    } else {
      const data = { avg: {}, min: {}, max: {} }
      rows.forEach(row => {
        const when = row.record_date.slice(0, 5)
        switch (row.record_type) {
          case 'TMINLO':
            data.min[when] = row.value
            break
          case 'TAVG':
            data.avg[when] = row.value
            break
          case 'TMAXHI':
            data.max[when] = row.value
            break
        }
      })
      fs.writeFileSync(`./${OUT}/${station}.json`, JSON.stringify(data))
    }
    if (processed < stationNames.length) {
      getChartData(final)
    } else {
      final()
    }
  })
}

const processStations = (error, rows) => {
  if ( error ) {
    console.log('sqlite error', error)
    return
  }
  // stationNames = rows.map(row => row.station).slice(0, 10)
  stationNames = rows.map(row => row.station)
  // console.log({ stationNames })
  getChartData(() => console.log('\n\nFinished...'))
}

db.all(sqlAll, processStations)
