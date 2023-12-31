require('dotenv').config();

const axios = require('axios');
const _ = require('lodash');
const moment = require('moment-timezone');
const mongoose = require('mongoose');
const { DateTime } = require('luxon');

const Profile = require('./profile');

const SheetHandler = require('./sheet');

const headers = require('./header.json');

const TIMEZONE = 'Asia/Saigon';

const RANGE_TYPES = {
  '1day': {
    subtract: 0,
    endOf: 'day',
  },
  '1week': {
    subtract: 6,
    endOf: 'day',
  },
  '1month': {
    subtract: 29,
    endOf: 'day',
  },
};

const getRangeDates = (date, type) => {
  const { subtract, endOf } = RANGE_TYPES[type] || {};
  const from = moment
    .tz(date, TIMEZONE)
    .subtract(subtract || 0, 'days')
    .startOf('day')
    .utc()
    .valueOf();
  const to = moment
    .tz(date, TIMEZONE)
    .endOf(endOf || 'day')
    .utc()
    .valueOf();

  return {
    from,
    to,
  };
};

const getTotalActive = async (target, type, isTrainer) => {
  const range = getRangeDates(target, type);

  try {
    const response = await axios({
      url: 'https://app.datadoghq.com/api/ui/query/scalar',
      method: 'post',
      headers,
      data: {
        meta: {
          dd_extra_usage_params: {},
          use_multi_step: true,
          use_frontend_step_interval: true,
        },
        data: [
          {
            type: 'scalar_request',
            attributes: {
              formulas: [
                {
                  formula: 'a',
                },
              ],
              queries: [
                {
                  name: 'a',
                  data_source: 'logs',
                  compute: {
                    aggregation: 'cardinality',
                    metric: '@user.id',
                  },
                  search: {
                    query: `@endpoint:*/api/profile/v2/* env:prd @user.is_trainer:${isTrainer}`,
                  },
                  indexes: ['*'],
                  group_by: [],
                  storage: 'hot',
                },
              ],
              from: range.from,
              to: range.to,
            },
          },
        ],
        _authentication_token: process.env.DATA_DOG_TOKEN,
      },
    });

    return {
      range: `${new Date(range.from)} - ${new Date(range.to)}`,
      total: _.get(response, 'data.data[0].attributes.columns[0].values[0]'),
    };
  } catch (error) {
    console.error('An error occurred:', error);
    throw error; // Rethrow the error to be handled by the caller
  }
};

const getTotalCreated = async (target, type, isTrainer) => {
  const range = getRangeDates(target, type);

  try {
    const createdUser = await Profile.countDocuments({
      is_demo: false,
      is_trainer: isTrainer,
      createdAt: { $gte: range.from, $lte: range.to },
    });

    return {
      range: `${new Date(range.from)} - ${new Date(range.to)}`,
      total: createdUser,
    };
  } catch (error) {
    console.error('An error occurred:', error);
    throw error; // Rethrow the error to be handled by the caller
  }
};

const report = async (target) => {
  try {
    const [
      dayActiveTrainer,
      weekActiveTrainer,
      monthActiveTrainer,
      dayActiveClient,
      weekActiveClient,
      monthActiveClient,
    ] = await Promise.all([
      getTotalActive(target, '1day', true),
      getTotalActive(target, '1week', true),
      getTotalActive(target, '1month', true),
      getTotalActive(target, '1day', false),
      getTotalActive(target, '1week', false),
      getTotalActive(target, '1month', false),
    ]);
    console.log('Get total active success');
    const activeData = `${dayActiveClient.total}\t${weekActiveClient.total}\t${monthActiveClient.total}\t${dayActiveTrainer.total}\t${weekActiveTrainer.total}\t${monthActiveTrainer.total}`;
    console.log(target, 'activeData :', activeData);

    const [
      dayCreatedTrainer,
      weekCreatedTrainer,
      monthCreatedTrainer,
      dayCreatedClient,
      weekCreatedClient,
      monthCreatedClient,
    ] = await Promise.all([
      getTotalCreated(target, '1day', true),
      getTotalCreated(target, '1week', true),
      getTotalCreated(target, '1month', true),
      getTotalCreated(target, '1day', false),
      getTotalCreated(target, '1week', false),
      getTotalCreated(target, '1month', false),
    ]);
    console.log('Get total created success');
    const createdData = `${dayCreatedClient.total}\t${weekCreatedClient.total}\t${monthCreatedClient.total}\t${dayCreatedTrainer.total}\t${weekCreatedTrainer.total}\t${monthCreatedTrainer.total}`;
    console.log(target, 'createdData:', createdData);

    return {
      acd: dayActiveClient.total,
      acw: weekActiveClient.total,
      acm: monthActiveClient.total,
      atd: dayActiveTrainer.total,
      atw: weekActiveTrainer.total,
      atm: monthActiveTrainer.total,
      tccd: dayCreatedClient.total,
      tccw: weekCreatedClient.total,
      tccm: monthCreatedClient.total,
      tctd: dayCreatedTrainer.total,
      tctw: weekCreatedTrainer.total,
      tctm: monthCreatedTrainer.total,
    };
  } catch (error) {
    console.error('An error occurred:', error);
    throw error; // Rethrow the error to be handled by the caller
  }
};

// eslint-disable-next-line unicorn/prefer-top-level-await
(async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('Please set MONGODB_URI via .env');
  }
  if (!process.env.DATA_DOG_TOKEN) {
    throw new Error('Please set DATA_DOG_TOKEN via .env');
  }
  if (!process.env.GOOGLE_SHEET_EMAIL) {
    throw new Error('Please set GOOGLE_SHEET_EMAIL via .env');
  }
  if (!process.env.GOOGLE_SHEET_ID) {
    throw new Error('Please set GOOGLE_SHEET_ID via .env');
  }
  console.log('Check env success');
  console.time('Finish');

  console.time('Connect mongodb');
  await mongoose.connect(process.env.MONGODB_URI);
  console.timeEnd('Connect mongodb');

  const yesterday = DateTime.fromObject({}, { zone: TIMEZONE }).minus({ day: 1 });
  const target = yesterday.toFormat('yyyy-MM-dd');
  console.time('Get report data');
  const result = await report(target);
  console.timeEnd('Get report data');

  console.time(`Push data to google sheet: ${target}`);
  await SheetHandler(target, result);

  console.timeEnd(`Push data to google sheet: ${target}`);

  mongoose.connection.close();
  console.timeEnd('Finish');
})();
