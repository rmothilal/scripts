#!/usr/bin/env node

/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

// const p = '%{TIMESTAMP_ISO8601:timestamp} - %{DATA:specialCharacters}: guid=%{UUID:uuid} - %{GREEDYDATA:process}'
// const p = '%{TIMESTAMP_ISO8601:timestamp} - %{GREEDYDATA:specialCharacters}: guid=%{UUID:uuid} - %{GREEDYDATA:process}'
const p = '%{TIMESTAMP_ISO8601:timestamp} - %{DATA:specialCharacters}cid=%{GREEDYDATA:uuid}, fsp=%{GREEDYDATA:fsp}, source=%{GREEDYDATA:source}, dest=%{GREEDYDATA:dest}] ~ %{GREEDYDATA:process}'
const nodeGrok = require('node-grok')
const _ = require('lodash')
process.env.UV_THREADPOOL_SIZE = 12
let argv = require('yargs')
  .usage('Usage: $0 [options]')
  .describe('file', 'File to be parsed for metrics')
  .describe('num', 'Number of entries per transaction')
  .describe('handlers', 'Number of notification handlers used in your test run')
  .demandOption(['f'])
  .demandOption(['n'])
  .help('h')
  .alias('h', 'help')
  .alias('f', 'file')
  .alias('n', 'num')
  .alias('m', 'handlers')
  .default('handlers', 1, 'default to one handler if handlers is not supplied')
  .argv

const LineByLineReader = require('line-by-line')
const lr = new LineByLineReader(argv.file)
let logMap = new Map()
let firstLine
let lastLine
let perEntryResponseWithLag = []
let perEntryResponseWithoutLag = []
let lineCount = 0
let totalSimTime = 0
let totalLagTime = 0
let transfersThatTakeLongerThanASecondWithLag = 0
let transfersThatTakeLongerThanASecondWithoutLag = 0

let beginTime = new Date()
let timeOnSimulatorList = []
let timeLagList = []
let longestTransactionWithLag
let longestTransactionWithoutLag

function compare (a, b) {
  const timestampA = a.timestamp
  const timeStampB = b.timestamp

  let comparison = 0
  if (timestampA > timeStampB) {
    comparison = 1
  } else if (timestampA < timeStampB) {
    comparison = -1
  }
  return comparison
}

function compareNumbers (a, b) {
  return a - b
}

lr.on('error', function (err) {
  throw err
})

