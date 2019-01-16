#!/usr/bin/env node
'use strict';

const dgram = require('dgram');
const socket = dgram.createSocket('udp4');

const barrkeep = require('barrkeep');
const minimist = require('minimist');
const options = minimist(process.argv.slice(2));

const target = options.target || '192.168.0.2';
const port = parseInt(options.port || 11111);
const size = parseInt(options.size || 1000);
const count = parseInt(options.count || 100);
const timeout = parseInt(options.timeout || 10000);

//////////

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

`;

//////////

function Server() {
  socket.on('message', (msg, rinfo) => {
    socket.send(msg, rinfo.port, rinfo.address);
  });

  socket.on('listening', () => {
    const address = socket.address();
    console.log(banner);
    console.log(`Picket test server listening on ${address.address}:${address.port}`);
  });

  socket.bind(port);
}

///////////

function Client() {
  const buffer = Buffer.alloc(size);

  let sequence = 0;

  let received = 0;
  let corrupt = 0;
  let dropped = 0;

  let time = 0;
  let start = 0;

  let dropCheck = -1;

  function summary() {
    const totalTime = Date.now() - start;
    let speed = Math.floor((received * size * 8) / (totalTime / 1000));
    speed = barrkeep.formatBytes(speed).replace('Bytes', 'B').
      replace('B', 'bps').
      replace(/\s/g, '');

    console.log('Done.\n\n%d packets sent in %dms', sequence, totalTime);
    console.log('%d received, %d corrupt, %d dropped', received, corrupt, dropped);
    console.log('Speed: %s', speed);

    process.exit(0);
  }

  function drop() {
    console.log('Packet #%d dropped.', sequence);
    dropped++;
    setImmediate(send);
  }

  function send() {
    if (sequence >= count) {
      return summary();
    }
    sequence++;

    buffer.fill(sequence);

    time = Date.now();

    dropCheck = setTimeout(drop, timeout);
    socket.send(buffer, port, target);
  }

  socket.on('message', (msg) => {
    clearTimeout(dropCheck);

    if (buffer.compare(msg) === 0) {
      //console.log('Packet #%d, %dms', sequence, Date.now() - time);
      received++;
    } else {
      corrupt++;
      console.log('Packet #%d corrupt', sequence);
    }

    setImmediate(send);
  });

  socket.on('listening', () => {
    console.log(banner);
    console.log('Picket sending %d to %s:%d...', count, target, port);
    start = Date.now();
    setImmediate(send);
  });

  process.on('SIGINT', summary);

  socket.bind(port);
}

//////////

if (options.server) {
  new Server();
} else {
  new Client();
}
