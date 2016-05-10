'use strict'

const express = require('express');
const exphbs  = require('express-handlebars');
const sqlite3 = require('sqlite3').verbose();
const Table = require('easy-table');
const months = require('./months');

// Get all the station info.
// Record data is queried on a per-request basis.
const db = new sqlite3.Database('./db/threadex-records.db');
let port = 3003;
let stationsByState, allStations;
let stationLookup = {};
let sqlAll = 'SELECT *, rowid FROM inventory ORDER BY station'

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
        station: row.station,
        state: row.state,
        place: row.place
      }];
    } else {
      states[row.state].push({
        name: row.name,
        station: row.station,
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
  let recordsSql = `SELECT d.*, i.name, i.state
    FROM data d, inventory i
    WHERE d.station = i.station
    AND d.station = '${station}'
    AND d.rank = 1
    AND d.record_type = 'TMAXHI'
    ORDER BY d.value DESC
    LIMIT 10`;
  return db.all(recordsSql, callback);
}

let stationRecordsForDate = (station, when, callback) => {
  let recordsSql = `SELECT d.*, i.name, i.state
    FROM data d, inventory i
    WHERE d.station = i.station
    AND d.station = '${station}'
    AND d.record_date like '${when}%'`;
  return db.all(recordsSql, callback);
}

let placeRecords = (station, callback) => {
  let recordsSql = `SELECT d.*, i.*
    FROM data d, inventory i
    WHERE d.station = i.station
    AND d.station = '${station}'
    AND d.rank = 1
    AND d.record_type = 'TMAXHI'
    ORDER BY d.value DESC
    LIMIT 10`;
  return db.all(recordsSql, callback);
}

let placeRecordsForDate = (station, when, callback) => {
  let recordsSql = `SELECT d.*, i.*
    FROM data d, inventory i
    WHERE d.station = i.station
    AND d.station = '${station}'
    AND d.record_date like '${when}%'`;
  return db.all(recordsSql, callback);
}

// Express app and routes.
let app = express();
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.get('/', (req, res) => {
  res.render('home', { states: stationsByState });
});

app.get('/.json$', (req, res) => {
  let stations = JSON.stringify(allStations);
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
    t.cell('rowid', row.rowid);
    t.newRow();
  });
  let stations = t.toString();
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Length', Buffer.byteLength(stations));
  res.end(stations);
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

app.get('/:station([A-Z]{3})', (req, res) => {
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

    rows.forEach(row => row.mmdd = row.record_date.slice(0, 5));

    res.render('station', {
      station: station,
      records: rows,
      place: `${rows[0].name}, ${rows[0].state}`
    });
  });
});

app.get('/:station([A-Z]{3})/on/:when.json', (req, res) => {
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

app.get('/:station([A-Z]{3})/on/:when', (req, res) => {
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

    res.render('station-day', {
      station: station,
      place: `${rows[0].place}`,
      when: when,
      records: rows
    });
  });
});

app.get('/:place', (req, res) => {
  let place = req.params.place;
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
  placeRecordsForDate(station, when, (error, rows) => {
    if ( error ) {
      sqliteError(error, res);
      return;
    }

    if ( rows.length === 0 ) {
      res.end(`Couldn't find any records on ${when}.`);
      return;
    }

    // Pull out the year for each record.
    rows.forEach(r => r.year = r.record_date.slice(6));

    // Group records by type.
    let maxHighs = rows.filter(r => r.record_type === 'TMAXHI');
    let minHighs = rows.filter(r => r.record_type === 'TMAXLO');
    let minLows = rows.filter(r => r.record_type === 'TMINLO');
    let maxLows = rows.filter(r => r.record_type === 'TMAXLO');
    let precip = rows.filter(r => r.record_type === 'PRCPHI');

    res.render('station-day', {
      station: station,
      place: `${rows[0].name}, ${rows[0].state}`,
      when: when,
      records: rows,
      maxHighs: maxHighs,
      minHighs: minHighs,
      minLows: minLows,
      maxLows: maxLows,
      tempStart: `${rows[0].temp_year_start}`,
      tempEnd: `${rows[0].temp_year_end}`,
      precip: precip,
      precipStart: `${rows[0].precip_year_start}`,
      precipEnd: `${rows[0].precip_year_end}`
    });
  });
});

app.listen(port);
console.log(`Listening on port ${port}`);
