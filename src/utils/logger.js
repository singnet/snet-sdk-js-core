import createLogger from 'winston/dist/winston/create-logger';
import { format } from 'logform';
import winston from 'winston';

const logger = createLogger({
  format: format.simple(),
  level: process.env.DEBUG ? 'silly' : 'info',
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logfile.log' })
  ]
});

export default logger;
