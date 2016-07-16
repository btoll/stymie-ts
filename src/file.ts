/// <reference path="../typings/index.d.ts" />

import * as inquirer from 'inquirer';
import * as cp from 'child_process';
import which from 'which';
import * as jcrypt from 'jcrypt';
import * as util from './util';

const logError = util.logError;
const logInfo = util.logInfo;
const logSuccess = util.logSuccess;
const env = process.env;
const cwd = process.cwd();
const keyDir = `${env.STYMIE || env.HOME}/.stymie.d/s`;
import { Answer, Stymie } from './interfaces';

function openEditor(file: string, callback: Function): void {
    const editor = env.EDITOR || 'vim';
    const args = require(`${cwd}/editors/${editor}`);

    // The editor modules will only contain the CLI args so we need to push on the filename.
    args.push(file);

    cp.spawn(editor, args, {
        stdio: 'inherit'
    }).on('exit', callback);
}

export const file: Stymie = {
    add: key => {
        if (!key) {
            logError('Must supply a file name');
            return;
        }

        const hashedFilename = util.hashFilename(key);

        // This seems counter-intuitive because the resolve and reject operations
        // are reversed, but this is b/c the success case is when the file does not
        // exist (and thus will throw an exception).
        util.fileExists(`${keyDir}/${hashedFilename}`)
        .then((): void => logError('File already exists'))
        .catch((): string =>
            jcrypt.stream(key, `${keyDir}/${hashedFilename}`, {
                gpg: util.getGPGArgs(),
                file: {
                    flags: 'w',
                    defaultEncoding: 'utf8',
                    fd: null,
                    mode: 0o0600
                }
            }, true)
            .then(() => logSuccess('File created successfully'))
            .catch(logError)
        );
    },

    edit: key => {
        const hashedFilename = util.hashFilename(key);
        const path = `${keyDir}/${hashedFilename}`;

        util.fileExists(path).then(() =>
            jcrypt(path, null, ['--decrypt'])
            .then((): void =>
                openEditor(path, () =>
                    // Re-encrypt once done.
                    jcrypt(path, null, util.getGPGArgs())
                    .then(() => logInfo('Re-encrypting and closing the file'))
                    .catch(logError)
                )
            )
            .catch(logError)
        )
        .catch(logError);
    },

    get: key => {
        const hashedFilename = util.hashFilename(key);

        util.fileExists(`${keyDir}/${hashedFilename}`)
        .then((file: string): string =>
            // Pipe to stdout.
            jcrypt.stream(file, null, ['--decrypt'])
            .catch(logError)
        )
        .catch(logError);
    },

    has: key => {
        const hashedFilename = util.hashFilename(key);

        util.fileExists(`${keyDir}/${hashedFilename}`)
        .then(():void => logInfo('File exists'))
        .catch(logError);
    },

    list: () => {},

    rm: (() => {
        function rm(file: string): Promise<{}> {
            return new Promise((resolve: Function, reject: Function): void =>
                which('shred', (err: string): void => {
                    let rm;

                    if (err) {
                        logInfo('Your OS doesn\`t have the `shred` utility installed, falling back to `rm`...');
                        rm = cp.spawn('rm', [file]);
                    } else {
                        rm = cp.spawn('shred', ['--zero', '--remove', file]);
                    }

                    rm.on('close', (code: number): void => {
                        if (code !== 0) {
                            reject('Something terrible happened!');
                        } else {
                            resolve('The file has been removed');
                        }
                    });
                })
            );
        }

        return (key: string): void => {
            const hashedFilename = util.hashFilename(key);
            const path = `${keyDir}/${hashedFilename}`;

            util.fileExists(path)
            .then(() =>
                inquirer.prompt([{
                    type: 'list',
                    name: 'rm',
                    message: 'Are you sure?',
                    choices: [
                        {name: 'Yes', value: true},
                        {name: 'No', value: false}
                    ]
                }], (answers: Answer) => {
                    if (answers.rm) {
                        rm(path)
                        .then(logSuccess)
                        .catch(logError);
                    } else {
                        logInfo('No removal');
                    }
                })
            )
            .catch(logError);
        };
    })()
};

