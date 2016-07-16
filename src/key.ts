/// <reference path="../typings/index.d.ts" />

import * as diceware from 'diceware';
import * as inquirer from 'inquirer';
import * as jcrypt from 'jcrypt';
import generateKey from './generateKey';
import * as libFile from './file';
import * as libUtil from './util';
import { Answer, HasChanged, Stymie } from './interfaces';

const log = libUtil.log;
const logError = libUtil.logError;
const logInfo = libUtil.logInfo;
const logRaw = libUtil.logRaw;
const logSuccess = libUtil.logSuccess;
const env = process.env;
const keyFile = `${env.STYMIE || env.HOME}/.stymie.d/k`;
const reWhitespace = /\s/g;

export const key: Stymie = {
    add(key) {
        generateKey(key);
    },

    edit(key) {
        jcrypt(keyFile, null, ['--decrypt'], true)
        .then((data: string): void => {
            const list: string[] = JSON.parse(data);
            const entry = list[key];
            let prompts, hasChanged: HasChanged;

            if (entry) {
                hasChanged = {
                    changed: false
                };

                prompts = [{
                    type: 'input',
                    name: 'key',
                    message: 'Edit key:',
                    default: key,
                    validate: libUtil.noDuplicates.bind(null, key, list)
                }];

                for (const n in entry) {
                    if (entry.hasOwnProperty(n)) {
                        prompts.push({
                            type: 'input',
                            name: n,
                            message: `Edit ${n}:`,
                            default: entry[n],
                            validate: libUtil.hasChanged.bind(null, hasChanged, n)
                        });
                    }
                }

                inquirer.prompt(prompts, (answers: Answer) => {
                    const entry = answers.key;
                    let item = list[key];

                    if (entry !== key) {
                        // Remove old key.
                        delete list[key];

                        item = list[key] = {};

                        // Note if the key has changed the condition
                        // below will always pass.
                    }

                    if (hasChanged.changed) {
                        for (const n in answers) {
                            if (answers.hasOwnProperty(n) && n !== 'key') {
                                item[n] = answers[n];
                            }
                        }

                        jcrypt.stream(JSON.stringify(list, null, 4), keyFile, {
                            gpg: libUtil.getGPGArgs(),
                            file: {
                                flags: 'w',
                                defaultEncoding: 'utf8',
                                fd: null,
                                mode: 0o0600
                            }
                        }, true)
                        .then((): void => logSuccess('Key has been updated'))
                        .catch(logError);
                    } else {
                        logInfo('No change');
                    }
                });
            } else {
                logInfo('No matching key');
            }
        })
        .catch(logError);
    },

    generate() {
        log(diceware.generate());
    },

    get(key, field) {
        jcrypt(keyFile, null, ['--decrypt'], true)
        .then((data: string): void => {
            const list = JSON.parse(data);
            const entry = list[key];

            if (entry) {
                if (!field) {
                    for (const n in entry) {
                        if (entry.hasOwnProperty(n) && n !== 'key') {
                            logRaw(`${n}: ${this.stripped(entry[n])}`);
                        }
                    }
                } else {
                    const f = entry[field];

                    if (!f) {
                        logError('No field found');
                    } else {
                        // Don't log here b/c we don't want the newline char! This is best when
                        // copying to clipboard, i.e.:
                        //
                        //      stymie get example.com -f password -s | pbcopy
                        //
                        // To view the logged output, get the whole entry (don't specify a `field`).
                        process.stdout.write(this.stripped(f));
                    }
                }
            } else {
                logInfo('No matching key');
            }
        })
        .catch(logError);
    },

    has(key) {
        jcrypt(keyFile, null, ['--decrypt'], true)
        .then((data: string): void =>
            logInfo(
                JSON.parse(data)[key] ?
                    'Key exists' :
                    'No matching key'
            )
        )
        .catch(logError);
    },

    list() {
        jcrypt(keyFile, null, ['--decrypt'], true)
        .then((data: string): void => {
            const keys = Object.keys(JSON.parse(data));

            logInfo(
                !keys.length ?
                    'No installed keys' :
                    `Installed keys: ${keys.sort().join(', ')}`
            );
        });
    },

    rm(key) {
        jcrypt(keyFile, null, ['--decrypt'], true)
        .then((data: string): Promise<{}> => {
            const list = JSON.parse(data);

            return new Promise((resolve: Function, reject: Function): void => {
                if (list[key]) {
                    inquirer.prompt([{
                        type: 'list',
                        name: 'rm',
                        message: 'Are you sure?',
                        choices: [
                            {name: 'Yes', value: true},
                            {name: 'No', value: false}
                        ],
                        default: false
                    }], (answers: Answer) => {
                        if (answers.rm) {
                            delete list[key];
                            resolve(list);

                        } else {
                            reject('No removal');
                        }
                    });
                } else {
                    reject('No matching key');
                }
            });
        })
        .then(list =>
            jcrypt.stream(JSON.stringify(list, null, 4), keyFile, {
                gpg: libUtil.getGPGArgs(),
                file: {
                    flags: 'w',
                    defaultEncoding: 'utf8',
                    fd: null,
                    mode: 0o0600
                }
            }, true)
            .then(():void => logSuccess('Key has been removed'))
            .catch(logError)
        )
        .catch(logError);
    },

    // This method is expected to be called immediately with the value of `strip` that was passed
    // on the CLI (see `bin/stymie`). The intent is then to redefine the method with the value of
    // `strip` partially applied.  This will save us from having to always pass through the value
    // of `strip` as a function parameter.
    stripped(strip) {
        this.stripped = (field: string): string => {
            let f = field;

            if (strip) {
                f = field.replace(reWhitespace, '');
            }

            return f;
        }
    }
};

