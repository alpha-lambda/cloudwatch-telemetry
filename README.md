# cloudwatch-telemetry

[![Build Status][ci-image]][ci-url]
[![Coverage Status][coverage-image]][coverage-url]
[![NPM version][npm-image]][npm-url]
[![Dependencies Status][dependencies-image]][dependencies-url]
[![DevDependencies Status][devdependencies-image]][devdependencies-url]

[Serverless][serverless-url] app to store custom `CloudWatch` metrics in a cost-effective way. The app works as follows:

```
CloudWatch logs with datapoints --> Kinesis Stream --> Lambda function --> CloudWatch metrics
```

## Deployment

To deploy an instance of the app, run the following commands:
```shell
nvm use
npm ci
npm run deploy -- [--stage STAGE] [--region REGION] [--alarmAction ALARM_ACTION] [--insufficientDataAction INSUFFICIENT_DATA_ACTION] [--okAction OK_ACTION] [--logLevel LOG_LEVEL] [--batchSize BATCH_SIZE] [--retentionHours RETENTION_HOURS] [--shardCount SHARD_COUNT]
```

- `REGION`: (Optional) AWS region to deploy the app to. Defaults to `us-east-1`.
- `STAGE`: (Optional) Environment to deploy the app to. Defaults to `dev`.
- `ALARM_ACTION`: (Optional) ARN of an action to execute (e.g. `SNS` topic) when any alarm transitions into an `ALARM` state.
- `INSUFFICIENT_DATA_ACTION`: (Optional) ARN of an action to execute (e.g. `SNS` topic) when any alarm transitions into an `INSUFFICIENT_DATA` state.
- `OK_ACTION`: (Optional) ARN of an action to execute (e.g. `SNS` topic) when any alarm transitions into an `OK` state.
- `LOG_LEVEL`: (Optional) Logger level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`). Defaults to `info`.
- `BATCH_SIZE`: (Optional) The largest number of records that Lambda function retrieves from the `Kinesis` stream. Defaults to `1000`.
- `RETENTION_HOURS`: (Optional) The number of hours for the data records that are stored in shards to remain accessible. Defaults to `24`.
- `SHARD_COUNT`: (Optional) The number of shards that the stream uses. Defaults to `1`.

## Tearing Down

To remove an instance of the app, run the following commands:
```shell
nvm use
npm ci
npm run remove -- [--stage STAGE] [--region REGION]
```

## Integration

### CloudFormation stack

The app is deployed to the specified region using `CloudFormation` stack called `cw-telemetry-<STACK>`. Stack outputs:

Key|Name|Description|Value
--|---|---|--
IngestionStreamArn|`cw-telemetry-<STAGE>-ingestion-stream-arn`|The ARN for the `Kinesis` stream to forward logs to|`arn:aws:kinesis:<REGION>:<ACCOUNT_ID>:stream/cw-telemetry-<STAGE>-ingestion-stream`
ServiceRoleArn|`cw-telemetry-<STAGE>-service-role-arn`|The ARN for the `IAM` role to assume|`arn:aws:iam::<ACCOUNT_ID>:role/cw-telemetry-<STAGE>-<REGION>-role`

### Log Format

Log records need to be in a `JSON` format and contain `datapoints` property. Each datapoint needs to contain the following:

- `name`: (String [1..] / Required) The name of the metric
- `namespace`: (String [1..] / Required) The namespace for the metric data
- `dimensions`: (Object / Required) The dimensions associated with the metric (key-value pairs)
- `points`: (Object[] / Required) One or more `value`/`timestamp` pairs, where:
  - `value`: (Float [0..] / Required) The value for the datapoint
  - `timestamp`: (Integer / Required) The time the datapoint data was received, expressed as the number of milliseconds since Jan 1, 1970 00:00:00 UTC
- `unit`: (String [[valid values][metric-datum-url]] / Optional) The unit of the metric

Sample log record:

```json
{
  "awsRequestId": "a669b165-ea14-11e8-8246-4d697629d57f",
  "requestId": "a669b165-ea14-11e8-8246-4d697629d57f",
  "level": 30,
  "datapoints": [
      {
          "namespace": "big-service-test",
          "name": "invocationCount",
          "dimensions": {
              "functionName": "createEntity",
              "customerId": "00000000-0000-0000-0000-000000000000"
          },
          "points": [{
            "timestamp": 1542423506412,
            "value": 1
          }],
          "unit": "Count"
      },
      {
          "namespace": "big-service-test",
          "timestamp": 1542423508235,
          "name": "capacityUsed",
          "dimensions": {
              "tableName": "mainTable"
          },
          "points": [
            {
              "timestamp": 1542423508235,
              "value": 23
            },
            {
              "timestamp": 1542423406280,
              "value": 18
            }
          ],
          "unit": "Count"
      }
  ],
  "time": "2018-11-17T02:58:27.596Z",
  "message": "datapoints for cw-telemetry"
}
```

### DatapointCollector

`DatapointCollector` class makes it easier to aggregate datapoints.

#### new DatapointCollector([options])
Creates a new instance, where:
- **options** - { Object } - a config object with the following keys:
	- **log** - { Function } - logger function to use for printing out datapoints
	- **namespace** - { String [1..] } - namespace for the metric data
	- **[auto]** - { Boolean } - enables automatic mode when aggregated datapoints are flushed at defined interval [defaults to `false`]
	- **[flushFrequency]** - { Number [1..] } - flush frequency for the automatic mode defined in milliseconds [defaults to `20000`]
	- **[maxDatapointsPerFlush]** - { Number [1..] } - max number of datapoints to include in a single log record [defaults to `500`]

##### Example
```js
const bunyan = require('bunyan');
const DatapointCollector = require('cloudwatch-telemetry');

