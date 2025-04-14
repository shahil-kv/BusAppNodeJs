import fs from 'fs';
import logger from '../logger/winston.logger';
import { Request } from 'express';

export const filterObjectKeys = (fieldsArray: string[], objectArray) => {
  const filteredArray = structuredClone(objectArray).map((originalObj) => {
    const obj = {};
    structuredClone(fieldsArray)?.forEach((field) => {
      if (field?.trim() in originalObj) {
        obj['field'] = originalObj[field];
      }
    });
    if (Object.keys(obj).length > 0) return obj;
    return originalObj;
  });
  return filteredArray;
};

/**
 *
 * @param {import("express").Request} req
 * @param {string} fileName
 * @description returns the file's static path from where the server is serving the static image
 */
export const getStaticFilePath = (req: Request, fileName: string) => {
  return `${req.protocol}://${req.get('host')}/images/${fileName}`;
};

/**
 *
 * @param {string} fileName
 * @description returns the file's local path in the file system to assist future removal
 */
export const getLocalPath = (fileName) => {
  return `public/images/${fileName}`;
};

/**
 *
 * @param {string} localPath
 * @description Removed the local file from the local file system based on the file path
 */
export const removeLocalFile = (localPath) => {
  fs.unlink(localPath, (err) => {
    if (err) logger.error('Error while removing local files: ', err);
    else {
      logger.info('Removed local: ', localPath);
    }
  });
};
