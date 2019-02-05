#!/usr/bin/env node
'use strict';

const dgram = require('dgram');
const socket = dgram.createSocket('udp4');

const barrkeep = require('barrkeep');
const minimist = require('minimist');

//////////

const options = minimist(process.argv.slice(2));

const target = options.target || '192.168.0.100';
const targetPort = parseInt(options.port || 11111);
const listenPort = parseInt(options.listen || 11112);

const size = parseInt(options.size || 1000);

let count = parseInt(options.count || 100);
let time = 0;

if (options.time) {
  const duration = options.time;

  count = -1;
  time = 0;

  duration.replace(/(\d+)ms\b/, function(match, p1) {
    time += parseInt(p1);
  }).replace(/(\d+)[sS]\b/, function(match, p1) {
    time += parseInt(p1) * 1000;
  }).replace(/(\d+)[mM]\b/, function(match, p1) {
    time += parseInt(p1) * 1000 * 60;
  }).replace(/(\d+)[hH]\b/, function(match, p1) {
    time += parseInt(p1) * 1000 * 60 * 60;
  }).replace(/(\d+)[dD]\b/, function(match, p1) {
    time += parseInt(p1) * 1000 * 60 * 60 * 24;
  });
}

const timeout = parseInt(options.timeout || 10000);

//////////

const version = require('./package.json').version;

const banner = `

                      ':ol.
                .;oOXMMMMMk
          .;lkKWMWKkl;.'MMM'
    .,lxKWMMXkl;.       xMMKc,.
  ,WMMXko;.             .NMMWMMWXOdc,.
  .WMM'                  lMMX .,cdOXWMMXOdc,.
   lMM0                  ,WMMc       .,cd0NMMMX,
    NMM;           .,lkXMMW0d.             .MMM'
    cMMX      .;oONMMMMo;.                 cMMK
     XMMl.:d0WMMXNMMMMMKxl;.               KMMc
     ;MMMMWKxc'  ,MMW;:okXMMMXko:.        ,MMW
      ;l:.        kMMd     .;OMMMMMNOd:'  xMMx
                  .WMM.      xMMk.;lkKWMMNWMM'
                   lMM0      NMM;      .,cxkl
                    XMMc    ,MMW
                    ,WMO    dMMO
                            XMMc
                            lkd

Picket Packet Tester v${ version }

`;

//////////

function Server() {
  socket.on('message', (msg, rinfo) => {
    socket.send(msg, listenPort, rinfo.address);
  });

  socket.on('listening', () => {
    const address = socket.address();
    console.log(banner);
    console.log(`Picket test server listening on ${address.address}:${address.port}`);
  });

  socket.bind(targetPort);
}

///////////

function Client() {
  const buffer = Buffer.alloc(size);

  let sequence = 0;

  let received = 0;
  let corrupt = 0;
  let dropped = 0;

  let elapsed = 0;
  let start = 0;

  let dropCheck = -1;

  let minimumTime = Infinity;
  let maximumTime = -1;

  function summary() {
    const totalElapsed = Date.now() - start;
    let speed = Math.floor((received * size * 8) / (totalElapsed / 1000));
    speed = barrkeep.formatBytes(speed).replace('Bytes', 'B').
      replace('B', 'bps').
      replace(/\s/g, '');

    console.log('Done.\n\n%d packets sent in %dms', sequence, totalElapsed);
    console.log('%d received, %d corrupt, %d dropped', received, corrupt, dropped);
    console.log('%dms maximum elapsed time, %dms minimum elapsed time', maximumTime, minimumTime);
    console.log('Speed: %s', speed);

    process.exit(0);
  }

  function drop() {
    console.log('Packet #%d dropped.', sequence);
    dropped++;
    setImmediate(send);
  }

  function send() {
    if ((count !== -1 && sequence >= count) ||
        (time !== 0 && (Date.now() - start) > time)) {
      return summary();
    }
    sequence++;

    for (const key of buffer.keys()) {
      buffer[key] = sequence + key;
    }

    elapsed = Date.now();

    dropCheck = setTimeout(drop, timeout);
    socket.send(buffer, targetPort, target);
  }

  socket.on('message', (msg) => {
    clearTimeout(dropCheck);

    if (buffer.compare(msg) === 0) {
      elapsed = Date.now() - elapsed;

      minimumTime = Math.min(minimumTime, elapsed);
      maximumTime = Math.max(maximumTime, elapsed);

      //console.log('Packet #%d, %dms', sequence, elapsed);
      received++;
    } else {
      corrupt++;
      console.log('Packet #%d corrupt', sequence);
    }

    setImmediate(send);
  });

  socket.on('listening', () => {
    console.log(banner);
    if (count === -1) {
      console.log('Picket sending for %s to %s:%d...', options.time, target, targetPort);
    } else {
      console.log('Picket sending %d to %s:%d...', count, target, targetPort);
    }
    start = Date.now();
    setImmediate(send);
  });

  process.on('SIGINT', summary);

  socket.bind(listenPort);
}

//////////

if (options.server) {
  new Server();
} else {
  new Client();
}