lr.on('line', function (line) {
  lineCount++
  const patterns = nodeGrok.loadDefaultSync()
  const pattern = patterns.createPattern(p)
  const logLine = pattern.parseSync(line)
  if (logLine) {
    if (_.isEmpty(firstLine)) {
      firstLine = logLine
    }
    if (!logMap.get(logLine.uuid)) {
      logMap.set(logLine.uuid, {
        entries: [logLine]
      })
    } else {
      const entry = logMap.get(logLine.uuid)
      entry.entries.push(logLine)
      entry.entries.sort(compare)
      if (entry.entries.length === parseInt(argv.num)) {
        let mapOfSimLogs = new Map()
        for (let log of entry.entries) {
          if (log.process.includes('ML-Notification::prepare::message - START')) {
            if (mapOfSimLogs.get(log.uuid)) {
              let logs = mapOfSimLogs.get(log.uuid)
              logs.push(log)
              mapOfSimLogs.set(log.uuid, logs)
            } else {
              mapOfSimLogs.set(log.uuid, [log])
            }
          } else if (log.process.includes('ML-Notification::prepare::message - END')) {
            let logList = mapOfSimLogs.get(log.uuid)
            logList.push(log)
            mapOfSimLogs.set(log.uuid, logList)
          } else if (log.process.includes('Simulator::api::postTransfers - START')) {
            let logList = mapOfSimLogs.get(log.uuid)
            logList.push(log)
            mapOfSimLogs.set(log.uuid, logList)
          } else if (log.process.includes('Simulator::api::postTransfers - END')) {
            let logList = mapOfSimLogs.get(log.uuid)
            logList.push(log)
            mapOfSimLogs.set(log.uuid, logList)
          } else if (log.process.includes('ML-Notification::commit::message1 - START')) {
            let logList = mapOfSimLogs.get(log.uuid)
            logList.push(log)
            mapOfSimLogs.set(log.uuid, logList)
          } else if (log.process.includes('ML-Notification::commit::message1 - END')) {
            let logList = mapOfSimLogs.get(log.uuid)
            logList.push(log)
            mapOfSimLogs.set(log.uuid, logList)
          } else if (log.process.includes('ML-Notification::commit::message2 - START')) {
            let logList = mapOfSimLogs.get(log.uuid)
            logList.push(log)
            mapOfSimLogs.set(log.uuid, logList)
          } else if (log.process.includes('ML-Notification::commit::message2 - END')) {
            let logList = mapOfSimLogs.get(log.uuid)
            logList.push(log)
            mapOfSimLogs.set(log.uuid, logList)
          } else if (log.process.includes('Simulator::api::putTransfersById - START')) {
            let logList = mapOfSimLogs.get(log.uuid)
            logList.push(log)
            mapOfSimLogs.set(log.uuid, logList)
          } else if (log.process.includes('Simulator::api::putTransfersById - END')) {
            let logList = mapOfSimLogs.get(log.uuid)
            logList.push(log)
            mapOfSimLogs.set(log.uuid, logList)
          }
        }
        let postTransfersStart
        let postTransfersEnd
        let prepareMessageStart
        let prepareMessageEnd
        let commitMessage1Start
        let commitMessage1End
        let commitMessage2Start
        let commitMessage2End
        let putTransfersById1Start
        let putTransfersById1End
        let putTransfersById2Start
        let putTransfersById2End
        let value = mapOfSimLogs.get(logLine.uuid)
        for (let singleEntry of value) {
          if (singleEntry.process.includes('ML-Notification::prepare::message - START')) {
            prepareMessageStart = singleEntry
          } else if (singleEntry.process.includes('ML-Notification::prepare::message - END')) {
            prepareMessageEnd = singleEntry
          } else if (singleEntry.process.includes('Simulator::api::postTransfers - START')) {
            postTransfersStart = singleEntry
          } else if (singleEntry.process.includes('Simulator::api::postTransfers - END')) {
            postTransfersEnd = singleEntry
          } else if (singleEntry.process.includes('ML-Notification::commit::message1 - START')) {
            commitMessage1Start = singleEntry
          } else if (singleEntry.process.includes('ML-Notification::commit::message1 - END')) {
            commitMessage1End = singleEntry
          } else if (singleEntry.process.includes('ML-Notification::commit::message2 - START')) {
            commitMessage2Start = singleEntry
          } else if (singleEntry.process.includes('ML-Notification::commit::message2 - END')) {
            commitMessage2End = singleEntry
          } else if (singleEntry.process.includes('Simulator::api::putTransfersById - START')) {
            if (putTransfersById1Start === undefined) {
              putTransfersById1Start = singleEntry
            } else {
              putTransfersById2Start = singleEntry
            }
          } else if (singleEntry.process.includes('Simulator::api::putTransfersById - END')) {
            if (putTransfersById1End === undefined) {
              putTransfersById1End = singleEntry
            } else {
              putTransfersById2End = singleEntry
            }
          }
        }
        // let prepMessDiff = new Date(prepareMessageEnd.timestamp).getTime() - new Date(prepareMessageStart.timestamp).getTime()
        // let commMess1Diff = new Date(commitMessage1End.timestamp).getTime() - new Date(commitMessage1Start.timestamp).getTime()
        // let commMess2Diff = new Date(commitMessage2End.timestamp).getTime() - new Date(commitMessage2Start.timestamp).getTime()
        let postTransDiff = new Date(postTransfersEnd.timestamp).getTime() - new Date(postTransfersStart.timestamp).getTime()
        let putTrans1Diff = new Date(putTransfersById1End.timestamp).getTime() - new Date(putTransfersById1Start.timestamp).getTime()
        let putTrans2Diff = new Date(putTransfersById2End.timestamp).getTime() - new Date(putTransfersById2Start.timestamp).getTime()
        let prepMessPostTransLag = new Date(postTransfersStart.timestamp).getTime() - new Date(prepareMessageStart.timestamp).getTime()
        let postTransPrepMessLag = new Date(prepareMessageEnd.timestamp).getTime() - new Date(postTransfersEnd.timestamp).getTime()
        let commMess1PutTrans1Lag = new Date(putTransfersById1Start.timestamp).getTime() - new Date(commitMessage1Start.timestamp).getTime()
        let putTrans1CommMess1Lag = new Date(commitMessage1End.timestamp).getTime() - new Date(putTransfersById1End.timestamp).getTime()
        let commMess2PutTrans2Lag = new Date(putTransfersById2Start.timestamp).getTime() - new Date(commitMessage2Start.timestamp).getTime()
        let putTrans2CommMess2Lag = new Date(commitMessage2End.timestamp).getTime() - new Date(putTransfersById2End.timestamp).getTime()

        let timeOnSim = postTransDiff + putTrans1Diff + putTrans2Diff
        let totalLag = prepMessPostTransLag + postTransPrepMessLag + commMess1PutTrans1Lag + putTrans1CommMess1Lag + commMess2PutTrans2Lag + putTrans2CommMess2Lag
        timeOnSimulatorList.push(timeOnSim)
        timeLagList.push(totalLag)
        totalSimTime += timeOnSim
        totalLagTime += totalLag
        entry.totalDifferenceWithLag = new Date(entry.entries[entry.entries.length - 1].timestamp).getTime() - new Date(entry.entries[0].timestamp).getTime() - timeOnSim
        entry.totalDifferenceWithoutLag = entry.totalDifferenceWithLag - totalLag
        perEntryResponseWithLag.push(entry.totalDifferenceWithLag)
        perEntryResponseWithoutLag.push(entry.totalDifferenceWithoutLag)
        if (perEntryResponseWithLag.length === 4490) {
          console.log('max messages reached')
        }
        if (entry.totalDifferenceWithLag >= 1000) {
          transfersThatTakeLongerThanASecondWithLag++
        }
        if (entry.totalDifferenceWithoutLag >= 1000) {
          transfersThatTakeLongerThanASecondWithoutLag++
        }
        if (longestTransactionWithLag) {
          if(longestTransactionWithLag.entry.totalDifferenceWithLag < entry.totalDifferenceWithLag){
            longestTransactionWithLag = {
              transferId: entry.entries[0].uuid,
              entry
            }
          }
        }else {
          longestTransactionWithLag = {
            transferId: entry.entries[0].uuid,
            entry
          }
        }
        if (longestTransactionWithoutLag) {
          if(longestTransactionWithoutLag.entry.totalDifferenceWithoutLag < entry.totalDifferenceWithoutLag){
            longestTransactionWithoutLag = {
              transferId: entry.entries[0].uuid,
              entry
            }
          }
        }else {
          longestTransactionWithoutLag = {
            transferId: entry.entries[0].uuid,
            entry
          }
        }

      }
      logMap.set(logLine.uuid, entry)
    }
    lastLine = logLine
  }
})

