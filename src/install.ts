import * as fs from 'fs';
import * as cp from 'child_process';
import * as jcrypt from 'jcrypt';
import * as util from './util';
import { Answer, GPGOptions } from './interfaces';

const logError = util.logError;
const logSuccess = util.logSuccess;

module.exports = () =>
    require('inquirer').prompt([{
        type: 'input',
        name: 'installDir',
        message: 'Enter directory to install .stymie.d:',
        default: '~'
    }, {
        type: 'input',
        name: 'envFile',
        message: 'We need to export a $STYMIE environment variable.\nName of shell startup file to which the new env var should be written:',
        default: '.bashrc',
        when: (answers: Answer): boolean => answers.installDir !== '~'
    }, {
        type: 'input',
        name: 'recipient',
        message: 'Enter the email address or key ID of your public key:',
        validate: (input?: string): boolean => {
            let res = true;

            if (!input) {
                logError('Cannot be blank');
                res = false;
            }

            return res;
        }
    }, {
        type: 'list',
        name: 'armor',
        message: 'Select how GPG/PGP will encrypt the password files:',
        choices: [
            {name: 'Binary', value: false},
            {name: 'Armored ASCII Text', value: true}
        ],
        default: false
    }, {
        type: 'list',
        name: 'sign',
        message: 'Should GPG/PGP also sign the password files? (Recommended):',
        choices: [
            {name: 'Yes', value: true},
            {name: 'No', value: false}
        ],
        default: true
    }, {
        type: 'input',
        name: 'hash',
        message: 'What hashing algorithm should be used for the password filenames?',
        default: 'sha256WithRSAEncryption'
    }, {
        type: 'list',
        name: 'histignore',
        message: 'Should "stymie *" be prepended to the value of $HISTIGNORE?',
        choices: [
            {name: 'Yes', value: true},
            {name: 'No', value: false}
        ],
        default: true
    }, {
        type: 'input',
        name: 'histignoreFile',
        message: 'We need to write the new $HISTIGNORE value.\nName of shell startup file to which it should be written:',
        default: '.bashrc',
        when: (answers: Answer): string => answers.histignore
    }], (answers: Answer) => {
        const home = process.env.HOME;
        const armor = answers.armor;
        const recipient = answers.recipient;
        const sign = answers.sign;
        const arr = ['--encrypt', '-r', recipient];
        let installDir = answers.installDir;
        let stymieDir;

        if (armor) {
            arr.push('--armor');
        }

        if (sign) {
            arr.push('--sign');
        }

        if (installDir === '~') {
            installDir = home;
        }

        stymieDir = `${installDir}/.stymie.d`;

        function mkDir(dir: string): Promise<{}> {
            return new Promise((resolve: Function, reject: Function): void =>
                fs.mkdir(dir, 0o700, err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(dir);
                    }
                })
            );
        }

        mkDir(stymieDir)
        .then(dir => {
            logSuccess(`Created project directory ${dir}`);

            return mkDir(`${stymieDir}/s`);
        })
        .then((dir: string): string => {
            logSuccess(`Created encrypted entries directory ${dir}`);

            // Create config file.
            return jcrypt.stream(JSON.stringify({
                armor: armor,
                hash: answers.hash,
                recipient: recipient,
                sign: sign
            }, null, 4), `${stymieDir}/c`, {
                gpg: arr,
                file: {
                    flags: 'w',
                    defaultEncoding: 'utf8',
                    fd: null,
                    mode: 0o0600
                }
            }, true);
        })
        .then((file: string): string => {
            logSuccess(`Created encrypted config file ${file}`);

            // Create entry list file.
            return jcrypt.stream(JSON.stringify({}, null, 4), `${stymieDir}/k`, {
                gpg: arr,
                file: {
                    flags: 'w',
                    defaultEncoding: 'utf8',
                    fd: null,
                    mode: 0o0600
                }
            }, true);
        })
        .then((file: string): Promise<{}> => {
            logSuccess(`Created encrypted entries list file ${file}`);

            if (answers.histignore) {
                const histignoreFile = `${home}/${answers.histignoreFile}`;

                return new Promise((resolve: Function, reject: Function): void =>
                    fs.appendFile(histignoreFile, 'export HISTIGNORE="stymie *:$HISTIGNORE"\n', 'utf8', (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve('Updated $HISTIGNORE');
                        }
                    })
                );
            }
        })
        .then((data?: string): void => {
            // Note that `data` is undefined if not updating $HISTIGNORE.
            // TODO: is having a conditional in a #then a code smell?
            if (data) {
                logSuccess(data);

                // TODO
                // Immediately source the startup file.
                // require('child_process').spawn('source', [histignoreFile]);
            }
        })
        .catch((err: string): void => {
            logError(err);
            util.logWarn('Cleaning up, install aborted...');

            const rm = cp.spawn('rm', ['-r', '-f', stymieDir]);

            rm.on('close', (code: number): void => {
                if (code !== 0) {
                    logError('Something terrible happened, the project directory could not be removed!');
                } else {
                    util.logInfo('The project directory has been removed');
                }
            });
        });
    });

