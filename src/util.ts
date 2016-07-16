/// <reference path="../typings/index.d.ts" />

import * as logger from 'logger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { GPGOptions, HasChanged } from './interfaces';

const logError = logger.error;
const logWarn = logger.warn;

let gpgOptions: GPGOptions;

export = {
    log: logger.log,
    logError: logError,
    logInfo: logger.info,
    logRaw: logger.raw,
    logSuccess: logger.success,
    logWarn: logWarn,

    fileExists: (path: string): Promise<{}> =>
        new Promise((resolve: Function, reject: Function): void => {
            fs.stat(path, err => {
                if (err) {
                    reject('No matching entry');
                } else {
                    resolve(path);
                }
            });
        }),

    getGPGArgs: (): string[] => {
        let arr = ['--encrypt', '-r', gpgOptions.recipient];

        if (gpgOptions.armor) {
            arr.push('--armor');
        }

        if (gpgOptions.sign) {
            arr.push('--sign');
        }

        return arr;
    },

    setGPGOptions: (data: string): void => gpgOptions = JSON.parse(data),

    hasChanged: (hasChanged: HasChanged, originalValue: string, input: string): boolean => {
        if (originalValue !== input) {
            hasChanged.changed = true;
        }

        return true;
    },

    hashFilename: (file: string): string => {
        if (!file) {
            return;
        }

        return crypto.createHash(gpgOptions.hash).update(file).digest('hex');
    },

    noBlanks: (input?: string): boolean => {
        let res = true;

        if (!input) {
            logError('Cannot be blank');
            res = false;
        }

        return res;
    },

    noDuplicates: (current: string, list: string[], input: string): boolean => {
        let res = true;

        if ((current !== input) && list[input]) {
            logWarn('Key already exists');
            res = false;
        }

        return res;
    }
};