lr.on('end', function () {
  const meanWithLag = (perEntryResponseWithLag.reduce((a, b) => a + b) / perEntryResponseWithLag.length)
  const meanWithoutLag = (perEntryResponseWithoutLag.reduce((a, b) => a + b) / perEntryResponseWithoutLag.length)
  let differenceFromMeanSquaredWithLag = []
  let differenceFromMeanSquaredWithoutLag = []
  for (let entry of perEntryResponseWithLag) {
    differenceFromMeanSquaredWithLag.push(Math.pow((entry - meanWithLag), 2))
  }
  for (let entry of perEntryResponseWithoutLag) {
    differenceFromMeanSquaredWithoutLag.push(Math.pow((entry - meanWithoutLag), 2))
  }
  const firstTime = new Date(firstLine.timestamp).getTime()
  const lastTime = new Date(lastLine.timestamp).getTime()
  const totalTransactions = perEntryResponseWithLag.length

  let varianceWithLag = (differenceFromMeanSquaredWithLag.reduce((a, b) => a + b) / differenceFromMeanSquaredWithLag.length)
  let standardDeviationWithLag = Math.sqrt(varianceWithLag)
  const totalTimeWithLag = ((lastTime - firstTime) - (totalSimTime / argv.handlers))
  const sortedPerEntryResponseWithLag = perEntryResponseWithLag.sort(compareNumbers)
  const shortestResponseWithLag = sortedPerEntryResponseWithLag[0]
  const longestResponseWithLag = sortedPerEntryResponseWithLag[perEntryResponseWithLag.length - 1]
  const sortedTimeForSimulatorListWithLag = timeOnSimulatorList.sort(compareNumbers)

  let varianceWithoutLag = (differenceFromMeanSquaredWithoutLag.reduce((a, b) => a + b) / differenceFromMeanSquaredWithoutLag.length)
  let standardDeviationWithoutLag = Math.sqrt(varianceWithoutLag)
  const totalTimeWithoutLag = totalTimeWithLag - (totalLagTime / argv.handlers)
  const sortedPerEntryResponseWithoutLag = perEntryResponseWithoutLag.sort(compareNumbers)
  const shortestResponseWithoutLag = sortedPerEntryResponseWithoutLag[0]
  const longestResponseWithoutLag = sortedPerEntryResponseWithoutLag[perEntryResponseWithoutLag.length - 1]
  const sortedTimeForSimulatorListWithoutLag = timeOnSimulatorList.sort(compareNumbers)

  console.log(`Started processing ${argv.file} at ${beginTime}`)
  console.log('First request: ' + firstLine.timestamp)
  console.log('Last request: ' + lastLine.timestamp)
  console.log('Total number of lines in log file: ' + lineCount)
  console.log('Number of unique matched entries: ' + totalTransactions)
  console.log('')
  console.log('')
  console.log('')
  console.log('Shortest response time in millisecond with lag: ' + shortestResponseWithLag)
  console.log('Longest response time in millisecond with lag: ' + longestResponseWithLag)
  console.log('Mean/The average time a transaction takes in millisecond with lag: ' + meanWithLag)
  console.log('Variance in milliseconds with lag: ' + varianceWithLag)
  console.log('Standard deviation in milliseconds with lag: ' + standardDeviationWithLag)
  console.log('Estimated total difference of all requests in milliseconds with averaged handler lag: ' + (totalTimeWithLag))
  console.log('Number of entries that took longer than a second with lag: ' + transfersThatTakeLongerThanASecondWithLag)
  console.log(`% of entries that took longer than a second with lag: ${(transfersThatTakeLongerThanASecondWithLag / totalTransactions * 100).toFixed(2)}%`)
  console.log(`The longest transaction with lag was: ${longestTransactionWithLag.transferId}`)
  console.log('Estimate of average transactions per second with lag: ' + (totalTransactions / (totalTimeWithLag / 1000)))
  console.log(`Total time waiting for mock server in milliseconds for ${argv.handlers} notification handlers: ${totalSimTime} and average of ${totalSimTime / argv.handlers} per handler`)
  console.log('Average time per transaction taken on simulator in milliseconds: ' + (timeOnSimulatorList.reduce((a, b) => a + b) / timeOnSimulatorList.length))
  console.log('Shortest transaction time taken on simulator in milliseconds with lag: ' + sortedTimeForSimulatorListWithLag[0])
  console.log('Longest transaction time taken on simulator in milliseconds with lag: ' + sortedTimeForSimulatorListWithLag[timeOnSimulatorList.length - 1])
  console.log('')
  console.log('')
  console.log('')
  console.log('Shortest response time in millisecond without lag: ' + shortestResponseWithoutLag)
  console.log('Longest response time in millisecond without lag: ' + longestResponseWithoutLag)
  console.log('Mean/The average time a transaction takes in millisecond without lag: ' + meanWithoutLag)
  console.log('Variance in milliseconds without lag: ' + varianceWithoutLag)
  console.log('Standard deviation in milliseconds without lag: ' + standardDeviationWithoutLag)
  console.log('Estimated total difference of all requests in milliseconds without averaged handler lag: ' + (totalTimeWithoutLag))
  console.log('Number of entries that took longer than a second without lag: ' + transfersThatTakeLongerThanASecondWithoutLag)
  console.log(`% of entries that took longer than a second without lag: ${(transfersThatTakeLongerThanASecondWithoutLag / totalTransactions * 100).toFixed(2)}%`)
  console.log(`The longest transaction without lag was: ${longestTransactionWithoutLag.transferId}`)
  console.log('Estimate of average transactions per second without lag: ' + (totalTransactions / (totalTimeWithoutLag / 1000)))
  console.log(`Total lag time in milliseconds for ${argv.handlers} notification handlers: ${totalLagTime} and average of ${totalLagTime / argv.handlers} per handler`)
  console.log('Average time per transaction taken on lag in milliseconds: ' + (timeLagList.reduce((a, b) => a + b) / timeLagList.length))
  console.log('Shortest transaction time taken on simulator in milliseconds without lag: ' + sortedTimeForSimulatorListWithoutLag[0])
  console.log('Longest transaction time taken on simulator in milliseconds without lag: ' + sortedTimeForSimulatorListWithoutLag[timeLagList.length - 1])

  console.log('Total time that script takes to run in seconds: ' + (new Date().getTime() - beginTime.getTime()) / 1000)

})