var log = bunyan.createLogger({ name: 'service' });
const datapointCollector = new DatapointCollector({
  log: log.info.bind(log),
  namespace: 'service-prod'
});
```

#### add(datapoints)
Stores datapoints, where:
- **datapoints** - { Object | Object[]} - an object or collection that contains datapoints:
	- **name** - { String [1..] } - name of the metric
  - **dimensions** - { Object } - dimensions associated with the metric (key-value pairs)
  - **value** - { Number [0..] } value for the datapoint
  - **[unit]** - { String } - unit of the metric ([valid values][metric-datum-url])

#### clear()
Deletes all the stored datapoints

#### flush()
Flushes all the stored datapoints

#### getAll()
Retrieves all the stored datapoints

#### stop()
Stops datapoints collector in the automatic mode and flushes all the stored datapoints

#### UNITS
List of all the [units supported][metric-datum-url]:
  - `BITS`
  - `BITS_SECOND`
  - `BYTES`
  - `BYTES_SECOND`
  - `COUNT`
  - `COUNT_SECOND`
  - `GIGABITS`
  - `GIGABITS_SECOND`
  - `GIGABYTES`
  - `GIGABYTES_SECOND`
  - `KILOBITS`
  - `KILOBITS_SECOND`
  - `KILOBYTES`
  - `KILOBYTES_SECOND`
  - `MEGABITS`
  - `MEGABITS_SECOND`
  - `MEGABYTES`
  - `MEGABYTES_SECOND`
  - `MICROSECONDS`
  - `MILLISECONDS`
  - `NONE`
  - `PERCENT`
  - `SECONDS`
  - `TERABITS`
  - `TERABITS_SECONDS`
  - `TERABYTES`
  - `TERABYTES_SECOND`

### Log Forwarding

Log records need to be forwarded to the `Kinesis` stream using [Subscription Filter][subscription-filter-url]. If you are using [Serverless framework][serverless-url] in your app, the easiest way would be to use [serverless-plugin-log-subscription][serverless-plugin-log-subscription-url].

## License

The MIT License (MIT)

Copyright (c) 2019 Anton Bazhal

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[ci-image]: https://circleci.com/gh/alpha-lambda/cloudwatch-telemetry.svg?style=shield&circle-token=4873550a7f86ecf93fe8870f86944aa535250ec2
[ci-url]: https://circleci.com/gh/alpha-lambda/cloudwatch-telemetry
[coverage-image]: https://coveralls.io/repos/github/alpha-lambda/cloudwatch-telemetry/badge.svg?branch=master
[coverage-url]: https://coveralls.io/github/alpha-lambda/cloudwatch-telemetry?branch=master
[dependencies-url]: https://david-dm.org/alpha-lambda/cloudwatch-telemetry
[dependencies-image]: https://david-dm.org/alpha-lambda/cloudwatch-telemetry/status.svg
[devdependencies-url]: https://david-dm.org/alpha-lambda/cloudwatch-telemetry?type=dev
[devdependencies-image]: https://david-dm.org/alpha-lambda/cloudwatch-telemetry/dev-status.svg
[npm-url]: https://www.npmjs.org/package/@alpha-lambda/cloudwatch-telemetry
[npm-image]: https://img.shields.io/npm/v/@alpha-lambda/cloudwatch-telemetry.svg
[metric-datum-url]: https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_MetricDatum.html
[serverless-plugin-log-subscription-url]: https://github.com/dougmoscrop/serverless-plugin-log-subscription
[serverless-url]: https://serverless.com/
[subscription-filter-url]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-logs-subscriptionfilter.html
