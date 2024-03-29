const express = require('express');
const exphbs  = require('express-handlebars');
const favicon = require('serve-favicon');
const sqlite3 = require('sqlite3').verbose();
const Table = require('easy-table');
const moment = require('moment');
const months = require('./months');
const queries = require('./queries');

const monthNames = moment.months();

// Get all the station info.
// Record data is queried on a per-request basis.
const db = new sqlite3.Database('./db/threadex-records.db');
let port = 3003;
let stationsByState, allStations;
let stationLookup = {};
let sqlAll = 'SELECT *, rowid FROM inventory ORDER BY station';

// ThreadEx 14 added "thr" to the end of all station identifiers
// Strip that out
let stripTrailingThr = name => name.replace(/thr$/, '')

let sqliteError = (error, res) => {
  console.log('sqlite error', error);
  res.send(500);
}

db.all(sqlAll, (error, rows) => {
  if ( error ) {
    sqliteError(error, res);
    return;
  }
  let states = {};
  allStations = rows;
  stationsByState = [];
  // Group stations by state.
  rows.forEach(row => {
    if (!states.hasOwnProperty(row.state)) {
      states[row.state] = [{
        name: row.name,
        station: stripTrailingThr(row.station),
        state: row.state,
        place: row.place
      }];
    } else {
      states[row.state].push({
        name: row.name,
        station: stripTrailingThr(row.station),
        state: row.state,
        place: row.place
      });
    }
    stationLookup[row.place] = row.station;
  });
  let statesList = Object.keys(states);
  statesList.sort((a, b) => {
    a = a.toLowerCase();
    b = b.toLowerCase();
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
  statesList.forEach(s => stationsByState.push({
    name: s,
    stations: states[s]
  }));
});

// Functions to get data by station or place, with or without date.
let stationRecords = (station, callback) => {
  let recordsSql = queries.stationRecords;
  return db.all(recordsSql, station, callback);
}

let stationRecordsForDate = (station, when, callback) => {
  when = when + '%';
  let recordsSql = queries.stationRecordsForDate;
  return db.all(recordsSql, station, when, callback);
}

let placeRecords = (station, callback) => {
  let recordsSql = queries.placeRecords;
  return db.all(recordsSql, station, callback);
}

let placeRecordsForDate = (station, when, callback) => {
  when = when + '%';
  let recordsSql = queries.placeRecordsForDate;
  return db.all(recordsSql, station, when, callback);
}

let placeMonthlyRecordHigh = (station, month, callback) => {
  let recordsSql = queries.placeMonthlyHigh;
  return db.all(recordsSql, station, month, callback);
}

let placeMonthlyRecordLow = (station, month, callback) => {
  let recordsSql = queries.placeMonthlyLow;
  return db.all(recordsSql, station, month, callback);
}

let placeRecordsForYear = (station, callback) => {
  const recordsSql = queries.placeRecordsForYear
  return db.all(recordsSql, station, callback)
}

// Express app and routes.
let app = express();
app.use(favicon(__dirname + '/favicon.png'));
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars')
app.use('/chart-data', express.static('chart-data'))
app.use('/js', express.static('js'))

app.get('/', (req, res) => {
  res.render('home', { states: stationsByState });
});

app.get('/.json$', (req, res) => {
  let stations = JSON.stringify(allStations);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Length', Buffer.byteLength(stations));
  res.end(stations);
});

app.get('/.geojson$', (req, res) => {
  let features = allStations.map(station => {
    return {
      "type": "Feature",
      "properties": station,
      "geometry": {
        "type": "Point",
        "coordinates": [ station.longitude, station.latitude ]
      }
    }
  });
  let collection = {
    "type": "FeatureCollection",
    "features": features
  };
  let stations = JSON.stringify(collection);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Length', Buffer.byteLength(stations));
  res.end(stations);
});

app.get('/.txt$', (req, res) => {
  let t = new Table;
  allStations.forEach(row => {
    t.cell('Station', row.station);
    t.cell('Name', row.name);
    t.cell('State', row.state);
    t.cell('Start', row.temp_year_start);
    t.cell('End', row.temp_year_end);
    t.cell('Latitude', row.latitude);
    t.cell('Longitude', row.longitude);
    t.cell('rowid', row.rowid);
    t.newRow();
  });
  let stations = t.toString();
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Length', Buffer.byteLength(stations));
  res.end(stations);
});

app.get('/map', (req, res) => {
  res.render('map', { layout: false });
});

// Station abbreviations are always three upper-case letters.
app.get('/:station([A-Z]{3}).json', (req, res) => {
  let station = req.params.station;
  stationRecords(station, (error, rows) => {
    if ( error ) {
      sqliteError(error, res);
      return;
    }

    if ( rows.length === 0 ) {
      res.end(`Couldn't find any records for ${station}.`);
      return;
    }

    let records = JSON.stringify(rows);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Length', Buffer.byteLength(records));
    res.end(records);
  });
});

app.get('/:station([A-Z]{3,8})/on/:when.json', (req, res) => {
  let station = req.params.station;
  let when = req.params.when;
  stationRecordsForDate(station, when, (error, rows) => {
    if ( error ) {
      sqliteError(error, res);
      return;
    }

    if ( rows.length === 0 ) {
      res.end(`Couldn't find any records on ${when}.`);
      return;
    }

    let records = JSON.stringify(rows);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Length', Buffer.byteLength(records));
    res.end(records);
  });
});

app.get('/:place', (req, res) => {
  let place = req.params.place;
  console.time(place)
  let station = stationLookup[place];
  placeRecords(station, (error, rows) => {
    if ( error ) {
      sqliteError(error, res);
      return;
    }

    if ( rows.length === 0 ) {
      res.end(`Couldn't find any records for ${station}.`);
      return;
    }
    rows.forEach(row => row.mmdd = row.record_date.slice(0, 5));

    console.timeEnd(place)
    res.render('station', {
      station: station,
      records: rows,
      place: `${rows[0].name}, ${rows[0].state}`,
      placeShort: place,
      tempStart: `${rows[0].temp_year_start}`,
      tempEnd: `${rows[0].temp_year_end}`,
      months: months
    });
  });
});

app.get('/:place/on/:when', (req, res) => {
  let place = req.params.place;
  let station = stationLookup[place];
  let when = req.params.when;
  let month = when.split('-')[0];

  let queryCount = 3;
  let queriesCompleted = 0;
  let queryResults = {}
  let queryCheck = () => {
    if ( queriesCompleted === queryCount ) {
      renderPage();
    }
  }

  placeRecordsForDate(station, when, (error, rows) => {
    if ( error ) {
      sqliteError(error, res);
      return;
    }

    if ( rows.length === 0 ) {
      res.end(`Couldn't find any records on ${when}.`);
      return;
    }
    const daily = rows.filter(row => row.source === 'threadex')
    const normals = rows.filter(row => row.source === 'normal')
    queryResults.daily = daily;
    queryResults.normals = normals;
    queriesCompleted += 1;
    queryCheck()
  })

  placeMonthlyRecordHigh(station, month, (error, recordHigh) => {
    if ( error ) {
      sqliteError(error, res);
    }

    queryResults.monthlyHigh = recordHigh;
    queriesCompleted += 1;
    queryCheck()
  })

  placeMonthlyRecordLow(station, month, (error, recordLow) => {
    if ( error ) {
      sqliteError(error, res);
    }
    queryResults.monthlyLow = recordLow;
    queriesCompleted += 1;
    queryCheck()
  })

  const next = moment(`2000-${when}`, 'YYYY-MM-DD').add(1, 'days').format('MM-DD')
  const prev = moment(`2000-${when}`, 'YYYY-MM-DD').subtract(1, 'days').format('MM-DD')

  let renderPage = () => {
    // console.log('renderPage, normals', moment().format('YYYY-MM-DD--HH:mm:ss'), queryResults.normals)
    // console.log('renderPage, queryResults', queryResults)
    let monthNumber = parseInt(month) - 1;
    queryResults.monthlyLow[0].mon = monthNames[monthNumber];
    queryResults.monthlyHigh[0].mon = monthNames[monthNumber];
    // Pull out the year for each record.
    queryResults.daily.forEach(r => r.year = r.record_date.slice(6));

    let { daily, normals } = queryResults;
    // Group records by type.
    let maxHighs = daily.filter(r => r.record_type === 'TMAXHI');
    let minHighs = daily.filter(r => r.record_type === 'TMINHI');
    let minLows = daily.filter(r => r.record_type === 'TMINLO');
    let maxLows = daily.filter(r => r.record_type === 'TMAXLO');
    let precip = daily.filter(r => r.record_type === 'PRCPHI')
    precip.forEach(r => r.value = (r.value / 100).toFixed(2) + '"');

    let avgHigh = normals.filter(n => n.record_type === 'TAVGHI')
    if ( avgHigh.length > 0 ){
      avgHigh = avgHigh[0].value;
    } else {
      avgHigh = '--'
    }
    let avgLow = normals.filter(n => n.record_type === 'TAVGLO');
    if ( avgLow.length > 0 ){
      avgLow = avgLow[0].value;
    } else {
      avgLow = '--'
    }
    let avg = normals.filter(n => n.record_type === 'TAVG');
    if ( avg.length > 0 ){
      avg = avg[0].value;
    } else {
      avg = '--'
    }

    res.render('station-day', {
      station: station,
      place: `${daily[0].name}, ${daily[0].state}`,
      when: when,
      records: daily,
      maxHighs: maxHighs,
      minHighs: minHighs,
      minLows: minLows,
      maxLows: maxLows,
      monthlyRecordHigh: queryResults.monthlyHigh[0],
      monthlyRecordLow: queryResults.monthlyLow[0],
      avgHigh: avgHigh,
      avgLow: avgLow,
      avg: avg,
      tempStart: `${daily[0].temp_year_start}`,
      tempEnd: `${daily[0].temp_year_end}`,
      precip: precip,
      precipStart: `${daily[0].precip_year_start}`,
      precipEnd: `${daily[0].precip_year_end}`,
      nextDay: next,
      previousDay: prev
    });
  };
});

app.get('/chart/:place', (req, res) => {
  const place = req.params.place
  const station = stationLookup[place]
  placeRecordsForYear(station, (error, records) => {
    if ( error ) {
      sqliteError(error, res);
    }

    console.log('records', records)
    res.render('station-chart', {
      station,
      records: JSON.stringify(records)
    })
  })
})

app.listen(port);
console.log(`Listening on port ${port}`);
